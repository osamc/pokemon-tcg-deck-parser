import { describe, expect, it } from "vitest";
import { detectFormat, parseDecklist } from "../src/parse.js";

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

describe("parseDecklist", () => {
  it("parses a PTCGL export", () => {
    const parsed = parseDecklist(PTCGL, { format: "ptcgl" });
    expect(parsed.format).toBe("ptcgl");
    expect(parsed.declaredTotal).toBe(27);
    expect(parsed.totalCards).toBe(27);
    expect(parsed.sectionCounts).toEqual({ pokemon: 3, trainer: 3, energy: 3 });

    const chienPao = parsed.cards.find((card) => card.name === "Chien-Pao ex");
    expect(chienPao).toMatchObject({
      quantity: 3,
      setCode: "PAL",
      number: "61",
      category: "pokemon",
    });

    const holoSwitch = parsed.cards.find(
      (card) => card.name === "Switch" && card.setCode === "SVI" && card.foil === "PH",
    );
    expect(holoSwitch?.quantity).toBe(1);

    const energy = parsed.cards.filter((card) => card.category === "energy");
    expect(energy).toHaveLength(3);
    expect(energy[0]).toMatchObject({
      name: "Basic Water Energy",
      setCode: "Energy",
      number: "38",
      foil: "PH",
    });
    expect(energy[2]).toMatchObject({
      name: "Basic Water Energy",
      setCode: "SVE",
      number: "11",
    });
  });

  it("parses a Limitless export", () => {
    const parsed = parseDecklist(LIMITLESS, { format: "limitless" });
    expect(parsed.format).toBe("limitless");
    expect(parsed.totalCards).toBe(49);
    expect(parsed.cards.find((card) => card.name === "Fighting Energy")).toMatchObject({
      quantity: 10,
      setCode: "SVE",
      number: "22",
      category: "energy",
    });
    expect(parsed.cards.find((card) => card.name === "Boss's Orders")).toMatchObject({
      setCode: "MEG",
      number: "114",
    });
  });

  it("parses name-only lines", () => {
    const parsed = parseDecklist("4 Iono\n2 Nest Ball");
    expect(parsed.cards).toEqual([
      expect.objectContaining({ quantity: 4, name: "Iono", setCode: undefined }),
      expect.objectContaining({ quantity: 2, name: "Nest Ball" }),
    ]);
  });

  it("parses 4x quantity prefixes", () => {
    const parsed = parseDecklist("4x Rare Candy SVI 191");
    expect(parsed.cards[0]).toMatchObject({
      quantity: 4,
      name: "Rare Candy",
      setCode: "SVI",
      number: "191",
    });
  });
});

describe("detectFormat", () => {
  it("detects PTCGL from energy markup and Total Cards", () => {
    expect(detectFormat(PTCGL)).toBe("ptcgl");
  });

  it("detects Limitless copy-as-text", () => {
    expect(detectFormat(LIMITLESS)).toBe("limitless");
  });

  it("returns unknown for empty text", () => {
    expect(detectFormat("hello world")).toBe("unknown");
  });
});
