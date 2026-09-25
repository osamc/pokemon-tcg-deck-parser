import TCGdex, { Query } from "@tcgdex/sdk";
import { describe, expect, it } from "vitest";
import { TcgdexLookup } from "../src/tcgdex-lookup.js";

interface ListedCard {
  id: string;
  localId: string;
  name: string;
}

function fakeTcgdex(categories: Record<string, string>): {
  sdk: TCGdex;
  queries: string[];
  cardGets: string[];
} {
  const queries: string[] = [];
  const cardGets: string[] = [];
  const sdk = {
    getCache() {
      return {
        clear() {
          return true;
        },
      };
    },
    card: {
      async list(query?: Query): Promise<ListedCard[]> {
        const params = query?.params ?? [];
        queries.push(params.map((param) => `${param.key}=${param.value}`).join("&"));
        const idParam = params.find((param) => param.key === "id")?.value;
        const categoryParam = params.find((param) => param.key === "category")?.value;
        const ids = String(idParam ?? "").replace(/^eq:/, "").split("|").filter(Boolean);
        const category = String(categoryParam ?? "").replace(/^eq:/, "");
        return ids
          .filter((id) => categories[id] === category)
          .map((id) => ({ id, localId: id, name: id }));
      },
      async get(id: string) {
        cardGets.push(id);
        return null;
      },
    },
  } as unknown as TCGdex;

  return { sdk, queries, cardGets };
}

describe("TcgdexLookup.categoriesForIds", () => {
  it("checks every id with one filtered list query per category", async () => {
    const { sdk, queries, cardGets } = fakeTcgdex({
      "sv02-061": "Pokemon",
      "sv01-181": "Trainer",
      "sve-011": "Energy",
    });
    const lookup = new TcgdexLookup(sdk, 4);

    const categories = await lookup.categoriesForIds([
      "sv02-061",
      "sv01-181",
      "sv01-181",
      "sve-011",
    ]);

    expect(categories).toEqual(
      new Map([
        ["sv02-061", "pokemon"],
        ["sv01-181", "trainer"],
        ["sve-011", "energy"],
      ]),
    );
    expect(queries.sort()).toEqual([
      "id=eq:sv02-061|sv01-181|sve-011&category=eq:Energy",
      "id=eq:sv02-061|sv01-181|sve-011&category=eq:Pokemon",
      "id=eq:sv02-061|sv01-181|sve-011&category=eq:Trainer",
    ]);
    expect(cardGets).toEqual([]);
  });

  it("reuses cached categories and chunks long id lists", async () => {
    const ids = Array.from({ length: 41 }, (_, index) => `sv01-${index + 1}`);
    const categories = Object.fromEntries(ids.map((id) => [id, "Trainer"]));
    const { sdk, queries, cardGets } = fakeTcgdex(categories);
    const lookup = new TcgdexLookup(sdk, 4);

    const first = await lookup.categoriesForIds(ids);
    expect(first.size).toBe(41);
    expect(first.get("sv01-1")).toBe("trainer");
    expect(queries).toHaveLength(6);
    const pokemonQueries = queries.filter((query) => query.endsWith("category=eq:Pokemon"));
    expect(new Set(pokemonQueries)).toEqual(
      new Set([
        `id=eq:${ids.slice(0, 40).join("|")}&category=eq:Pokemon`,
        "id=eq:sv01-41&category=eq:Pokemon",
      ]),
    );
    expect(cardGets).toEqual([]);

    queries.length = 0;
    const second = await lookup.categoriesForIds(ids);
    expect(second.size).toBe(41);
    expect(queries).toEqual([]);
  });

  it("clearCache forces category lookups to run again", async () => {
    const { sdk, queries } = fakeTcgdex({
      "sv02-061": "Pokemon",
      "sv01-181": "Trainer",
    });
    const lookup = new TcgdexLookup(sdk, 4);

    await lookup.categoriesForIds(["sv02-061", "sv01-181"]);
    expect(queries).toHaveLength(3);

    queries.length = 0;
    await lookup.categoriesForIds(["sv02-061", "sv01-181"]);
    expect(queries).toEqual([]);

    lookup.clearCache();
    await lookup.categoriesForIds(["sv02-061", "sv01-181"]);
    expect(queries).toHaveLength(3);
  });
});

describe("TcgdexLookup.clearCache", () => {
  it("clears set and name caches so subsequent lookups refetch", async () => {
    const setGets: string[] = [];
    const nameQueries: string[] = [];
    const cacheClears: number[] = [];
    const sdk = {
      getCache() {
        return {
          clear() {
            cacheClears.push(1);
            return true;
          },
        };
      },
      set: {
        async get(id: string) {
          setGets.push(id);
          return {
            id,
            name: id,
            cards: [{ id: `${id}-1`, localId: "1", name: "Test" }],
          };
        },
      },
      card: {
        async list(query?: Query) {
          const name = query?.params.find((param) => param.key === "name")?.value;
          nameQueries.push(String(name ?? ""));
          return [{ id: "sv01-1", localId: "1", name: "Nest Ball" }];
        },
      },
    } as unknown as TCGdex;

    const lookup = new TcgdexLookup(sdk, 2);

    await lookup.getSet("sv01");
    await lookup.getSet("sv01");
    expect(setGets).toEqual(["sv01"]);

    await lookup.findCardsByName("Nest Ball");
    await lookup.findCardsByName("Nest Ball");
    expect(nameQueries).toEqual(["eq:Nest Ball"]);

    lookup.clearCache();
    expect(cacheClears).toEqual([1]);

    await lookup.getSet("sv01");
    await lookup.findCardsByName("Nest Ball");
    expect(setGets).toEqual(["sv01", "sv01"]);
    expect(nameQueries).toEqual(["eq:Nest Ball", "eq:Nest Ball"]);
  });
});
