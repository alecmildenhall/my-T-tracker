// The invariant the grid exists to satisfy, asked over a wide sweep rather than
// at hand-picked points.
//
// Every anchoring defect this module has had was a PHASE error: the grid landed
// on the right weekday and the wrong week, so a user with nothing wrong with
// their adherence read a fixed offset on every shot — frozen at log time and
// therefore permanent. Each was found by someone thinking to try one particular
// combination, and each time a neighbouring combination was still broken.
//
// The last of them was invisible to the six scenario tests beside this file
// because every one of them keeps the same cadence throughout, and the bug only
// appears when a cadence CHANGES. Anchoring on the earliest shot was wrong in
// 1317 of the 2250 combinations below; on the latest existing shot, 1350 — the
// obvious fix being worse than the defect is exactly the kind of thing a sweep
// says and reasoning does not.
import { describe, it, expect } from "vitest";
import {
  addDaysCivil,
  anchorReferenceDate,
  planShot,
  previousShotDateBefore,
  daysFromPlanned,
} from "../schedule";
import { WEEKDAYS, type Weekday } from "../weekday";

type Shot = { id: string; date: string; plannedFor?: string };

/** The app's own save path, reduced to what decides a planned date. */
class Journal {
  shots: Shot[] = [];
  profile: {
    shotDay?: Weekday;
    intervalDays?: number;
    scheduleAnchor?: string;
  };

  constructor(shotDay: Weekday, intervalDays: number) {
    this.profile = { shotDay, intervalDays };
  }

  log(date: string) {
    const plan = planShot({
      date,
      previousShotDate: previousShotDateBefore(date, this.shots),
      // Nothing here is "in the future": these fixtures are pure schedule
      // maths and deliberately run past the real clock, so the cutoff is open.
      anchorFrom: anchorReferenceDate(date, this.shots, "9999-12-31"),
      profile: this.profile,
    });
    // The app persists an anchor the first time one is established.
    if (plan.anchorToPersist)
      this.profile.scheduleAnchor = plan.anchorToPersist;
    this.shots.push({
      id: `s${this.shots.length}`,
      date,
      plannedFor: plan.plannedFor,
    });
  }

  /** Both of these clear the stored anchor in useProfile. */
  setInterval(days: number) {
    this.profile.intervalDays = days;
    this.profile.scheduleAnchor = undefined;
  }
  setShotDay(day: Weekday) {
    this.profile.shotDays = day;
    this.profile.scheduleAnchor = undefined;
  }
}

const series = (from: string, step: number, count: number) =>
  Array.from({ length: count }, (_, i) => addDaysCivil(from, step * i));

