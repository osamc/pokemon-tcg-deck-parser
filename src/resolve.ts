import { energyDisplayNames, useEnergyFallback } from "./energy.js";
import { localIdCandidates, namesMatch, normalizeLocalId } from "./normalize.js";
import { mapPool } from "./pool.js";
import { extraSetIdsForCode, galleryKind, isAltSetCode, isPseudoSetCode } from "./set-aliases.js";
import type {
  CardCategory,
  CardLookup,
  CardResumeLike,
  HydrateMode,
  ParsedCard,
  ParsedDeck,
  ParseWarning,
  ResolveOptions,
  ResolvedCard,
  ResolvedDeck,
  SetLike,
} from "./types.js";

export async function resolveDeck(
  parsed: ParsedDeck,
  lookup: CardLookup,
  options: ResolveOptions = {},
): Promise<ResolvedDeck> {
  const hydrate: HydrateMode = options.hydrate ?? "resume";
  const concurrency = options.concurrency ?? 4;

  const setCodes = [
    ...new Set(
      parsed.cards
        .map((card) => card.setCode)
        .filter((code): code is string => Boolean(code) && !isPseudoSetCode(code)),
    ),
  ];

  const codeToSets = withExtraSetIds(await lookup.resolveSetCodes(setCodes));
  const setIds = unique(
    [...codeToSets.values()].flat().concat(gallerySetIds(parsed.cards, codeToSets)),
  );

  const sets = new Map<string, SetLike>();
  await mapPool(setIds, concurrency, async (id) => {
    const set = await lookup.getSet(id);
    if (set) sets.set(set.id, set);
  });

  const resolved: ResolvedCard[] = [];
  const nameLookups = new Map<string, CardResumeLike[] | undefined>();

  for (const card of parsed.cards) {
    const match = matchFromSets(card, codeToSets, sets);
    if (match) {
      resolved.push({
        ...card,
        card: match,
        setId: setIdFromCardId(match.id),
        tcgdexId: match.id,
      });
      continue;
    }

    for (const name of lookupNamesFor(card)) {
      if (!nameLookups.has(name)) nameLookups.set(name, undefined);
    }

    resolved.push({ ...card, unresolvedReason: "pending-name" });
  }

  const namesToFetch = [...nameLookups.keys()];
  await mapPool(namesToFetch, concurrency, async (name) => {
    nameLookups.set(name, await lookup.findCardsByName(name));
  });

  const withNames = resolved.map((card) => {
    if (card.tcgdexId || card.unresolvedReason !== "pending-name") return card;
    const match = matchByName(card, nameLookups);
    if (match) {
      return {
        ...card,
        card: match,
        setId: setIdFromCardId(match.id),
        tcgdexId: match.id,
        unresolvedReason: undefined,
      };
    }
    return {
      ...card,
      unresolvedReason: unresolvedMessage(card),
    };
  });

  const hydrated =
    hydrate === "full"
      ? await hydrateCards(withNames, lookup, concurrency)
      : withNames;

  const warnings = [...parsed.warnings];
  const cards = await correctCategories(hydrated, lookup, warnings);

  return {
    format: parsed.format,
    cards,
    totalCards: parsed.totalCards,
    declaredTotal: parsed.declaredTotal,
    sectionCounts: parsed.sectionCounts,
    warnings,
    unresolved: cards.filter((card) => !card.card),
  };
}

/**
 * Section headers are hints. A missing or wrong divider leaves trainers (and energy)
 * in the Pokémon bucket, and set briefs do not include category. Confirm each matched
 * id against TCGdex and rewrite the category when the API disagrees.
 */
async function correctCategories(
  cards: ResolvedCard[],
  lookup: CardLookup,
  warnings: ParseWarning[],
): Promise<ResolvedCard[]> {
  const known = new Map<string, CardCategory>();
  for (const card of cards) {
    if (!card.tcgdexId) continue;
    const category = categoryFromCard(card.card);
    if (category) known.set(card.tcgdexId, category);
  }

  const missing = unique(
    cards
      .map((card) => card.tcgdexId)
      .filter((id): id is string => {
        if (!id) return false;
        return !known.has(id);
      }),
  );
  const lookedUp =
    missing.length > 0 && lookup.categoriesForIds
      ? await lookup.categoriesForIds(missing)
      : new Map<string, CardCategory>();

  return cards.map((card) => {
    if (!card.tcgdexId) return card;
    const apiCategory = known.get(card.tcgdexId) ?? lookedUp.get(card.tcgdexId);
    if (!apiCategory || apiCategory === card.category) return card;
    if (card.category !== "unknown") {
      warnings.push({
        line: card.line,
        message: `${card.name} was listed as ${categoryLabel(card.category)} but TCGdex categorises it as ${categoryLabel(apiCategory)}.`,
      });
    }
    return { ...card, category: apiCategory };
  });
}

function categoryLabel(category: CardCategory): string {
  if (category === "pokemon") return "Pokémon";
  if (category === "trainer") return "Trainer";
  if (category === "energy") return "Energy";
  return "Unknown";
}

function categoryFromCard(card: ResolvedCard["card"]): CardCategory | undefined {
  const value = (card as { category?: string } | undefined)?.category?.trim().toLowerCase();
  if (value === "pokemon" || value === "trainer" || value === "energy") return value;
  return undefined;
}

