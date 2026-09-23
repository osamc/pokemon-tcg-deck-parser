import { describe, expect, it } from "vitest";
import { exportDecklist } from "../src/export.js";
import { parseDecklist } from "../src/parse.js";
import { DeckParser } from "../src/parser.js";

const PTCGL = `Pokémon: 3
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

const LIMITLESS = `Pokémon: 13
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

function cardFields(text: string, format?: "ptcgl" | "limitless") {
  return parseDecklist(text, format ? { format } : {}).cards.map((card) => ({
    quantity: card.quantity,
    name: card.name,
    setCode: card.setCode,
    number: card.number,
    foil: card.foil,
    category: card.category,
  }));
}

describe("exportDecklist", () => {
  it("writes a PTCGL list that parses back to the same cards", () => {
    const parsed = parseDecklist(PTCGL, { format: "ptcgl" });
    const exported = exportDecklist(parsed);
    expect(exported).toBe(`Pokémon: 6
3 Chien-Pao ex PAL 61
2 Greninja ex TWM 106
1 Mew ex MEW 193
Trainer: 7
4 Nest Ball SVI 181
1 Switch SVI 194 PH
2 Iono PAL 254
Energy: 14
1 Basic {W} Energy Energy 38 PH
11 Basic {W} Energy Energy 29
2 Basic {W} Energy SVE 11 PH
Total Cards: 27`);
    expect(cardFields(exported, "ptcgl")).toEqual(cardFields(PTCGL, "ptcgl"));
    expect(parseDecklist(exported).format).toBe("ptcgl");
  });

  it("writes a Limitless list that parses back to the same cards", () => {
    const parsed = parseDecklist(LIMITLESS, { format: "limitless" });
    const exported = exportDecklist(parsed);
    expect(exported).toBe(`Pokémon: 13
3 Charcadet SSP 32
1 Charcadet PAR 26
3 Ceruledge ex SSP 36
2 Solrock MEG 75
2 Lunatone MEG 74
1 Squawkabilly ex PAL 169
1 Fezandipiti ex SFA 38
Trainer: 16
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
1 Legacy Energy TWM 167`);
    expect(cardFields(exported, "limitless")).toEqual(cardFields(LIMITLESS, "limitless"));
    expect(parseDecklist(exported).format).toBe("limitless");
  });

  it("can rewrite a parsed deck in the other format", () => {
    const parsed = parseDecklist(PTCGL, { format: "ptcgl" });
    const asLimitless = exportDecklist(parsed, { format: "limitless" });
    expect(asLimitless).toContain("1 Water Energy Energy 38 PH");
    expect(asLimitless).not.toContain("Total Cards:");
    expect(asLimitless).not.toContain("{W}");
    expect(cardFields(asLimitless, "limitless").map((card) => card.name)).toContain("Water Energy");

    const limitless = parseDecklist(LIMITLESS, { format: "limitless" });
    const asPtcgl = exportDecklist(limitless, { format: "ptcgl" });
    expect(asPtcgl).toContain("10 Basic {F} Energy SVE 22");
    expect(asPtcgl).toContain("2 Jet Energy PAL 190");
    expect(asPtcgl.endsWith("Total Cards: 49")).toBe(true);
  });

  it("leaves name-only rows unsectioned and files energy trainers", () => {
    expect(exportDecklist(parseDecklist("4 Iono\n2 Nest Ball"), { format: "limitless" })).toBe(
      "4 Iono\n2 Nest Ball",
    );
    expect(exportDecklist(parseDecklist("4 Energy Switch\n2 Jet Energy PAL 190"), { format: "ptcgl" }))
      .toBe(`Trainer: 4
4 Energy Switch
Energy: 2
2 Jet Energy PAL 190
Total Cards: 6`);
  });

  it("requires a format when the deck has none", () => {
    expect(() => exportDecklist({ cards: [{ quantity: 1, name: "Iono" }] })).toThrow(/format/);
  });

  it("is available on DeckParser", () => {
    const parser = new DeckParser();
    const parsed = parser.parse("4 Nest Ball SVI 181");
    expect(parser.export(parsed, { format: "limitless" })).toBe("4 Nest Ball SVI 181");
  });
});