describe("perfect adherence never reads as late", () => {
  it("holds across every cadence change we can express", () => {
    const failures: string[] = [];
    let cases = 0;

    // Every interval the app offers a chip for, plus two in between.
    for (const before of [7, 14, 21, 28, 84]) {
      for (const after of [7, 14, 21, 28, 84]) {
        for (const priorShots of [1, 2, 3, 4, 5]) {
          for (const gapWeeks of [1, 2, 3, 4, 5, 6]) {
            for (const dayIndex of [0, 3, 5]) {
              const shotDay = WEEKDAYS[dayIndex];
              // 2026-01-04 is a Sunday, so this starts on the chosen weekday.
              const start = addDaysCivil("2026-01-04", dayIndex);
              const before_ = series(start, before, priorShots);
              const resume = addDaysCivil(
                before_[before_.length - 1],
                7 * gapWeeks,
              );

              const j = new Journal(shotDay, before);
              before_.forEach((d) => j.log(d));
              j.setInterval(after);
              series(resume, after, 4).forEach((d) => j.log(d));
              cases++;

              // Only the shots logged AFTER the change are in scope. The
              // earlier ones were measured against the old cadence and frozen
              // there, which is the whole point of freezing.
              const deltas = j.shots
                .slice(before_.length)
                .map((s) => daysFromPlanned(s));

              // `null` is "no planned date", which the sweep reaches by walking
              // an 84-day cadence past the range every persistence boundary
              // enforces. Absence is not a wrong measurement; a number is.
              if (deltas.some((d) => d !== null && d !== 0)) {
                failures.push(
                  `${before}->${after} n=${priorShots} gap=${gapWeeks}w ${shotDay} => ${deltas.join(",")}`,
                );
              }
            }
          }
        }
      }
    }

    expect(cases).toBe(2250);
    expect(failures).toEqual([]);
  });

  it("holds when the shot DAY changes rather than the interval", () => {
    // The sweep above only ever changes the interval, and that was a gap in the
    // guard rather than in the fix: `setShotDay` clears the anchor too, by the
    // same code path, so it had the same defect and nothing was asking. Measured
    // against the old rule when this was added: 486 of the 810 combinations
    // below were wrong, on top of the 1317 the interval sweep found.
    //
    // Someone who moves their injection day — a new work pattern, a clinic
    // appointment — and then keeps it perfectly is the person this must not
    // accuse.
    const failures: string[] = [];
    let cases = 0;

    for (const interval of [7, 14, 21, 28, 84]) {
      for (const fromIndex of [0, 3, 5]) {
        for (let toIndex = 0; toIndex < 7; toIndex++) {
          if (toIndex === fromIndex) continue;
          for (const priorShots of [1, 3, 5]) {
            for (const gapWeeks of [1, 2, 3]) {
              const from = WEEKDAYS[fromIndex];
              const to = WEEKDAYS[toIndex];
              const start = addDaysCivil("2026-01-04", fromIndex);
              const before = series(start, interval, priorShots);

              const j = new Journal(from, interval);
              before.forEach((d) => j.log(d));
              j.setShotDay(to);
              // Resume on the NEW weekday, perfectly on cadence from there.
              const resume = addDaysCivil(
                before[before.length - 1],
                7 * gapWeeks + ((toIndex - fromIndex + 7) % 7),
              );
              series(resume, interval, 4).forEach((d) => j.log(d));
              cases++;

              const deltas = j.shots
                .slice(before.length)
                .map((s) => daysFromPlanned(s));
              if (deltas.some((d) => d !== null && d !== 0)) {
                failures.push(
                  `i=${interval} ${from}->${to} n=${priorShots} gap=${gapWeeks}w => ${deltas.join(",")}`,
                );
              }
            }
          }
        }
      }
    }

    expect(cases).toBe(810);
    expect(failures).toEqual([]);
  });

  it("still reports drift that is real, rather than zeroing it", () => {
    // The mirror of the above, and the reason "make everything read 0" is not
    // the fix: someone who changes cadence and is then consistently three days
    // later must read +3, not 0 and not a negative number. The old anchoring
    // reported -4 here — the wrong magnitude and the wrong direction, which is
    // worse than being merely wrong, because the app told them they were early.
    const j = new Journal("wednesday", 7);
    series("2026-01-07", 7, 4).forEach((d) => j.log(d));
    j.setInterval(14);
    series("2026-02-14", 14, 4).forEach((d) => j.log(d)); // Saturdays

    expect(j.shots.slice(4).map((s) => daysFromPlanned(s))).toEqual([
      3, 3, 3, 3,
    ]);
  });

  it("does not let a backdated entry re-phase the whole future grid", () => {
    // Why the reference is the most recent date KNOWN rather than simply the
    // shot being saved. Change cadence, then type in a forgotten entry from
    // months ago: anchoring on that entry put every later shot a week off,
    // permanently.
    const j = new Journal("wednesday", 7);
    series("2026-01-07", 7, 3).forEach((d) => j.log(d));
    j.setInterval(14);
    j.log("2025-11-05"); // the forgotten one
    series("2026-02-04", 14, 4).forEach((d) => j.log(d));

    // The backdated shot itself does not fit the new grid, and says so. Every
    // shot after it is on time.
    expect(j.shots.slice(4).map((s) => daysFromPlanned(s))).toEqual([
      0, 0, 0, 0,
    ]);
  });
});
