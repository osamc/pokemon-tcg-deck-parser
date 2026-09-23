const ENERGY_SHORTHAND: Record<string, string> = {
  G: "Grass",
  R: "Fire",
  W: "Water",
  L: "Lightning",
  P: "Psychic",
  F: "Fighting",
  D: "Darkness",
  M: "Metal",
  Y: "Fairy",
  N: "Dragon",
  C: "Colorless",
};

const ENERGY_TYPES = Object.values(ENERGY_SHORTHAND);

export function expandEnergyShorthand(name: string): string {
  return name.replace(/\{([A-Za-z])\}/g, (match, letter: string) => {
    return ENERGY_SHORTHAND[letter.toUpperCase()] ?? match;
  });
}

const BASIC_ENERGY_RE = new RegExp(
  `^(?:basic\\s+)?(${ENERGY_TYPES.join("|")})\\s+energy$`,
  "i",
);

/**
 * Canonical basic-energy spelling for a deck export.
 * PTCGL writes `Basic {W} Energy`; Limitless writes `Water Energy`.
 * Other names are returned unchanged aside from `{W}` expansion.
 */
export function formatEnergyName(name: string, format: "ptcgl" | "limitless"): string {
  const expanded = expandEnergyShorthand(name).trim();
  const basic = BASIC_ENERGY_RE.exec(expanded);
  const type = basic?.[1] ? titleCase(basic[1]) : undefined;
  if (!type) return expanded;
  if (format === "limitless") return `${type} Energy`;
  const letter = Object.entries(ENERGY_SHORTHAND).find(([, label]) => label === type)?.[0];
  return letter ? `Basic {${letter}} Energy` : `Basic ${type} Energy`;
}

export function energyDisplayNames(name: string): string[] {
  const expanded = expandEnergyShorthand(name).trim();
  const names = new Set<string>([name.trim(), expanded]);

  const basic = expanded.match(
    new RegExp(`^(?:basic\\s+)?(${ENERGY_TYPES.join("|")})\\s+energy$`, "i"),
  );
  if (basic?.[1]) {
    const type = titleCase(basic[1]);
    names.add(`${type} Energy`);
    names.add(`Basic ${type} Energy`);
  }

  return [...names];
}

export function isBasicEnergyName(name: string): boolean {
  const expanded = expandEnergyShorthand(name);
  return new RegExp(
    `^(?:basic\\s+)?(${ENERGY_TYPES.join("|")})\\s+energy$`,
    "i",
  ).test(expanded.trim());
}

/**
 * True for actual Energy cards (Water Energy, Jet Energy, …).
 * False for trainers that only mention energy (Energy Switch, Energy Removal 2).
 */
export function isEnergyCardName(name: string): boolean {
  const expanded = expandEnergyShorthand(name).trim();
  return /.\s+energy$/i.test(expanded);
}

/** Trainers whose name contains "Energy" but are not Energy cards. */
export function isEnergyTrainerName(name: string): boolean {
  const expanded = expandEnergyShorthand(name).trim();
  return /\benergy\b/i.test(expanded) && !isEnergyCardName(expanded);
}

/** Names like "Energy Removal 2" / "Super Energy Removal 2" where the digit is part of the title. */
export function isNumberedEnergyTrainerName(name: string): boolean {
  return /^(?:super\s+)?energy\s+removal\s+\d+$/i.test(name.trim());
}

export function isEnergySetCode(code: string | undefined): boolean {
  return Boolean(code && /^energy$/i.test(code));
}

/** PTCGL Energy-set fallback applies only to real Energy cards, never Energy-named trainers. */
export function useEnergyFallback(name: string, setCode?: string): boolean {
  if (!isEnergyCardName(name)) return false;
  return isEnergySetCode(setCode) || isBasicEnergyName(name);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
