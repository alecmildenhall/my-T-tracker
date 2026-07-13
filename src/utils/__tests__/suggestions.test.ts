import { describe, it, expect } from "vitest";
import { suggestionsFor, valueGroupsFor } from "../suggestions";
import type { ShotEntry } from "../../types/shot";

let counter = 0;
const shot = (over: Partial<ShotEntry>): ShotEntry => ({
  id: `shot-${counter++}`,
  date: "2026-07-12",
  ...over,
});

describe("suggestionsFor", () => {
  it("returns an empty array when there are no shots", () => {
    expect(suggestionsFor([], "mood")).toEqual([]);
  });

  it("ignores empty, whitespace-only, and missing values", () => {
    const shots = [
      shot({ carrierOil: "cottonseed" }),
      shot({ carrierOil: "   " }),
      shot({ carrierOil: "" }),
      shot({}), // undefined
    ];
    expect(suggestionsFor(shots, "carrierOil")).toEqual(["cottonseed"]);
  });

  it("dedupes case-insensitively and trimmed, keeping the most recent display form", () => {
    const shots = [
      shot({ testosteroneEster: "Cypionate" }),
      shot({ testosteroneEster: "cypionate " }),
      shot({ testosteroneEster: "CYPIONATE" }),
    ];
    expect(suggestionsFor(shots, "testosteroneEster")).toEqual(["CYPIONATE"]);
  });

  it("orders by most recently used first", () => {
    const shots = [
      shot({ injectionSite: "thigh" }),
      shot({ injectionSite: "glute" }),
      shot({ injectionSite: "thigh" }),
      shot({ injectionSite: "stomach" }),
    ];
    // by last use: stomach (idx 3), thigh (idx 2), glute (idx 1)
    expect(suggestionsFor(shots, "injectionSite")).toEqual([
      "stomach",
      "thigh",
      "glute",
    ]);
  });

  it("promotes a value to the front when it is used again", () => {
    const shots = [
      shot({ carrierOil: "sesame" }),
      shot({ carrierOil: "cottonseed" }),
      shot({ carrierOil: "sesame" }), // re-used, now the most recent
    ];
    expect(suggestionsFor(shots, "carrierOil")).toEqual(["sesame", "cottonseed"]);
  });

  it("stringifies numeric fields like doseMg and dedupes equal numbers", () => {
    const shots = [
      shot({ doseMg: 50 }),
      shot({ doseMg: 50 }),
      shot({ doseMg: 40 }),
    ];
    // 40 is most recent (idx 2); 50 was last used at idx 1
    expect(suggestionsFor(shots, "doseMg")).toEqual(["40", "50"]);
  });

  it("only reads the requested field", () => {
    const shots = [shot({ injectionSite: "thigh", carrierOil: "sesame" })];
    expect(suggestionsFor(shots, "injectionSite")).toEqual(["thigh"]);
    expect(suggestionsFor(shots, "carrierOil")).toEqual(["sesame"]);
    expect(suggestionsFor(shots, "testosteroneEster")).toEqual([]);
  });
});

describe("valueGroupsFor", () => {
  it("counts distinct values, most-used first then alphabetical", () => {
    const shots = [
      shot({ injectionSite: "thigh" }),
      shot({ injectionSite: "glute" }),
      shot({ injectionSite: "thigh" }),
      shot({ injectionSite: "abdomen" }),
    ];
    expect(valueGroupsFor(shots, "injectionSite")).toEqual([
      { value: "thigh", count: 2 },
      { value: "abdomen", count: 1 },
      { value: "glute", count: 1 },
    ]);
  });

  it("folds case/whitespace variants into one counted group", () => {
    const shots = [
      shot({ testosteroneEster: "Cypionate" }),
      shot({ testosteroneEster: "cypionate " }),
      shot({ testosteroneEster: "test cyp" }),
    ];
    expect(valueGroupsFor(shots, "testosteroneEster")).toEqual([
      { value: "cypionate", count: 2 },
      { value: "test cyp", count: 1 },
    ]);
  });
});
