import { isEnergyCardName, isEnergySetCode, isNumberedEnergyTrainerName } from "./energy.js";
import type { CardCategory, DeckFormat } from "./types.js";

const SECTION_RE =
  /^(pok[eé]mon|trainers?|energy|energies)\s*[:：]\s*(\d+)\s*$/i;
const BARE_SECTION_RE =
  /^(pok[eé]mon|trainers?|energy|energies)\s*[:：]?\s*$/i;
const TOTAL_RE = /^total\s+cards?\s*[:：]?\s*(\d+)\s*$/i;
const CARD_LINE_RE = /^(\d{1,3})\s*[x×]?\s+(.+)$/i;
/** Numeric / alphanumeric collector numbers (61, TG11, SWSH098, 25a). */
const NUMBER_RE = /^[A-Za-z]{0,5}\d{1,4}[A-Za-z]?$/;
/**
 * Letter / symbol collector numbers used by some older prints (Unown "M", "!", "?").
 * Only accepted when a set code is also present so names like "Mew ex" stay intact.
 */
const ALPHA_NUMBER_RE = /^[A-Za-z!?]$/;
const SETCODE_RE = /^[A-Z][A-Z0-9]{0,6}(?:-[A-Z0-9]{1,4})?$/;
const FOIL_MARKERS = new Set(["PH", "RH", "SH"]);

export function sectionCategory(label: string): CardCategory {
  if (/^pok/i.test(label)) return "pokemon";
  if (/^train/i.test(label)) return "trainer";
  if (/^energ/i.test(label)) return "energy";
  return "unknown";
}

export function isSectionLine(line: string): { category: CardCategory; count?: number } | undefined {
  const counted = SECTION_RE.exec(line);
  if (counted) {
    return {
      category: sectionCategory(counted[1] ?? ""),
      count: Number(counted[2]),
    };
  }
  if (BARE_SECTION_RE.test(line)) {
    return { category: sectionCategory(line) };
  }
  return undefined;
}

export function isTotalLine(line: string): number | undefined {
  const match = TOTAL_RE.exec(line);
  return match ? Number(match[1]) : undefined;
}

export function isCardLine(line: string): { quantity: number; rest: string } | undefined {
  const match = CARD_LINE_RE.exec(line);
  if (!match) return undefined;
  return { quantity: Number(match[1]), rest: match[2]!.trim() };
}

export interface SplitCardTokens {
  nameTokens: string[];
  setCode?: string;
  number?: string;
  foil?: string;
}

export function splitCardTokens(rest: string): SplitCardTokens {
  let tokens = rest.split(/\s+/);
  let foil: string | undefined;

  const last = tokens[tokens.length - 1];
  if (last && FOIL_MARKERS.has(last.toUpperCase()) && tokens.length > 1) {
    foil = last.toUpperCase();
    tokens = tokens.slice(0, -1);
  }

  if (
    tokens.length >= 3 &&
    looksLikeCollectorNumber(tokens[tokens.length - 1] ?? "") &&
    /^energy$/i.test(tokens[tokens.length - 2] ?? "") &&
    isEnergyCardName(tokens.slice(0, -2).join(" "))
  ) {
    return {
      nameTokens: tokens.slice(0, -2),
      setCode: "Energy",
      number: tokens[tokens.length - 1],
      foil,
    };
  }

  if (
    tokens.length >= 3 &&
    looksLikeCollectorNumber(tokens[tokens.length - 1] ?? "", { allowAlpha: true }) &&
    looksLikeSetCode(tokens[tokens.length - 2] ?? "") &&
    !isLoneEnergyTrainerName(tokens.slice(0, -2), tokens[tokens.length - 2])
  ) {
    return {
      nameTokens: tokens.slice(0, -2),
      setCode: tokens[tokens.length - 2]!.toUpperCase(),
      number: tokens[tokens.length - 1],
      foil,
    };
  }

  if (
    tokens.length >= 2 &&
    looksLikeCollectorNumber(tokens[tokens.length - 1] ?? "") &&
    !isNumberedEnergyTrainerName(tokens.join(" "))
  ) {
    return {
      nameTokens: tokens.slice(0, -1),
      number: tokens[tokens.length - 1],
      foil,
    };
  }

  return { nameTokens: tokens, foil };
}

function looksLikeCollectorNumber(
  token: string,
  options: { allowAlpha?: boolean } = {},
): boolean {
  if (NUMBER_RE.test(token)) return true;
  return Boolean(options.allowAlpha && ALPHA_NUMBER_RE.test(token));
}

function looksLikeSetCode(token: string): boolean {
  if (!token) return false;
  const uniformCase = token === token.toUpperCase() || token === token.toLowerCase();
  if (!uniformCase) return false;
  return SETCODE_RE.test(token.toUpperCase());
}

/** "Energy Switch 194" must not become name "Energy" + set "SWITCH". */
function isLoneEnergyTrainerName(nameTokens: string[], maybeSet: string | undefined): boolean {
  return (
    nameTokens.length === 1 &&
    /^energy$/i.test(nameTokens[0] ?? "") &&
    !isEnergySetCode(maybeSet)
  );
}

export function looksLikePtcgl(text: string): boolean {
  return (
    /Basic\s*\{[A-Za-z]\}\s*Energy/i.test(text) ||
    /\sPH\s*$/m.test(text) ||
    /\sEnergy\s+\d+\b/i.test(text) ||
    /^Total Cards:/m.test(text)
  );
}

export function looksLikeDecklist(text: string): boolean {
  return text
    .split(/\r?\n/)
    .some((line) => CARD_LINE_RE.test(line.trim()) || SECTION_RE.test(line.trim()));
}

export function inferFormat(text: string): DeckFormat {
  return looksLikePtcgl(text) ? "ptcgl" : "limitless";
}