function withExtraSetIds(codeToSets: Map<string, string[]>): Map<string, string[]> {
  const merged = new Map<string, string[]>();
  for (const [code, ids] of codeToSets) {
    merged.set(code, unique([...ids, ...extraSetIdsForCode(code)]));
  }
  return merged;
}

function matchFromSets(
  card: ParsedCard,
  codeToSets: Map<string, string[]>,
  sets: Map<string, SetLike>,
): CardResumeLike | undefined {
  if (!card.setCode || !card.number || isPseudoSetCode(card.setCode)) return undefined;

  const setIds = preferSetsForNumber(card.number, codeToSets.get(card.setCode.toUpperCase()) ?? []);
  const matches: CardResumeLike[] = [];
  for (const setId of setIds) {
    const set = sets.get(setId) ?? [...sets.values()].find((item) => item.id.toLowerCase() === setId.toLowerCase());
    if (!set) continue;
    const matched = matchLocalId(set, card.number);
    if (matched) matches.push(matched);
  }

  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  const named = matches.filter((item) => namesMatch(item.name, card.name));
  return named[0];
}

function matchLocalId(set: SetLike, number: string): CardResumeLike | undefined {
  const candidates = new Set(localIdCandidates(number, set.id).map(normalizeLocalId));
  return set.cards.find((card) => candidates.has(normalizeLocalId(card.localId)));
}

function preferSetsForNumber(number: string, setIds: string[]): string[] {
  const kind = galleryKind(number);
  if (!kind) {
    return [...setIds].sort((a, b) => Number(isGallerySet(a)) - Number(isGallerySet(b)));
  }
  return [...setIds].sort((a, b) => {
    const aMatch = a.toLowerCase().endsWith(kind) ? 0 : 1;
    const bMatch = b.toLowerCase().endsWith(kind) ? 0 : 1;
    return aMatch - bMatch;
  });
}

function gallerySetIds(cards: ParsedCard[], codeToSets: Map<string, string[]>): string[] {
  const extras: string[] = [];
  for (const card of cards) {
    const kind = galleryKind(card.number);
    if (!kind || !card.setCode) continue;
    for (const setId of codeToSets.get(card.setCode.toUpperCase()) ?? []) {
      extras.push(`${setId}${kind}`);
    }
  }
  return extras;
}

function isGallerySet(setId: string): boolean {
  return /(tg|gg)$/i.test(setId);
}

function lookupNamesFor(card: ParsedCard): string[] {
  if (useEnergyFallback(card.name, card.setCode)) {
    return energyDisplayNames(card.name);
  }
  return [card.name];
}

function matchByName(
  card: ParsedCard,
  nameLookups: Map<string, CardResumeLike[] | undefined>,
): CardResumeLike | undefined {
  const names = lookupNamesFor(card);
  const matches: CardResumeLike[] = [];
  for (const name of names) {
    for (const candidate of nameLookups.get(name) ?? []) {
      if (namesMatch(candidate.name, name) || namesMatch(candidate.name, card.name)) {
        matches.push(candidate);
      }
    }
  }
  if (matches.length === 0) return undefined;

  const energyFallback = useEnergyFallback(card.name, card.setCode);
  // PTCGL "Energy 29" numbers are artwork IDs, not collector numbers.
  if (card.number && !energyFallback) {
    const byNumber = matches.find((item) =>
      localIdCandidates(card.number!, setIdFromCardId(item.id)).some(
        (candidate) => normalizeLocalId(candidate) === normalizeLocalId(item.localId),
      ),
    );
    if (byNumber) return byNumber;
  }

  if (energyFallback) {
    for (const preferredSet of ["sve", "mee"]) {
      const preferred = matches.find((item) => setIdFromCardId(item.id)?.toLowerCase() === preferredSet);
      if (preferred) return preferred;
    }
  }

  return matches[0];
}

function unresolvedMessage(card: ParsedCard): string {
  if (isAltSetCode(card.setCode)) {
    return `PTCGL ALT print "${card.setCode}" could not be matched; try a regular printing.`;
  }
  if (card.setCode && card.number) {
    return `No TCGdex card found for ${card.name} (${card.setCode} ${card.number}).`;
  }
  return `No TCGdex card found for ${card.name}.`;
}

async function hydrateCards(
  cards: ResolvedCard[],
  lookup: CardLookup,
  concurrency: number,
): Promise<ResolvedCard[]> {
  const uniqueIds = unique(cards.map((card) => card.tcgdexId).filter((id): id is string => Boolean(id)));
  const fullCards = new Map<string, Awaited<ReturnType<CardLookup["getCard"]>>>();

  await mapPool(uniqueIds, concurrency, async (id) => {
    fullCards.set(id, await lookup.getCard(id));
  });

  return cards.map((card) => {
    if (!card.tcgdexId) return card;
    const full = fullCards.get(card.tcgdexId);
    return full ? { ...card, card: full } : card;
  });
}

function setIdFromCardId(id: string): string | undefined {
  const index = id.lastIndexOf("-");
  return index === -1 ? undefined : id.slice(0, index);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
