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

export function isEnergySetCode(code: string | undefined): boolean {
  return Boolean(code && /^energy$/i.test(code));
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
