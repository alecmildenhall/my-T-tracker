import { describe, it, expect } from "vitest";
import {
  SORENESS_FLOOR_DAYS,
  previousShotQuestions,
  settledQuestions,
  settledSummary,
  sorenessLabel,
  sorenessShortLabel,
} from "../soreness";
import { SORENESS_DURATIONS } from "../../types/shot";

const durations = (gap: number | null) =>
  previousShotQuestions(gap).durations;

describe("previousShotQuestions", () => {
  it("asks nothing when there is no previous shot", () => {
    // `null` is "unknown", which is what a first-ever shot reports. Asking how
    // a shot settled when there is no shot to ask about is the one case that
    // must render nothing at all rather than an empty group.
    expect(previousShotQuestions(null)).toEqual({ durations: [], lump: false });
  });

  it("has no upper bound — a long gap is asked about normally", () => {
    // This replaces a test that pinned `SORENESS_STALE_DAYS = 28`, deleted with
    // the bound itself. The caller now passes how many days have PASSED rather
    // than how long ago the shot was, and that value only ever grows — so a
    // cutoff on it meant the older a shot got, the less you were allowed to
    // record about it. Every case the bound still reached was one where the
    // person was best placed to answer and every duration was available.
    expect(previousShotQuestions(28)).toEqual(previousShotQuestions(7));
    expect(previousShotQuestions(400)).toEqual(previousShotQuestions(7));
    // Stated as a floor property rather than a literal, so this cannot pass by
    // everything collapsing to empty.
    expect(previousShotQuestions(400).durations).toHaveLength(4);
  });

  it("asks nothing at all about a same-day shot", () => {
    // A split dose is a real protocol, so this is reachable. "Has it absorbed?"
    // about a depot injected hours ago answers itself, and "yes" would chart as
    // a finding rather than the non-event it is.
    expect(previousShotQuestions(0)).toEqual({ durations: [], lump: false });
    // One day on it is a fair question again.
    expect(previousShotQuestions(1)).toEqual({ durations: [], lump: true });
  });

  it("asks only about the lump below the floor", () => {
    // Every duration needs three days before it can be judged — including
    // "Not sore", because soreness can start on day 2. The lump question has no
    // floor at all: "is there one now?" is answerable on any day, so a short
    // cadence still gets asked that one.
    for (let gap = 1; gap < SORENESS_FLOOR_DAYS; gap += 1) {
      expect(previousShotQuestions(gap)).toEqual({ durations: [], lump: true });
    }
  });

  it("withholds 'a week or more' until a week has passed", () => {
    // The answer is not wrong before then, it is UNANSWERABLE — and an answer
    // that cannot yet be true gets skipped or guessed.
    for (let gap = SORENESS_FLOOR_DAYS; gap < 7; gap += 1) {
      expect(durations(gap)).toEqual(["none", "day-or-two", "several-days"]);
    }
    expect(durations(7)).toEqual([...SORENESS_DURATIONS]);
    expect(durations(14)).toEqual([...SORENESS_DURATIONS]);
  });

  it("never rewords an answer, only withholds it", () => {
    // One vocabulary for everybody. An answer whose meaning depended on the
    // asker's cadence would be the overloaded-value bug spread across a
    // population instead of a field, which is the mistake the off-days question
    // already refused to make.
    for (const gap of [3, 5, 7, 14, 28]) {
      for (const level of durations(gap)) {
        expect(sorenessShortLabel(level)).toBe(sorenessShortLabel(level));
        expect(SORENESS_DURATIONS).toContain(level);
      }
    }
    expect(durations(28).every((d) => durations(7).includes(d))).toBe(true);
  });
});

