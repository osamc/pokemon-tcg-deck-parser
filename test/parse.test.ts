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

  it("keeps Energy-named trainers as trainers, not energy cards", () => {
    const parsed = parseDecklist(`Trainer: 6
4 Energy Switch SVI 194
4 Energy Retrieval SVI 171
2 Energy Removal 2 CES 140
4 Energy Search SSH 165
2 Super Energy Retrieval PAL 189
1 Super Energy Removal 2 UNB 168
Energy: 3
2 Jet Energy PAL 190
11 Basic {W} Energy Energy 29`);

    const trainers = parsed.cards.filter((card) => card.category === "trainer");
    expect(trainers.map((card) => card.name)).toEqual([
      "Energy Switch",
      "Energy Retrieval",
      "Energy Removal 2",
      "Energy Search",
      "Super Energy Retrieval",
      "Super Energy Removal 2",
    ]);
    expect(trainers.every((card) => card.category === "trainer")).toBe(true);

    expect(parsed.cards.find((card) => card.name === "Energy Switch")).toMatchObject({
      setCode: "SVI",
      number: "194",
      category: "trainer",
    });
    expect(parsed.cards.find((card) => card.name === "Energy Removal 2")).toMatchObject({
      setCode: "CES",
      number: "140",
      category: "trainer",
    });
    expect(parsed.cards.find((card) => card.name === "Jet Energy")).toMatchObject({
      category: "energy",
      setCode: "PAL",
      number: "190",
    });
    expect(parsed.cards.find((card) => card.name === "Basic Water Energy")).toMatchObject({
      category: "energy",
      setCode: "Energy",
      number: "29",
    });
  });

  it("infers trainer vs energy from the name when sections are missing", () => {
    const parsed = parseDecklist(`4 Energy Switch
4 Energy Retrieval
4 Energy Removal 2
4 Energy Search
2 Jet Energy
11 Basic {W} Energy Energy 29`);

    expect(parsed.cards.find((card) => card.name === "Energy Switch")).toMatchObject({
      category: "trainer",
      setCode: undefined,
      number: undefined,
    });
    expect(parsed.cards.find((card) => card.name === "Energy Retrieval")).toMatchObject({
      category: "trainer",
    });
    expect(parsed.cards.find((card) => card.name === "Energy Removal 2")).toMatchObject({
      name: "Energy Removal 2",
      category: "trainer",
      setCode: undefined,
      number: undefined,
    });
    expect(parsed.cards.find((card) => card.name === "Energy Search")).toMatchObject({
      category: "trainer",
    });
    expect(parsed.cards.find((card) => card.name === "Jet Energy")?.category).toBe("energy");
    expect(parsed.cards.find((card) => card.name === "Basic Water Energy")?.category).toBe("energy");
  });

  it("parses letter collector numbers used by Unown prints", () => {
    expect(parseDecklist("1 Unown UF M", { format: "limitless" }).cards[0]).toMatchObject({
      quantity: 1,
      name: "Unown",
      setCode: "UF",
      number: "M",
    });
    expect(parseDecklist("1 Unown UF !").cards[0]).toMatchObject({
      name: "Unown",
      setCode: "UF",
      number: "!",
    });
    expect(parseDecklist("1 Unown UF ?").cards[0]).toMatchObject({
      name: "Unown",
      setCode: "UF",
      number: "?",
    });
  });

  it("does not treat name suffixes like ex as collector numbers", () => {
    expect(parseDecklist("1 Mew ex").cards[0]).toMatchObject({
      name: "Mew ex",
      setCode: undefined,
      number: undefined,
    });
    expect(parseDecklist("1 Pikachu V").cards[0]).toMatchObject({
      name: "Pikachu V",
      setCode: undefined,
      number: undefined,
    });
  });

  it("does not treat Switch or Removal as set codes on Energy trainers", () => {
    expect(parseDecklist("4 Energy Switch 194").cards[0]).toMatchObject({
      name: "Energy Switch",
      number: "194",
      setCode: undefined,
      category: "trainer",
    });
    expect(parseDecklist("4 ENERGY SWITCH 194").cards[0]).toMatchObject({
      name: "ENERGY SWITCH",
      number: "194",
      setCode: undefined,
      category: "trainer",
    });
    expect(parseDecklist("4 Energy Removal 2").cards[0]).toMatchObject({
      name: "Energy Removal 2",
      setCode: undefined,
      number: undefined,
      category: "trainer",
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
