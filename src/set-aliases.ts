import type { SetCodeOverrides } from "./types.js";

/**
 * PTCGL / Limitless set codes that are not official abbreviations
 * (or that map more reliably to a specific TCGdex set).
 */
export const SET_CODE_ALIASES: Record<string, string> = {
  "PR-SW": "swshp",
  "PR-SWSH": "swshp",
  SWSHP: "swshp",
  SWSH: "swshp",
  "PR-SV": "svp",
  "PR-SVI": "svp",
  SVP: "svp",
  "PR-SM": "smp",
  SMP: "smp",
  "PR-XY": "xyp",
  XYP: "xyp",
  "PR-BW": "bwp",
  "PR-BLW": "bwp",
  BWP: "bwp",
  "PR-HS": "hgssp",
  HGSSP: "hgssp",
  "PR-DP": "dpp",
  DPP: "dpp",
  "PR-NP": "np",
  NP: "np",
  MEP: "mep",
  "PR-ME": "mep",
  SVE: "sve",
  MEE: "mee",
  TRR: "ex7",
};

/**
 * Codes TCGdex gives to more than one set, with every set they can mean.
 * These are answered here, not by TCGdex, so the result never depends on
 * which sets happen to be cached. The card name picks between the sets; the
 * first one is the Limitless meaning.
 *
 * TCGdex lists Team Rocket Returns (ex7) with abbreviation `TR` and tcgOnline
 * `RR`, which collide with Team Rocket (base5, tcgOnline `TR`) and Rising
 * Rivals (pl2, abbreviation `RR`). Limitless writes Team Rocket Returns as `TRR`.
 */
export const AMBIGUOUS_SET_CODES: Record<string, string[]> = {
  TR: ["base5", "ex7"],
  RR: ["pl2", "ex7"],
  TRR: ["ex7"],
};

/**
 * Set ids a code is pinned to, or `undefined` when TCGdex should be asked.
 * Caller overrides win over {@link AMBIGUOUS_SET_CODES}.
 */
export function pinnedSetIds(code: string, overrides?: SetCodeOverrides): string[] | undefined {
  const key = code.trim().toUpperCase();
  if (overrides) {
    for (const [overrideCode, ids] of Object.entries(overrides)) {
      if (overrideCode.trim().toUpperCase() !== key) continue;
      const list = (Array.isArray(ids) ? ids : [ids]).map((id) => id.trim()).filter(Boolean);
      if (list.length > 0) return [...new Set(list)];
    }
  }
  const pinned = AMBIGUOUS_SET_CODES[key];
  return pinned ? [...pinned] : undefined;
}

export const PROMO_LOCAL_ID_PREFIX: Record<string, string> = {
  swshp: "SWSH",
  svp: "SVP",
  smp: "SM",
  xyp: "XY",
  bwp: "BW",
  hgssp: "HGSS",
  dpp: "DP",
  np: "NP",
  mep: "MEP",
};

const ALT_SET_RE = /^(?:SWSH|SM|SV|XY|BW)?ALT$/i;

export function isAltSetCode(code: string | undefined): boolean {
  return Boolean(code && ALT_SET_RE.test(code));
}

export function isPseudoSetCode(code: string | undefined): boolean {
  return isAltSetCode(code) || Boolean(code && /^energy$/i.test(code));
}

export function aliasSetCode(code: string): string | undefined {
  return SET_CODE_ALIASES[code.toUpperCase()];
}

export function extraSetIdsForCode(code: string): string[] {
  return AMBIGUOUS_SET_CODES[code.toUpperCase()] ?? [];
}

export function galleryKind(number: string | undefined): "tg" | "gg" | undefined {
  if (!number) return undefined;
  const upper = number.toUpperCase();
  if (upper.startsWith("TG")) return "tg";
  if (upper.startsWith("GG")) return "gg";
  return undefined;
}