describe("settledQuestions", () => {
  // This function had NO direct tests, which is how the defect below survived:
  // it was pinned only through ShotForm's integration tests, and the one that
  // covers a stale shot asserts the write-back — which passed either way,
  // because the answers survive a save whether or not anything is rendered.

  it("asks nothing when the gap withholds it and nothing is on record", () => {
    // The floor still does its job, and this is the assertion that fails if
    // "always offer everything" is the fix. The stale case that used to lead
    // this list is gone with the bound — a long gap is now asked normally.
    expect(settledQuestions(0, "")).toEqual({ durations: [], lump: false });
    expect(settledQuestions(null, "")).toEqual({ durations: [], lump: false });
    expect(settledQuestions(2, "")).toEqual({ durations: [], lump: true });
  });

  it("asks a long-past shot normally, answered or not", () => {
    // What used to be "keeps a stored answer correctable past the stale bound".
    // That defect is gone twice over: the record now keeps an answer editable,
    // AND the bound that hid the question no longer exists. So a 40-day gap is
    // simply a gap, and a stored answer changes nothing about what is offered.
    expect(settledQuestions(40, "week-plus")).toEqual({
      durations: [...SORENESS_DURATIONS],
      lump: true,
    });
    expect(settledQuestions(40, "")).toEqual(settledQuestions(40, "week-plus"));
  });

  it("keeps a stored answer correctable on a same-day second shot", () => {
    // Same branch, different gap. A split dose is a real protocol, so a stored
    // answer here is reachable rather than only importable.
    expect(settledQuestions(0, "day-or-two")).toEqual({
      durations: [...SORENESS_DURATIONS],
      lump: false,
    });
  });

  it("keeps a stored answer correctable below the three-day floor", () => {
    // The case that is easiest to miss, because the section is NOT empty here —
    // the lump group renders, and the stored soreness answer sat beside it with
    // no way to reach it.
    expect(settledQuestions(2, "several-days")).toEqual({
      durations: [...SORENESS_DURATIONS],
      lump: true,
    });
  });

  it("renders the lump group for a stored lump answer the gap withholds", () => {
    // The other half of the same rule. `afterLump` was frozen by the identical
    // branch, and "on record means editable" is one rule or it is nothing.
    //
    // Anchored on gap 0 now that the stale bound is gone: a same-day shot is
    // the only case left that withholds the lump question, so it is the only
    // fixture that still exercises this.
    expect(settledQuestions(0, "", "yes")).toEqual({
      durations: [],
      lump: true,
    });
    // "no" is an ANSWER, not silence — the distinction this codebase has paid
    // for repeatedly. A truthiness check would drop it.
    expect(settledQuestions(0, "", "no")).toEqual({
      durations: [],
      lump: true,
    });
  });

  it("does not conjure a duration group from a lump answer alone", () => {
    // The guessing this gate exists to prevent. A stored lump answer says
    // nothing about how long the site was sore, so offering four durations
    // nobody can judge would be exactly the defect the floor was written for.
    expect(settledQuestions(0, "", "yes").durations).toEqual([]);
    expect(settledQuestions(2, "", "yes").durations).toEqual([]);
  });

  it("adds a stored answer to what the gap DOES ask, without rewording", () => {
    // Pre-existing behaviour, pinned because the rewrite moved the branch it
    // lives in. At a 4-day gap "a week or more" is unanswerable and withheld —
    // but if it is already on record it must still be shown, or opening the
    // shot would silently drop it.
    expect(settledQuestions(4, "week-plus")).toEqual({
      durations: [...SORENESS_DURATIONS],
      lump: true,
    });
    // And an answer the gap already offers changes nothing.
    expect(settledQuestions(4, "none")).toEqual({
      durations: ["none", "day-or-two", "several-days"],
      lump: true,
    });
  });

  it("never reorders the vocabulary, however it was assembled", () => {
    // One vocabulary, one order, whatever route produced the list — the chips
    // render in it, and a set assembled by `filter` must not differ from one
    // assembled by spreading the tuple.
    for (const stored of [...SORENESS_DURATIONS, "" as const]) {
      for (const gap of [0, 2, 4, 7, 14, 40]) {
        const { durations } = settledQuestions(gap, stored);
        const order = durations.map((d) => SORENESS_DURATIONS.indexOf(d));
        expect(order).toEqual([...order].sort((a, b) => a - b));
      }
    }
  });
});

describe("settledSummary", () => {
  it("says nothing when neither question was answered", () => {
    expect(settledSummary(undefined, undefined)).toBeNull();
  });

  it("reports 'no lump' as an answer, not as silence", () => {
    // `false` is the answer "no lump" and `undefined` is "nobody asked". A
    // truthiness check would collapse them, which is the bug class this
    // codebase has paid for more than once.
    expect(settledSummary(undefined, false)).toBe("no lump");
    expect(settledSummary(undefined, true)).toBe("lump");
  });

  it("reports soreness alone when the lump was not answered", () => {
    expect(settledSummary("several-days", undefined)).toBe("Sore several days");
  });

  it("joins both answers", () => {
    expect(settledSummary("week-plus", true)).toBe("Sore a week or more · lump");
    expect(settledSummary("none", false)).toBe("Not sore · no lump");
  });
});

describe("labels", () => {
  it("keeps a standalone label readable without the question above it", () => {
    // Two functions for the same reason `offDaysLabel` and `offDaysShortLabel`
    // are two: in the group the question supplies the frame, and in a History
    // row or a CSV cell nothing does. "Several days" alone is several days of
    // what?
    for (const level of SORENESS_DURATIONS) {
      expect(sorenessShortLabel(level).length).toBeGreaterThan(0);
      expect(sorenessLabel(level).length).toBeGreaterThan(0);
    }
    expect(sorenessShortLabel("several-days")).toBe("Several days");
    expect(sorenessLabel("several-days")).toBe("Sore several days");
    // "Not sore" needs no prefix — it already reads as a complete answer.
    expect(sorenessLabel("none")).toBe("Not sore");
  });
});
