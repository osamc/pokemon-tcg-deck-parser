import {
  DeckParser,
  detectFormat,
  parseDecklist,
  type DeckFormat,
  type HydrateMode,
  type ParsedDeck,
  type ResolvedCard,
  type ResolvedDeck,
} from "pokemon-tcg-deck-parser";

const SAMPLE_PTCGL = `Pokémon: 3
3 Chien-Pao ex PAL 61
2 Greninja ex TWM 106
1 Mew ex MEW 193
Trainer: 3
4 Nest Ball SVI 181
1 Switch SVI 194 PH
2 Iono PAL 254
Energy: 3
1 Basic {W} Energy Energy 38 PH
11 Basic {W} Energy Energy 29
2 Basic {W} Energy SVE 11 PH
Total Cards: 27`;

const SAMPLE_LIMITLESS = `Pokémon: 13
3 Charcadet SSP 32
1 Charcadet PAR 26
3 Ceruledge ex SSP 36
2 Solrock MEG 75
2 Lunatone MEG 74
1 Squawkabilly ex PAL 169
1 Fezandipiti ex SFA 38
Trainer: 27
3 Carmine TWM 145
3 Boss's Orders MEG 114
2 Professor's Research JTG 155
4 Ultra Ball MEG 131
4 Nest Ball SVI 181
Energy: 20
10 Fighting Energy SVE 22
6 Fire Energy SVE 18
2 Jet Energy PAL 190
1 Mist Energy TEF 161
1 Legacy Energy TWM 167`;

const parser = new DeckParser({ lang: "en", concurrency: 4 });

const decklist = document.querySelector("#decklist") as HTMLTextAreaElement;
const format = document.querySelector("#format") as HTMLSelectElement;
const hydrate = document.querySelector("#hydrate") as HTMLSelectElement;
const status = document.querySelector("#status") as HTMLElement;
const summary = document.querySelector("#summary") as HTMLElement;
const messages = document.querySelector("#messages") as HTMLElement;
const cards = document.querySelector("#cards") as HTMLElement;
const jsonWrap = document.querySelector("#json-wrap") as HTMLElement;
const json = document.querySelector("#json") as HTMLElement;

document.querySelector("#sample-ptcgl")?.addEventListener("click", () => {
  decklist.value = SAMPLE_PTCGL;
  format.value = "ptcgl";
  setStatus("Loaded PTCGL sample");
});

document.querySelector("#sample-limitless")?.addEventListener("click", () => {
  decklist.value = SAMPLE_LIMITLESS;
  format.value = "limitless";
  setStatus("Loaded Limitless sample");
});

document.querySelector("#parse")?.addEventListener("click", () => {
  run("parse");
});

document.querySelector("#resolve")?.addEventListener("click", () => {
  void run("resolve");
});

