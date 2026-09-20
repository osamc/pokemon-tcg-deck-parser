import { describe, expect, it } from "vitest";
import {
  energyDisplayNames,
  expandEnergyShorthand,
  isBasicEnergyName,
  isEnergyCardName,
  isEnergyTrainerName,
  isNumberedEnergyTrainerName,
  useEnergyFallback,
} from "../src/energy.js";
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

  it("does not treat Energy-named trainers as energy cards", () => {
    for (const name of [
      "Energy Switch",
      "Energy Retrieval",
      "Energy Removal 2",
      "Energy Search",
      "Super Energy Retrieval",
      "Superior Energy Retrieval",
    ]) {
      expect(isEnergyCardName(name)).toBe(false);
      expect(isEnergyTrainerName(name)).toBe(true);
      expect(isBasicEnergyName(name)).toBe(false);
      expect(useEnergyFallback(name, "Energy")).toBe(false);
      expect(useEnergyFallback(name, "SVI")).toBe(false);
    }

    expect(isEnergyCardName("Jet Energy")).toBe(true);
    expect(isEnergyCardName("Water Energy")).toBe(true);
    expect(isEnergyCardName("Basic {W} Energy")).toBe(true);
    expect(isEnergyTrainerName("Jet Energy")).toBe(false);
    expect(isNumberedEnergyTrainerName("Energy Removal 2")).toBe(true);
    expect(isNumberedEnergyTrainerName("Super Energy Removal 2")).toBe(true);
    expect(isNumberedEnergyTrainerName("Energy Switch")).toBe(false);
    expect(useEnergyFallback("Basic Water Energy", "Energy")).toBe(true);
    expect(useEnergyFallback("Jet Energy", "PAL")).toBe(false);
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
