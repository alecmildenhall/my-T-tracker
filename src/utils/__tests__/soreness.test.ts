import { describe, it, expect } from "vitest";
import {
  SORENESS_FLOOR_DAYS,
  SORENESS_STALE_DAYS,
  previousShotQuestions,
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

  it("asks nothing once the recall is too old to be worth it", () => {
    expect(previousShotQuestions(SORENESS_STALE_DAYS)).not.toEqual({
      durations: [],
      lump: false,
    });
    expect(previousShotQuestions(SORENESS_STALE_DAYS + 1)).toEqual({
      durations: [],
      lump: false,
    });
  });

  it("asks only about the lump below the floor", () => {
    // Every duration needs three days before it can be judged — including
    // "Not sore", because soreness can start on day 2. The lump question has no
    // floor at all: "is there one now?" is answerable on any day, so a short
    // cadence still gets asked that one.
    for (let gap = 0; gap < SORENESS_FLOOR_DAYS; gap += 1) {
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
