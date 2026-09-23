import type TCGdex from "@tcgdex/sdk";
import type { Card, CardResume } from "@tcgdex/sdk";

export type DeckFormat = "ptcgl" | "limitless";

export type CardCategory = "pokemon" | "trainer" | "energy" | "unknown";

export type HydrateMode = "resume" | "full";

export interface ParsedCard {
  quantity: number;
  name: string;
  setCode?: string;
  number?: string;
  foil?: string;
  category: CardCategory;
  line: number;
  raw: string;
}

export interface ParseWarning {
  line?: number;
  message: string;
}

export interface ParsedDeck {
  format: DeckFormat;
  cards: ParsedCard[];
  totalCards: number;
  declaredTotal?: number;
  sectionCounts?: {
    pokemon?: number;
    trainer?: number;
    energy?: number;
  };
  warnings: ParseWarning[];
}

export interface ResolvedCard extends ParsedCard {
  card?: Card | CardResume;
  setId?: string;
  tcgdexId?: string;
  unresolvedReason?: string;
}

export interface ResolvedDeck {
  format: DeckFormat;
  cards: ResolvedCard[];
  totalCards: number;
  declaredTotal?: number;
  sectionCounts?: ParsedDeck["sectionCounts"];
  warnings: ParseWarning[];
  unresolved: ResolvedCard[];
}

export interface ParseOptions {
  /** Force a format instead of auto-detecting. */
  format?: DeckFormat | "auto";
}

/** A card row that can be written back out as a decklist. */
export interface ExportCard {
  quantity: number;
  name: string;
  setCode?: string;
  number?: string;
  foil?: string;
  category?: CardCategory;
}

/** Parsed or hand-built deck passed to {@link exportDecklist}. */
export interface ExportableDeck {
  format?: DeckFormat;
  cards: readonly ExportCard[];
}

export interface ExportOptions {
  /** Format to write. Defaults to the deck's `format`. */
  format?: DeckFormat;
}

export interface DeckParserOptions {
  /** TCGdex language. Defaults to `"en"`. */
  lang?: "en" | "fr" | "es" | "es-mx" | "it" | "pt" | "pt-br" | "de" | "nl" | "pl" | "ru" | "ja" | "ko" | "zh-tw" | "id" | "th" | "zh-cn";
  /** Reuse an existing SDK instance (shares its cache). */
  tcgdex?: TCGdex;
  /**
   * Base URL of the TCGdex API, e.g. a self-hosted instance or proxy.
   * Defaults to the SDK's endpoint (`https://api.tcgdex.net/v2`).
   * The language segment is appended by the SDK, so omit it here.
   */
  endpoint?: string;
  /**
   * SDK cache TTL in seconds. Defaults to 24 hours.
   * Card/set data rarely changes, so a long TTL avoids repeat traffic.
   */
  cacheTTL?: number;
  /** Max parallel TCGdex requests. Defaults to `4`. */
  concurrency?: number;
  /**
   * `"resume"` (default) matches cards from set lists — one request per unique set.
   * `"full"` then hydrates unique matched cards with complete TCGdex card objects.
   */
  hydrate?: HydrateMode;
}

export interface ResolveOptions {
  hydrate?: HydrateMode;
  concurrency?: number;
}

export interface SetLike {
  id: string;
  name: string;
  tcgOnline?: string;
  abbreviation?: { official?: string };
  cards: Array<CardResumeLike>;
}

export interface CardResumeLike {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

export interface CardLookup {
  resolveSetCodes(codes: string[]): Promise<Map<string, string[]>>;
  getSet(id: string): Promise<SetLike | undefined>;
  getCard(id: string): Promise<Card | CardResume | undefined>;
  findCardsByName(name: string): Promise<CardResumeLike[]>;
  /**
   * TCGdex category for each id.
   * Callers pass unique ids; implementations should batch them
   * (filtered list queries, not one request per card).
   */
  categoriesForIds?(ids: string[]): Promise<Map<string, CardCategory>>;
}
