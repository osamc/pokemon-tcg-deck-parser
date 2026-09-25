import TCGdex from "@tcgdex/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeckParser } from "../src/parser.js";

describe("DeckParser endpoint option", () => {
  const originalFetch = TCGdex.fetch;

  afterEach(() => {
    TCGdex.fetch = originalFetch;
  });

  it("uses the default TCGdex endpoint when none is given", () => {
    const tcgdex = new TCGdex("en");
    new DeckParser({ tcgdex });
    expect(tcgdex.getEndpoint()).toBe("https://api.tcgdex.net/v2");
  });

  it("applies a custom endpoint to a supplied SDK instance and strips trailing slashes", () => {
    const tcgdex = new TCGdex("en");
    new DeckParser({ tcgdex, endpoint: "https://tcgdex.example.com/v2/" });
    expect(tcgdex.getEndpoint()).toBe("https://tcgdex.example.com/v2");
  });

  it("rejects an empty endpoint", () => {
    expect(() => new DeckParser({ endpoint: "  " })).toThrow(/endpoint/);
  });

  it("sends requests to the custom endpoint", async () => {
    const urls: string[] = [];
    TCGdex.fetch = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    const parser = new DeckParser({ endpoint: "http://localhost:3000/v2/", lang: "fr" });
    await parser.parseAndResolve("1 Nest Ball SVI 181");

    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url.startsWith("http://localhost:3000/v2/fr/")).toBe(true);
    }
  });
});

describe("DeckParser.clearCache", () => {
  it("clears the TCGdex SDK cache for a shared client", () => {
    const tcgdex = new TCGdex("en");
    tcgdex.getCache().set("probe", { ok: true }, 60);
    expect(tcgdex.getCache().has("probe")).toBe(true);

    const parser = new DeckParser({ tcgdex });
    parser.clearCache();

    expect(tcgdex.getCache().has("probe")).toBe(false);
  });
});

describe("DeckParser letter collector numbers", () => {
  it("resolves Unown UF M via tcgdex.giantstump.com", async () => {
    const parser = new DeckParser({
      endpoint: "https://tcgdex.giantstump.com/v2",
      cacheTTL: 0,
    });

    const resolved = await parser.parseAndResolve("1 Unown UF M", {
      format: "limitless",
    });

    expect(resolved.unresolved).toHaveLength(0);
    expect(resolved.cards[0]).toMatchObject({
      name: "Unown",
      setCode: "UF",
      number: "M",
      tcgdexId: expect.stringMatching(/m$/i),
    });
    expect(resolved.cards[0]?.card).toBeDefined();
  }, 30_000);
});
