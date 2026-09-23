import { formatEnergyName, isEnergyCardName, isEnergyTrainerName } from "./energy.js";
import type {
  CardCategory,
  DeckFormat,
  ExportableDeck,
  ExportCard,
  ExportOptions,
} from "./types.js";

const SECTION_ORDER = ["pokemon", "trainer", "energy"] as const;

const SECTION_LABEL: Record<Exclude<CardCategory, "unknown">, string> = {
  pokemon: "Pokémon",
  trainer: "Trainer",
  energy: "Energy",
};

/**
 * Write a deck in PTCGL or Limitless text form.
 * Section headers count cards (the sum of quantities). PTCGL also appends
 * `Total Cards:` and spells basic Energy with `{W}` shorthand.
 */
export function exportDecklist(deck: ExportableDeck, options: ExportOptions = {}): string {
  const format = options.format ?? deck.format;
  if (format !== "ptcgl" && format !== "limitless") {
    throw new Error('exportDecklist: format must be "ptcgl" or "limitless".');
  }

  const grouped = new Map<CardCategory, ExportCard[]>();
  for (const card of deck.cards) {
    if (!card.name.trim() || card.quantity <= 0) continue;
    const category = categoryOf(card);
    const list = grouped.get(category) ?? [];
    list.push(card);
    grouped.set(category, list);
  }

  const lines: string[] = [];
  const unsectioned = grouped.get("unknown") ?? [];
  for (const card of unsectioned) lines.push(formatCardLine(card, format));

  for (const category of SECTION_ORDER) {
    const cards = grouped.get(category);
    if (!cards?.length) continue;
    const count = cards.reduce((sum, card) => sum + card.quantity, 0);
    lines.push(`${SECTION_LABEL[category]}: ${count}`);
    for (const card of cards) lines.push(formatCardLine(card, format));
  }

  const total = [...grouped.values()]
    .flat()
    .reduce((sum, card) => sum + card.quantity, 0);
  if (format === "ptcgl" && total > 0) lines.push(`Total Cards: ${total}`);

  return lines.join("\n");
}

function categoryOf(card: ExportCard): CardCategory {
  if (card.category && card.category !== "unknown") return card.category;
  if (isEnergyCardName(card.name)) return "energy";
  if (isEnergyTrainerName(card.name)) return "trainer";
  return "unknown";
}

function formatCardLine(card: ExportCard, format: DeckFormat): string {
  const parts = [String(card.quantity), formatEnergyName(card.name, format)];
  const setCode = formatSetCode(card.setCode);
  if (setCode) parts.push(setCode);
  const number = card.number?.trim();
  if (number) parts.push(number);
  const foil = card.foil?.trim();
  if (foil) parts.push(foil.toUpperCase());
  return parts.join(" ");
}

function formatSetCode(code: string | undefined): string | undefined {
  const trimmed = code?.trim();
  if (!trimmed) return undefined;
  if (/^energy$/i.test(trimmed)) return "Energy";
  return trimmed.toUpperCase();
}