async function run(mode: "parse" | "resolve"): Promise<void> {
  const text = decklist.value.trim();
  if (!text) {
    setStatus("Paste a decklist first");
    return;
  }

  const selectedFormat = format.value as "auto" | DeckFormat;
  const started = performance.now();
  setStatus(mode === "parse" ? "Parsing…" : "Resolving via TCGdex…");

  try {
    if (mode === "parse") {
      const parsed = parseDecklist(text, formatOption(selectedFormat));
      render(parsed, performance.now() - started, detectFormat(text));
      setStatus(`Parsed in ${ms(started)}`);
      return;
    }

    const resolved = await parser.parseAndResolve(text, {
      ...formatOption(selectedFormat),
      hydrate: hydrate.value as HydrateMode,
    });
    render(resolved, performance.now() - started, detectFormat(text));
    setStatus(`Resolved in ${ms(started)}`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
}

function formatOption(value: "auto" | DeckFormat): { format?: DeckFormat | "auto" } {
  return { format: value };
}

function render(
  result: ParsedDeck | ResolvedDeck,
  elapsed: number,
  detected: ReturnType<typeof detectFormat>,
): void {
  const unresolved = "unresolved" in result ? result.unresolved : [];
  const resolvedCount =
    "unresolved" in result ? result.cards.length - unresolved.length : result.cards.length;

  summary.hidden = false;
  summary.innerHTML = [
    pill(`detected: ${detected}`),
    pill(`parsed as: ${result.format}`),
    pill(`${result.totalCards} cards`),
    result.declaredTotal !== undefined ? pill(`declared: ${result.declaredTotal}`) : "",
    pill(`${result.cards.length} lines`),
    "unresolved" in result ? pill(`${resolvedCount} resolved`, unresolved.length ? "warn" : "ok") : "",
    unresolved.length ? pill(`${unresolved.length} unresolved`, "bad") : "",
    result.warnings.length ? pill(`${result.warnings.length} warnings`, "warn") : "",
    pill(`${elapsed.toFixed(0)} ms`),
  ].join("");

  const warningItems = result.warnings.map((warning) => li(warning.line ? `Line ${warning.line}: ${warning.message}` : warning.message));
  const unresolvedItems = unresolved.map((card) =>
    li(`${card.quantity} ${card.name} — ${card.unresolvedReason ?? "unresolved"}`),
  );

  messages.hidden = warningItems.length + unresolvedItems.length === 0;
  messages.innerHTML = [
    warningItems.length ? `<h2>Warnings</h2><ul>${warningItems.join("")}</ul>` : "",
    unresolvedItems.length ? `<h2>Unresolved</h2><ul>${unresolvedItems.join("")}</ul>` : "",
  ].join("");

  cards.hidden = result.cards.length === 0;
  cards.innerHTML = result.cards.map(cardHtml).join("");

  jsonWrap.hidden = false;
  json.textContent = JSON.stringify(debugResult(result), null, 2);
}

function cardHtml(card: ResolvedCard): string {
  const image = cardImage(card);
  const printing = [card.setCode, card.number, card.foil].filter(Boolean).join(" ");
  const unresolved = Boolean(card.unresolvedReason);
  return `
    <article class="card${unresolved ? " unresolved" : ""}">
      ${image ? `<img alt="${escapeHtml(card.name)}" src="${escapeHtml(image)}">` : ""}
      <div class="body">
        <div><span class="qty">${card.quantity}×</span> ${escapeHtml(card.name)}</div>
        <div class="meta">${escapeHtml(printing || card.category)}${card.tcgdexId ? ` · ${escapeHtml(card.tcgdexId)}` : ""}</div>
        ${unresolved ? `<div class="reason">${escapeHtml(card.unresolvedReason ?? "")}</div>` : ""}
      </div>
    </article>
  `;
}

function cardImage(card: ResolvedCard): string | undefined {
  const data = card.card as { image?: string; getImageURL?: (quality: string, format: string) => string } | undefined;
  if (data && typeof data.getImageURL === "function") {
    try {
      return data.getImageURL("low", "webp");
    } catch {
      // fall through to the resume image URL
    }
  }
  return data?.image ? `${data.image}/low.webp` : undefined;
}

function debugResult(result: ParsedDeck | ResolvedDeck): unknown {
  return {
    format: result.format,
    totalCards: result.totalCards,
    declaredTotal: result.declaredTotal,
    sectionCounts: result.sectionCounts,
    warnings: result.warnings,
    unresolved: "unresolved" in result ? result.unresolved.map((card) => card.tcgdexId ?? card.name) : undefined,
    cards: result.cards.map((card) => ({
      quantity: card.quantity,
      name: card.name,
      setCode: card.setCode,
      number: card.number,
      foil: card.foil,
      category: card.category,
      line: card.line,
      tcgdexId: "tcgdexId" in card ? card.tcgdexId : undefined,
      setId: "setId" in card ? card.setId : undefined,
      unresolvedReason: "unresolvedReason" in card ? card.unresolvedReason : undefined,
      card: "card" in card ? pickCard(card.card) : undefined,
    })),
  };
}

function pickCard(card: ResolvedCard["card"]): Record<string, unknown> | undefined {
  if (!card) return undefined;
  const value = card as unknown as Record<string, unknown>;
  const keys = [
    "id",
    "localId",
    "name",
    "image",
    "category",
    "rarity",
    "hp",
    "types",
    "stage",
    "evolveFrom",
    "regulationMark",
    "illustrator",
  ];
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (value[key] !== undefined) picked[key] = value[key];
  }
  return picked;
}

function pill(text: string, kind = ""): string {
  return `<span class="pill${kind ? ` ${kind}` : ""}">${escapeHtml(text)}</span>`;
}

function li(text: string): string {
  return `<li>${escapeHtml(text)}</li>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(text: string): void {
  status.textContent = text;
}

function ms(started: number): string {
  return `${(performance.now() - started).toFixed(0)} ms`;
}

decklist.value = SAMPLE_PTCGL;
