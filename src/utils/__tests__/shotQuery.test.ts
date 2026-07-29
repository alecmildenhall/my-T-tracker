import { describe, it, expect } from "vitest";
import {
  filterShots,
  searchShotText,
  sortShots,
  takeRecent,
  paginate,
  queryShots,
} from "../shotQuery";
import { toCivilDate, type CivilDate } from "../civilDate";
import type { ShotEntry } from "../../types/shot";

const cd = (s: string): CivilDate => toCivilDate(s)!;

let seq = 0;
const shot = (over: Partial<ShotEntry> = {}): ShotEntry => ({
  id: `id-${seq++}`,
  date: "2026-07-14",
  ...over,
});

describe("filterShots", () => {
  it("returns every shot when the filter is empty or absent", () => {
    const shots = [shot(), shot(), shot()];
    expect(filterShots(shots)).toHaveLength(3);
    expect(filterShots(shots, {})).toHaveLength(3);
  });

  it("treats a blank facet value as no constraint (like the 'Any' UI option)", () => {
    const shots = [
      shot({ date: "2026-07-01", injectionSite: "thigh" }),
      shot({ date: "2026-07-20", injectionSite: "glute" }),
    ];
    // "" is how a filter <select>'s "Any" option is conventionally bound — it
    // must NOT collapse the list the way a real constraint would.
    expect(
      filterShots(shots, {
        dateFrom: "" as unknown as CivilDate,
        dateTo: "" as unknown as CivilDate,
        site: "",
        position: "  ",
        ester: "",
      })
    ).toHaveLength(2);
  });

  it("keeps shots within an inclusive date range", () => {
    const shots = [
      shot({ date: "2026-07-01" }),
      shot({ date: "2026-07-15" }),
      shot({ date: "2026-07-31" }),
    ];
    const out = filterShots(shots, { dateFrom: cd("2026-07-15"), dateTo: cd("2026-07-31") });
    expect(out.map((s) => s.date)).toEqual(["2026-07-15", "2026-07-31"]);
  });

  it("applies each date bound independently", () => {
    const shots = [shot({ date: "2026-06-30" }), shot({ date: "2026-07-15" })];
    expect(filterShots(shots, { dateFrom: cd("2026-07-01") }).map((s) => s.date)).toEqual([
      "2026-07-15",
    ]);
    expect(filterShots(shots, { dateTo: cd("2026-07-01") }).map((s) => s.date)).toEqual([
      "2026-06-30",
    ]);
  });

  it("matches site/position/ester case-insensitively and trims", () => {
    const s = shot({
      injectionSite: "Thigh",
      injectionSitePosition: "Left",
      testosteroneEster: "Cypionate",
    });
    const shots = [s, shot({ injectionSite: "glute" })];
    expect(filterShots(shots, { site: "  thigh " })).toEqual([s]);
    expect(filterShots(shots, { position: "LEFT" })).toEqual([s]);
    expect(filterShots(shots, { ester: "cypionate" })).toEqual([s]);
  });

  it("excludes shots missing the facet being filtered", () => {
    const withSite = shot({ injectionSite: "thigh" });
    const noSite = shot({ injectionSite: undefined });
    expect(filterShots([withSite, noSite], { site: "thigh" })).toEqual([withSite]);
  });

  it("filters an inclusive pain band and excludes shots with no pain score", () => {
    const shots = [
      shot({ painScore: 0 }),
      shot({ painScore: 3 }),
      shot({ painScore: 7 }),
      shot({ painScore: undefined }),
    ];
    const out = filterShots(shots, { painMin: 3, painMax: 7 });
    expect(out.map((s) => s.painScore)).toEqual([3, 7]);
    // A legitimate 0 is included when the band allows it.
    expect(filterShots(shots, { painMax: 0 }).map((s) => s.painScore)).toEqual([0]);
  });

  it("treats a NaN pain bound as no constraint (empty number input's valueAsNumber)", () => {
    const shots = [shot({ painScore: 2 }), shot({ painScore: 8 }), shot({ painScore: undefined })];
    // An empty <input type="number">.valueAsNumber is NaN. A NaN bound must not
    // silently pass everything via `x < NaN` — it's "no constraint", so all shots
    // (including the pain-less one) come through.
    expect(filterShots(shots, { painMin: NaN })).toHaveLength(3);
    expect(filterShots(shots, { painMax: Number("x") })).toHaveLength(3);
  });

  it("ANDs across facets", () => {
    const match = shot({ date: "2026-07-10", injectionSite: "thigh", painScore: 2 });
    const wrongSite = shot({ date: "2026-07-10", injectionSite: "glute", painScore: 2 });
    const out = filterShots([match, wrongSite], {
      dateFrom: cd("2026-07-01"),
      site: "thigh",
      painMax: 5,
    });
    expect(out).toEqual([match]);
  });
});

