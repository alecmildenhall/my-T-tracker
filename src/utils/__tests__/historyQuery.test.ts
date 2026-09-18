import { describe, it, expect } from "vitest";
import {
  LUMP_BANDS,
  SORENESS_BANDS,
  countActiveFacets,
  emptyHistoryQuery,
  withLumpBand,
  withSorenessBand,
} from "../historyQuery";
import { SORENESS_DURATIONS } from "../../types/shot";
import { sorenessLabel } from "../soreness";

describe("SORENESS_BANDS", () => {
  it("derives its options from the enum the log sheet uses", () => {
    // One source for the vocabulary, so a filter can never drift from the
    // question. The same reason PAIN_BANDS and OFF_DAYS_BANDS are derived.
    expect(SORENESS_BANDS.map((b) => b.id)).toEqual([...SORENESS_DURATIONS]);
  });

  it("labels them with the standalone wording", () => {
    // In a filter there is no question above the control to supply the frame,
    // so "Several days" alone would be several days of what.
    expect(SORENESS_BANDS.map((b) => b.label)).toEqual(
      SORENESS_DURATIONS.map(sorenessLabel),
    );
  });
});

describe("withSorenessBand", () => {
  it("applies a recognised duration", () => {
    const q = withSorenessBand(emptyHistoryQuery, "several-days");
    expect(q.filter.afterSoreness).toBe("several-days");
  });

  it("clears the facet for 'Any' or anything unrecognised", () => {
    // Validated rather than cast: the <select> hands over a raw string, and an
    // unknown one must switch the facet OFF rather than filter on a value no
    // shot can hold.
    const applied = withSorenessBand(emptyHistoryQuery, "week-plus");
    expect(withSorenessBand(applied, "").filter.afterSoreness).toBeUndefined();
    expect(
      withSorenessBand(applied, "ages").filter.afterSoreness,
    ).toBeUndefined();
  });
});

describe("withLumpBand", () => {
  it("maps the select's strings onto the stored boolean", () => {
    expect(withLumpBand(emptyHistoryQuery, "yes").filter.afterLump).toBe(true);
    expect(withLumpBand(emptyHistoryQuery, "no").filter.afterLump).toBe(false);
  });

  it("clears the facet for 'Any' or anything unrecognised", () => {
    // A LOOKUP, not `id === "yes"`. That shorthand would make every
    // unrecognised value mean "no lump" — a filter nobody asked for, silently.
    const applied = withLumpBand(emptyHistoryQuery, "yes");
    expect(withLumpBand(applied, "").filter.afterLump).toBeUndefined();
    expect(withLumpBand(applied, "maybe").filter.afterLump).toBeUndefined();
  });

  it("keeps one mapping for the select and the store", () => {
    expect(LUMP_BANDS.map((b) => [b.id, b.value])).toEqual([
      ["yes", true],
      ["no", false],
    ]);
  });
});

describe("countActiveFacets", () => {
  it("counts a soreness facet", () => {
    expect(countActiveFacets(withSorenessBand(emptyHistoryQuery, "none"))).toBe(1);
  });

  it("counts a lump facet set to 'No'", () => {
    // `false` is an active facet. The generic `v !== undefined && v !== ""`
    // test drops it, and a badge reading one short is how a narrowed list
    // starts looking like an inexplicably short one.
    expect(countActiveFacets(withLumpBand(emptyHistoryQuery, "no"))).toBe(1);
    expect(countActiveFacets(withLumpBand(emptyHistoryQuery, "yes"))).toBe(1);
  });

  it("counts both new facets alongside the existing ones", () => {
    const q = withLumpBand(
      withSorenessBand({ ...emptyHistoryQuery, filter: { pain: "mild" } }, "week-plus"),
      "no",
    );
    expect(countActiveFacets(q)).toBe(3);
  });

  it("counts nothing on an empty query", () => {
    expect(countActiveFacets(emptyHistoryQuery)).toBe(0);
  });
});
