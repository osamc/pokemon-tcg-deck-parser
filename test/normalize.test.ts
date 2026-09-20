import { describe, expect, it } from "vitest";
import { energyDisplayNames, expandEnergyShorthand, isBasicEnergyName } from "../src/energy.js";
import { localIdCandidates, namesMatch } from "../src/normalize.js";

describe("energy", () => {
  it("expands PTCGL energy shorthand", () => {
    expect(expandEnergyShorthand("Basic {W} Energy")).toBe("Basic Water Energy");
  });

  it("offers TCGdex-style energy names", () => {
    expect(energyDisplayNames("Basic {W} Energy")).toEqual(
      expect.arrayContaining(["Basic Water Energy", "Water Energy"]),
    );
  });

  it("detects basic energy names", () => {
    expect(isBasicEnergyName("Fighting Energy")).toBe(true);
    expect(isBasicEnergyName("Nest Ball")).toBe(false);
  });
});

describe("normalize", () => {
  it("treats curly apostrophes as equal", () => {
    expect(namesMatch("Boss's Orders", "Boss’s Orders")).toBe(true);
  });

  it("builds local ID candidates with padding", () => {
    expect(localIdCandidates("11", "sve")).toEqual(
      expect.arrayContaining(["11", "011"]),
    );
  });

  it("builds SWSH promo local IDs", () => {
    expect(localIdCandidates("098", "swshp")).toEqual(
      expect.arrayContaining(["SWSH098", "SWSH98", "098"]),
    );
  });
});
