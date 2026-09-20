import { describe, expect, it } from "vitest";
import { parseDecklist } from "../src/parse.js";
import { resolveDeck } from "../src/resolve.js";
import type { CardLookup, CardResumeLike, SetLike } from "../src/types.js";

function resume(partial: CardResumeLike): CardResumeLike {
  return partial;
}

function mockLookup(sets: SetLike[], names: Record<string, CardResumeLike[]> = {}): CardLookup {
  const byId = new Map(sets.map((set) => [set.id, set]));
  const codeIndex = new Map<string, string[]>();
  for (const set of sets) {
    const codes = [set.id.toUpperCase(), set.abbreviation?.official?.toUpperCase(), set.tcgOnline?.toUpperCase()].filter(
      (code): code is string => Boolean(code),
    );
    for (const code of codes) {
      const current = codeIndex.get(code) ?? [];
      if (!current.includes(set.id)) current.push(set.id);
      codeIndex.set(code, current);
    }
  }

  return {
    async resolveSetCodes(codes) {
      const result = new Map<string, string[]>();
      for (const code of codes) {
        result.set(code.toUpperCase(), codeIndex.get(code.toUpperCase()) ?? []);
      }
      return result;
    },
    async getSet(id) {
      return byId.get(id) ?? [...byId.values()].find((set) => set.id.toLowerCase() === id.toLowerCase());
    },
    async getCard(id) {
      for (const set of sets) {
        const card = set.cards.find((item) => item.id === id);
        if (card) return { ...card, category: "Pokemon" } as never;
      }
      return undefined;
    },
    async findCardsByName(name) {
      return names[name] ?? [];
    },
  };
}

