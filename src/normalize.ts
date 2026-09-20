import { PROMO_LOCAL_ID_PREFIX } from "./set-aliases.js";

export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesMatch(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}

export function normalizeLocalId(id: string): string {
  return id
    .trim()
    .toUpperCase()
    .replace(/^([A-Z]*)0+(\d)/, "$1$2");
}

export function localIdCandidates(number: string, setId?: string): string[] {
  const raw = number.trim();
  const upper = raw.toUpperCase();
  const stripped = normalizeLocalId(upper);
  const padded = upper.replace(/^([A-Z]*)(\d+)$/, (_match, prefix: string, digits: string) => {
    return `${prefix}${digits.padStart(3, "0")}`;
  });

  const candidates = new Set<string>([raw, upper, stripped, padded]);

  if (setId) {
    const promoPrefix = PROMO_LOCAL_ID_PREFIX[setId.toLowerCase()];
    if (promoPrefix) {
      const digits = upper.replace(/^[A-Z]+/, "").replace(/^0+/, "") || upper.replace(/\D/g, "");
      if (digits) {
        candidates.add(`${promoPrefix}${digits}`);
        candidates.add(`${promoPrefix}${digits.padStart(3, "0")}`);
      }
    }
  }

  return [...candidates];
}
