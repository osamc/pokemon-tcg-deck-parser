import TCGdex, { Query } from "@tcgdex/sdk";
import { aliasSetCode, extraSetIdsForCode, isPseudoSetCode } from "./set-aliases.js";
import { InFlight, mapPool } from "./pool.js";
import type { CardCategory, CardLookup, CardResumeLike, SetLike } from "./types.js";

interface AbbreviatedSet extends SetLike {
  abbreviation?: { official?: string };
}

const API_CATEGORIES = [
  ["Pokemon", "pokemon"],
  ["Trainer", "trainer"],
  ["Energy", "energy"],
] as const satisfies ReadonlyArray<readonly [string, CardCategory]>;

/** Ids per filtered list query. Keeps the request URL well under typical limits. */
const CATEGORY_ID_CHUNK = 40;

export class TcgdexLookup implements CardLookup {
  private readonly inflight = new InFlight();
  private readonly setCodeIndex = new Map<string, string[]>();
  private readonly setCache = new Map<string, SetLike | undefined>();
  private readonly nameCache = new Map<string, CardResumeLike[]>();
  private readonly categoryCache = new Map<string, CardCategory>();

  constructor(
    private readonly tcgdex: TCGdex,
    private readonly concurrency: number,
  ) {}

  async resolveSetCodes(codes: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    const uniqueCodes = [...new Set(codes.map((code) => code.toUpperCase()).filter(Boolean))];
    const unresolved: string[] = [];

    for (const code of uniqueCodes) {
      if (isPseudoSetCode(code)) {
        result.set(code, []);
        continue;
      }

      const ids = knownSetIds(code, this.setCodeIndex);
      result.set(code, ids);

      const alias = aliasSetCode(code);
      if (alias || extraSetIdsForCode(code).length > 0 || this.setCodeIndex.has(code)) {
        continue;
      }

      unresolved.push(code);
    }

    if (unresolved.length > 0) {
      await this.lookupMissingCodes(unresolved);
      for (const code of unresolved) {
        result.set(code, knownSetIds(code, this.setCodeIndex));
      }
    }

    return result;
  }

  async getSet(id: string): Promise<SetLike | undefined> {
    const key = id.toLowerCase();
    if (this.setCache.has(key)) return this.setCache.get(key);

    return this.inflight.run(`set:${key}`, async () => {
      if (this.setCache.has(key)) return this.setCache.get(key);
      const set = await this.tcgdex.set.get(id);
      const mapped = set ? this.toSetLike(set as unknown as AbbreviatedSet) : undefined;
      this.setCache.set(key, mapped);
      if (mapped) this.indexSet(mapped);
      return mapped;
    });
  }

  async getCard(id: string) {
    return this.inflight.run(`card:${id}`, async () => {
      return (await this.tcgdex.card.get(id)) ?? undefined;
    });
  }

  async findCardsByName(name: string): Promise<CardResumeLike[]> {
    const key = name.toLowerCase();
    const cached = this.nameCache.get(key);
    if (cached) return cached;

    return this.inflight.run(`name:${key}`, async () => {
      const existing = this.nameCache.get(key);
      if (existing) return existing;

      const list = await this.tcgdex.card.list(Query.create().equal("name", name));
      const cards = (list ?? []).map((card) => ({
        id: card.id,
        localId: card.localId,
        name: card.name,
        image: card.image,
      }));
      this.nameCache.set(key, cards);
      return cards;
    });
  }

  /**
   * Category is not on set-list briefs. Ask TCGdex which of these ids belong to
   * each category — three filtered list queries per chunk, not one request per card.
   */
  async categoriesForIds(ids: string[]): Promise<Map<string, CardCategory>> {
    const result = new Map<string, CardCategory>();
    const missing: string[] = [];

    for (const id of new Set(ids.filter(Boolean))) {
      const cached = this.categoryCache.get(id);
      if (cached) result.set(id, cached);
      else missing.push(id);
    }
    if (missing.length === 0) return result;

    const jobs = chunkIds(missing, CATEGORY_ID_CHUNK).flatMap((chunk) =>
      API_CATEGORIES.map(([apiCategory, category]) => ({ chunk, apiCategory, category })),
    );

    await mapPool(jobs, this.concurrency, async ({ chunk, apiCategory, category }) => {
      const key = `category:${apiCategory}:${[...chunk].sort().join("|")}`;
      const matches = await this.inflight.run(key, () =>
        this.tcgdex.card.list(
          Query.create().equal("id", chunk.join("|")).equal("category", apiCategory),
        ),
      );
      for (const card of matches ?? []) {
        this.categoryCache.set(card.id, category);
        result.set(card.id, category);
      }
    });

    return result;
  }

  private async lookupMissingCodes(codes: string[]): Promise<void> {
    const stillMissing = codes.filter((code) => !this.setCodeIndex.has(code));
    if (stillMissing.length === 0) return;

    const foundIds = new Set<string>();

    const byAbbr = await this.tcgdex.set.list(
      Query.create().equal("abbreviation.official", stillMissing.join("|")),
    );
    for (const set of byAbbr ?? []) foundIds.add(set.id);

    const byOnline = await this.tcgdex.set.list(
      Query.create().equal("tcgOnline", stillMissing.join("|")),
    );
    for (const set of byOnline ?? []) foundIds.add(set.id);

    const missingAfterList = stillMissing.filter((code) => !this.setCodeIndex.has(code));
    await mapPool([...foundIds, ...missingAfterList.map((code) => code.toLowerCase())], this.concurrency, (id) =>
      this.getSet(id),
    );

    for (const code of stillMissing) {
      if (!this.setCodeIndex.has(code)) this.setCodeIndex.set(code, []);
    }
  }

  private toSetLike(set: AbbreviatedSet): SetLike {
    return {
      id: set.id,
      name: set.name,
      tcgOnline: set.tcgOnline,
      abbreviation: set.abbreviation,
      cards: set.cards ?? [],
    };
  }

  private indexSet(set: SetLike): void {
    this.addIndex(set.id.toUpperCase(), set.id);
    if (set.abbreviation?.official) this.addIndex(set.abbreviation.official.toUpperCase(), set.id);
    if (set.tcgOnline) this.addIndex(set.tcgOnline.toUpperCase(), set.id);
  }

  private addIndex(code: string, setId: string): void {
    const current = this.setCodeIndex.get(code) ?? [];
    if (!current.includes(setId)) {
      current.push(setId);
      this.setCodeIndex.set(code, current);
    }
  }
}

function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}

function knownSetIds(code: string, setCodeIndex: Map<string, string[]>): string[] {
  return [...new Set([
    aliasSetCode(code),
    ...(setCodeIndex.get(code) ?? []),
    ...extraSetIdsForCode(code),
  ].filter((id): id is string => Boolean(id)))];
}
