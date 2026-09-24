import TCGdex from "@tcgdex/sdk";
import { exportDecklist } from "./export.js";
import { parseDecklist } from "./parse.js";
import { resolveDeck } from "./resolve.js";
import { TcgdexLookup } from "./tcgdex-lookup.js";
import type {
  DeckParserOptions,
  ExportableDeck,
  ExportOptions,
  ParseOptions,
  ParsedDeck,
  ResolveOptions,
  ResolvedDeck,
} from "./types.js";

const DEFAULT_CACHE_TTL = 60 * 60 * 24;
const DEFAULT_CONCURRENCY = 4;

export class DeckParser {
  private readonly lookup: TcgdexLookup;
  private readonly defaults: Required<Pick<DeckParserOptions, "concurrency" | "hydrate">>;

  constructor(options: DeckParserOptions = {}) {
    const tcgdex = options.tcgdex ?? new TCGdex(options.lang ?? "en");
    if (!options.tcgdex) {
      tcgdex.setCacheTTL(options.cacheTTL ?? DEFAULT_CACHE_TTL);
    } else if (options.cacheTTL !== undefined) {
      tcgdex.setCacheTTL(options.cacheTTL);
    }
    if (options.endpoint !== undefined) {
      tcgdex.setEndpoint(normalizeEndpoint(options.endpoint));
    }

    const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
    this.defaults = {
      concurrency,
      hydrate: options.hydrate ?? "resume",
    };
    this.lookup = new TcgdexLookup(tcgdex, concurrency);
  }

  /**
   * Invalidate cached set lists, name searches, categories, and SDK responses.
   * The next resolve will hit the API again for anything previously cached.
   */
  clearCache(): void {
    this.lookup.clearCache();
  }

  /** Parse a decklist without contacting the API. */
  parse(text: string, options: ParseOptions = {}): ParsedDeck {
    return parseDecklist(text, options);
  }

  /**
   * Write a parsed deck back out as PTCGL or Limitless text.
   * Defaults to the deck's own format.
   */
  export(deck: ExportableDeck, options: ExportOptions = {}): string {
    return exportDecklist(deck, options);
  }

  /** Resolve already-parsed cards through TCGdex. */
  resolve(parsed: ParsedDeck, options: ResolveOptions = {}): Promise<ResolvedDeck> {
    return resolveDeck(parsed, this.lookup, {
      hydrate: options.hydrate ?? this.defaults.hydrate,
      concurrency: options.concurrency ?? this.defaults.concurrency,
    });
  }

  /**
   * Parse a decklist and look up each card via TCGdex.
   * Section dividers are checked against each card's TCGdex category, so a trainer
   * filed under Pokémon is moved to the right category.
   */
  async parseAndResolve(
    text: string,
    options: ParseOptions & ResolveOptions = {},
  ): Promise<ResolvedDeck> {
    const parsed = this.parse(text, options);
    return this.resolve(parsed, options);
  }
}

function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("DeckParser: `endpoint` must be a non-empty URL.");
  return trimmed;
}

/** Convenience helper that constructs a parser, parses, and resolves. */
export function parseDeck(
  text: string,
  options: DeckParserOptions & ParseOptions & ResolveOptions = {},
): Promise<ResolvedDeck> {
  const { format, hydrate, concurrency, ...parserOptions } = options;
  return new DeckParser({ ...parserOptions, hydrate, concurrency }).parseAndResolve(text, {
    format,
    hydrate,
    concurrency,
  });
}