describe("searchShotText", () => {
  it("returns all shots for a blank query", () => {
    const shots = [shot({ notes: "sore" }), shot()];
    expect(searchShotText(shots, "")).toHaveLength(2);
    expect(searchShotText(shots, "   ")).toHaveLength(2);
  });

  it("matches notes and mood case-insensitively as a substring", () => {
    const inNotes = shot({ notes: "A bit Sore afterward" });
    const inMood = shot({ mood: "Anxious" });
    const neither = shot({ notes: "fine", mood: "good" });
    const shots = [inNotes, inMood, neither];
    expect(searchShotText(shots, "sore")).toEqual([inNotes]);
    expect(searchShotText(shots, "anx")).toEqual([inMood]);
  });

  it("does not match structured fields, only free text", () => {
    const shots = [shot({ injectionSite: "thigh", testosteroneEster: "cypionate" })];
    expect(searchShotText(shots, "thigh")).toEqual([]);
  });
});

describe("sortShots", () => {
  it("defaults to newest-first", () => {
    const a = shot({ date: "2026-07-01" });
    const b = shot({ date: "2026-07-20" });
    expect(sortShots([a, b]).map((s) => s.date)).toEqual(["2026-07-20", "2026-07-01"]);
  });

  it("orders oldest-first when asked", () => {
    const a = shot({ date: "2026-07-01" });
    const b = shot({ date: "2026-07-20" });
    expect(sortShots([b, a], "oldest").map((s) => s.date)).toEqual([
      "2026-07-01",
      "2026-07-20",
    ]);
  });

  it("does not mutate its input", () => {
    const shots = [shot({ date: "2026-07-01" }), shot({ date: "2026-07-20" })];
    const before = shots.map((s) => s.date);
    sortShots(shots);
    expect(shots.map((s) => s.date)).toEqual(before);
  });
});

describe("takeRecent", () => {
  it("returns the newest n shots", () => {
    const shots = [
      shot({ date: "2026-07-01" }),
      shot({ date: "2026-07-10" }),
      shot({ date: "2026-07-20" }),
    ];
    expect(takeRecent(shots, 2).map((s) => s.date)).toEqual(["2026-07-20", "2026-07-10"]);
  });

  it("returns [] for n <= 0 and all shots when n exceeds the count", () => {
    const shots = [shot(), shot()];
    expect(takeRecent(shots, 0)).toEqual([]);
    expect(takeRecent(shots, -1)).toEqual([]);
    expect(takeRecent(shots, 5)).toHaveLength(2);
  });
});

describe("paginate", () => {
  it("returns everything with hasMore false when no page is given", () => {
    const shots = [shot(), shot(), shot()];
    const page = paginate(shots);
    expect(page.items).toHaveLength(3);
    expect(page.total).toBe(3);
    expect(page.hasMore).toBe(false);
    // Fresh array, not the caller's reference — mutating items never touches source.
    expect(page.items).not.toBe(shots);
  });

  it("slices a window and reports more remaining", () => {
    const shots = [shot(), shot(), shot(), shot(), shot()];
    const page = paginate(shots, { offset: 0, limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(5);
    expect(page.hasMore).toBe(true);
  });

  it("reports hasMore false on the last window", () => {
    const shots = [shot(), shot(), shot()];
    const page = paginate(shots, { offset: 2, limit: 2 });
    expect(page.items).toHaveLength(1);
    expect(page.hasMore).toBe(false);
  });

  it("clamps a negative offset and non-positive limit", () => {
    const shots = [shot(), shot()];
    expect(paginate(shots, { offset: -5, limit: 1 }).items).toHaveLength(1);
    // A zero-width window makes no progress, so hasMore is false even though
    // shots remain — reporting "more" would strand a "Load more" that advances
    // by limit.
    const none = paginate(shots, { offset: 0, limit: 0 });
    expect(none.items).toEqual([]);
    expect(none.hasMore).toBe(false);
  });
});

describe("queryShots", () => {
  it("returns all shots newest-first for an empty query", () => {
    const a = shot({ date: "2026-07-01" });
    const b = shot({ date: "2026-07-20" });
    const page = queryShots([a, b]);
    expect(page.items.map((s) => s.date)).toEqual(["2026-07-20", "2026-07-01"]);
    expect(page.total).toBe(2);
    expect(page.hasMore).toBe(false);
  });

  it("composes filter → search → sort → paginate with total before pagination", () => {
    const shots = [
      shot({ date: "2026-07-01", injectionSite: "thigh", notes: "sore" }),
      shot({ date: "2026-07-10", injectionSite: "thigh", notes: "sore spot" }),
      shot({ date: "2026-07-20", injectionSite: "glute", notes: "sore" }),
      shot({ date: "2026-07-25", injectionSite: "thigh", notes: "fine" }),
    ];
    const page = queryShots(shots, {
      filter: { site: "thigh" },
      text: "sore",
      sort: "oldest",
      page: { offset: 0, limit: 1 },
    });
    // thigh + "sore" matches two shots; oldest-first, first page of one.
    expect(page.items.map((s) => s.date)).toEqual(["2026-07-01"]);
    expect(page.total).toBe(2);
    expect(page.hasMore).toBe(true);
  });
});