describe("resolveDeck", () => {
  it("matches cards from unique sets without per-card fetches", async () => {
    const parsed = parseDecklist(`Pokémon: 2
3 Chien-Pao ex PAL 61
1 Nest Ball SVI 181`);

    const lookup = mockLookup([
      {
        id: "sv02",
        name: "Paldea Evolved",
        abbreviation: { official: "PAL" },
        cards: [resume({ id: "sv02-061", localId: "061", name: "Chien-Pao ex" })],
      },
      {
        id: "sv01",
        name: "Scarlet & Violet",
        abbreviation: { official: "SVI" },
        cards: [resume({ id: "sv01-181", localId: "181", name: "Nest Ball" })],
      },
    ]);

    const resolved = await resolveDeck(parsed, lookup);
    expect(resolved.unresolved).toHaveLength(0);
    expect(resolved.cards[0]).toMatchObject({
      quantity: 3,
      tcgdexId: "sv02-061",
      setId: "sv02",
    });
    expect(resolved.cards[1]?.tcgdexId).toBe("sv01-181");
  });

  it("resolves Energy-named trainers by their real name, not as Energy cards", async () => {
    const parsed = parseDecklist(`4 Energy Switch SVI 194
4 Energy Retrieval SVI 171
2 Energy Removal 2 CES 140
4 Energy Switch 194`);

    const lookup = mockLookup(
      [
        {
          id: "sv01",
          name: "Scarlet & Violet",
          abbreviation: { official: "SVI" },
          cards: [
            resume({ id: "sv01-194", localId: "194", name: "Energy Switch" }),
            resume({ id: "sv01-171", localId: "171", name: "Energy Retrieval" }),
            resume({ id: "sv01-011", localId: "011", name: "Water Energy" }),
          ],
        },
        {
          id: "sm7",
          name: "Celestial Storm",
          abbreviation: { official: "CES" },
          cards: [resume({ id: "sm7-140", localId: "140", name: "Energy Removal 2" })],
        },
      ],
      {
        Energy: [resume({ id: "sve-011", localId: "011", name: "Water Energy" })],
        "Energy Switch": [
          resume({ id: "sv01-194", localId: "194", name: "Energy Switch" }),
          resume({ id: "swsh1-129", localId: "129", name: "Energy Switch" }),
        ],
        "Energy Retrieval": [resume({ id: "sv01-171", localId: "171", name: "Energy Retrieval" })],
        "Energy Removal 2": [resume({ id: "sm7-140", localId: "140", name: "Energy Removal 2" })],
      },
    );

    const resolved = await resolveDeck(parsed, lookup);
    expect(resolved.unresolved).toHaveLength(0);
    expect(resolved.cards.map((card) => card.tcgdexId)).toEqual([
      "sv01-194",
      "sv01-171",
      "sm7-140",
      "sv01-194",
    ]);
    expect(resolved.cards.every((card) => card.category === "trainer")).toBe(true);
    expect(resolved.cards.every((card) => card.name !== "Energy" && card.name !== "Water Energy")).toBe(
      true,
    );
  });

  it("falls back to a name search for Energy-set basics", async () => {
    const parsed = parseDecklist("11 Basic {W} Energy Energy 29");
    const lookup = mockLookup([], {
      "Water Energy": [
        resume({ id: "tk-hs-g-29", localId: "29", name: "Water Energy" }),
        resume({ id: "mee-003", localId: "003", name: "Water Energy" }),
        resume({ id: "sve-011", localId: "011", name: "Water Energy" }),
      ],
      "Basic Water Energy": [],
    });

    const resolved = await resolveDeck(parsed, lookup);
    expect(resolved.cards[0]?.tcgdexId).toBe("sve-011");
    expect(resolved.unresolved).toHaveLength(0);
  });

  it("hydrates unique matched cards when requested", async () => {
    const parsed = parseDecklist("2 Chien-Pao ex PAL 61\n1 Chien-Pao ex PAL 61");
    const lookup = mockLookup([
      {
        id: "sv02",
        name: "Paldea Evolved",
        abbreviation: { official: "PAL" },
        cards: [resume({ id: "sv02-061", localId: "061", name: "Chien-Pao ex" })],
      },
    ]);

    const resolved = await resolveDeck(parsed, lookup, { hydrate: "full" });
    expect(resolved.cards).toHaveLength(2);
    expect(resolved.cards[0]?.card).toMatchObject({ id: "sv02-061" });
    expect(resolved.cards[1]?.card).toMatchObject({ id: "sv02-061" });
  });

  it("records ALT prints that cannot be resolved", async () => {
    const parsed = parseDecklist("1 Boss's Orders SWSHALT 127");
    const resolved = await resolveDeck(parsed, mockLookup([]));
    expect(resolved.unresolved).toHaveLength(1);
    expect(resolved.cards[0]?.unresolvedReason).toMatch(/ALT print/);
  });

  it("disambiguates RR between Rising Rivals and Team Rocket Returns", async () => {
    const parsed = parseDecklist(`Pokémon: 3
1 Rocket's Admin. RR 86
1 Weedle RR 86
1 Dark Crobat TRR 3`);

    const lookup = mockLookup([
      {
        id: "pl2",
        name: "Rising Rivals",
        abbreviation: { official: "RR" },
        tcgOnline: "RR",
        cards: [resume({ id: "pl2-86", localId: "86", name: "Weedle" })],
      },
      {
        id: "ex7",
        name: "Team Rocket Returns",
        abbreviation: { official: "TR" },
        tcgOnline: "RR",
        cards: [
          resume({ id: "ex7-86", localId: "86", name: "Rocket's Admin." }),
          resume({ id: "ex7-3", localId: "3", name: "Dark Crobat" }),
        ],
      },
    ]);

    const resolved = await resolveDeck(parsed, lookup);
    expect(resolved.unresolved).toHaveLength(0);
    expect(resolved.cards[0]?.tcgdexId).toBe("ex7-86");
    expect(resolved.cards[1]?.tcgdexId).toBe("pl2-86");
    expect(resolved.cards[2]?.tcgdexId).toBe("ex7-3");
  });
});
