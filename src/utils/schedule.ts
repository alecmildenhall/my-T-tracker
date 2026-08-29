// src/utils/schedule.ts
// When was this shot meant to be?
//
// The app knows when you injected but not when you meant to, so it can say
// nothing about timing. This computes a **planned date** for a shot, which the
// log form freezes onto the shot at save time and never recomputes.
//
// THE SHAPE HERE WAS SETTLED BY TESTING IT, and three earlier shapes failed.
// They are recorded because each one looks correct until you run a real user's
// history through it:
//
//   - Chain on the previous ACTUAL shot (`planned = last shot + interval`).
//     One early shot drags the schedule along with it, so every correct shot
//     afterwards reads late — forever, and frozen.
//   - Chain on the previous PLANNED date. A skipped shot leaves the schedule
//     permanently one slot behind, and every later shot reads late.
//   - Anchor on the first shot with no shot day. Fails in BOTH directions:
//     someone late every single week reads as perfect (their first late shot
//     silently became the schedule), and one accidental early first shot marks
//     every correct shot late forever.
//
// What survives is the property those three lack: **no shot's planned date
// depends on any other shot's behaviour.** Anything with a link has a link an
// error can travel down. So there is a fixed grid, and each shot is judged
// against it alone.
import { civilDateParts, isShotDateInRange } from "./civilDate";
import { weekdayOf, WEEKDAYS } from "./weekday";
import { isValidIntervalDays } from "../types/profile";
import type { Weekday } from "./weekday";

/** Whole days added to a civil date, DST-proof for the same reason
 *  `daysBetweenCivil` is: both ends are anchored to UTC midnight and treated
 *  purely as calendar dates. Returns the input unchanged if it cannot parse,
 *  matching `addMonthsCivil`. */
export function addDaysCivil(iso: string, days: number): string {
  const parts = civilDateParts(iso);
  // `days` is guarded as well as the date. Only the date used to be, and a
  // non-finite count silently produced the STRING "NaN-NaN-NaN" — which would
  // have been frozen onto a shot, shown in History, and written into a
  // provider's CSV. Reachable three ways: a zero interval (Infinity slots), an
  // unparseable shot date (sanitizeShots deliberately accepts a non-blank but
  // malformed one), and NaN arithmetic upstream.
  if (!parts || !Number.isFinite(days)) return iso;
  const [y, m, d] = parts;
  const shifted = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000);
  // The YEAR is padded too. Unpadded, `addDaysCivil("0999-01-01", 7)` returned
  // "999-01-08" — not YYYY-MM-DD, so it fails CIVIL_DATE_RE everywhere
  // downstream. `civilDateParts` accepts years 100–999 (only 0–99 fail its
  // Date.UTC round-trip), so any caller holding such a date reaches this.
  // EARLIEST_DATE in civilDate.ts pads for exactly this reason; addMonthsCivil
  // still has the same gap.
  const yyyy = String(shifted.getUTCFullYear()).padStart(4, "0");
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  const result = `${yyyy}-${mm}-${dd}`;
  // Perform, then verify — the pattern this codebase runs on. Padding fixed
  // years 100–999 but not the ends: a year under 100 formats fine and is then
  // rejected by `civilDateParts`, a negative year gives "00-1", and a year past
  // 9999 gives five digits that fail CIVIL_DATE_RE. Rather than enumerate the
  // ways the output can be unusable, hand it back through the same parser every
  // consumer uses and return the input unchanged when it does not survive.
  return civilDateParts(result) ? result : iso;
}

/**
 * Move a date to the nearest occurrence of a weekday.
 *
 * Exactly one offset in [-3, 3] can match a given weekday, so this is a single
 * arithmetic step rather than a search. An earlier version looped and tracked a
 * minimum distance, with a comment claiming a forward candidate won an equal
 * comparison — it did not (the loop ran backwards-first and kept the earlier
 * one), and the tracking was dead code besides, since no tie is reachable.
 */
export function snapToWeekday(iso: string, weekday: Weekday): string | null {
  const current = weekdayOf(iso);
  if (!current) return null;
  const forward =
    (WEEKDAYS.indexOf(weekday) - WEEKDAYS.indexOf(current) + 7) % 7; // 0..6
  return addDaysCivil(iso, forward <= 3 ? forward : forward - 7);
}

/**
 * The date a user's schedule is aligned to, established once from their first
 * shot and then FROZEN on the profile.
 *
 * Stored rather than derived, and that was a real bug rather than a preference.
 * Deriving it as "the earliest shot, snapped" meant any shot could become the
 * earliest — so backdating a remembered shot, or deleting the oldest one,
 * silently repointed the grid for every shot saved afterwards. Snapping only
 * removes phase error modulo 7 days, so on a fortnightly schedule a 7-day shift
 * flips which week the grid falls on: measured, an on-rhythm shot went from
 * "on time" to "7 days before" and stayed there, frozen, unrepairable.
 *
 * That is the third failure this module's header says it rejects — "one
 * accidental early first shot marks every correct shot late forever" — arriving
 * through the anchor instead of through chaining. The invariant only holds if
 * the anchor cannot move.
 */
export function establishAnchor(
  firstShotDate: string,
  shotDay: Weekday,
  intervalDays: number,
): string | null {
  // Snapping to a weekday only keeps the grid weekday-aligned when the interval
  // is a whole number of weeks. On any other cadence the grid walks across the
  // week, so the snap does not align it — it injects a fixed offset every shot
  // then carries, frozen. Measured: first shot on a Sunday, shot day Wednesday,
  // interval 10 — a user injecting EXACTLY every 10 days reads "3 days before"
  // on every shot, forever. That is the failure this module's header rejects,
  // arriving through the snap.
  //
  // There is no honest anchor for those cadences: a weekday cannot describe
  // them, and falling back to the raw first shot is the "wherever it landed"
  // guess that fails in both directions. So they get no planned dates, which is
  // the same answer this file gives to every other unknown.
  if (!isWeeklyMultiple(intervalDays)) return null;
  const anchor = snapToWeekday(firstShotDate, shotDay);
  // Snapping moves up to 3 days either way, so it can step outside the range
  // every persistence boundary enforces — `establishAnchor("1900-01-01",
  // "sunday", 7)` gives "1899-12-31". Those boundaries would each drop it
  // silently, leaving the user with no planned dates and no explanation. The
  // producer refuses instead of minting a value its consumers delete.
  return anchor && isShotDateInRange(anchor) ? anchor : null;
}

/**
 * The user's shot day, if it currently means anything.
 *
 * A weekday cannot describe a cadence that is not a whole number of weeks, so
 * the setting is inert while the interval is one — greyed out in Settings, and
 * silent in the greeting. Deliberately a *read-through* rather than clearing
 * the stored value: someone correcting a mistyped interval gets their day back
 * rather than having to remember it.
 */
export function shotDayInEffect(profile: {
  shotDay?: Weekday;
  intervalDays?: number;
}): Weekday | undefined {
  if (!profile.shotDay) return undefined;
  // An interval that is absent OR unusable leaves shot day doing its original
  // job: the greeting. These two predicates used to disagree — `scheduleMode`
  // treats an out-of-range interval as absent ("none") while this treated it as
  // rolling and silently killed the greeting. For a garbage value the safe
  // reading is "ignore it", not "act on it".
  if (!isValidIntervalDays(profile.intervalDays)) return profile.shotDay;
  return isWeeklyMultiple(profile.intervalDays) ? profile.shotDay : undefined;
}

/** A cadence a weekday can describe: a whole number of weeks. */
export function isWeeklyMultiple(intervalDays: number): boolean {
  return isValidIntervalDays(intervalDays) && intervalDays % 7 === 0;
}

/**
 * The grid slot this shot is nearest to.
 *
 * A shot exactly half an interval from two slots claims the LATER one, on both
 * sides of the anchor.
 *
 * `floor(x + 0.5)` rather than `Math.round` states that intention in the code.
 * The two are **identical in JavaScript** — an earlier version of this comment
 * claimed `Math.round` rounds half away from zero and would break the symmetry,
 * which is false, and the mutant surviving is what caught it: JS rounds half
 * toward +∞, so `Math.round(-3.5)` is -3, not -4. (Python's `round` really does
 * differ — half to even — so a port would need this form.)
 *
 * Kept as `floor(x + 0.5)` because the tie direction is then visible without
 * knowing the spec. No test can tell the two apart, so the test beside this
 * pins which way a tie falls instead.
 */
export function plannedDateFor(
  actual: string,
  anchor: string,
  intervalDays: number,
): string | null {
  const offset = daysApart(anchor, actual);
  // Null rather than a junk string. This is exported and was reachable with an
  // unparseable date or a zero interval, and the result would have been frozen
  // onto a shot rather than refused.
  if (
    // `isValidIntervalDays`, not a looser lookalike: a 7.5 would have divided
    // the grid into fractional days and still returned a date.
    !Number.isFinite(offset) ||
    !isValidIntervalDays(intervalDays)
  ) {
    return null;
  }
  const slots = Math.floor(offset / intervalDays + 0.5);
  const planned = addDaysCivil(anchor, slots * intervalDays);
  // Range-checked like establishAnchor, and for the same reason: the rounded
  // slot lands up to half an interval away from the shot, so a large interval
  // near the edge of the supported range can produce a date pickShotFields
  // drops from the backup and toCsv blanks while History renders it — the
  // three-way disagreement the comments around those boundaries exist to stop.
  return isShotDateInRange(planned) ? planned : null;
}

/** Whole days from `a` to `b`. Local to this module rather than imported from
 *  milestones.ts, which is about time on T; the shared piece is the UTC-midnight
 *  technique, not the domain. */
function daysApart(a: string, b: string): number {
  const from = civilDateParts(a);
  const to = civilDateParts(b);
  if (!from || !to) return NaN;
  return Math.round(
    (Date.UTC(to[0], to[1] - 1, to[2]) -
      Date.UTC(from[0], from[1] - 1, from[2])) /
      86_400_000,
  );
}

/**
 * Which question this user's settings can answer.
 *
 * Two different mental models, and forcing one onto both was the mistake that
 * took several rounds to see:
 *
 *   - **grid** — "I inject on Wednesdays." A calendar rhythm, where drift is a
 *     problem because the weekday *is* the intent. Needs a whole number of
 *     weeks and a shot day.
 *   - **rolling** — "I inject every 10 days." A gap from the last dose, where
 *     drift is not drift, it is the definition. You count from your last
 *     injection, which is also what your levels respond to.
 *
 * A weekly cadence with no shot day answers NEITHER, deliberately. Rolling
 * would work mechanically, but it would under-report: someone consistently
 * injecting on Fridays when they meant Wednesdays reads "on time" every single
 * week. True, and useless. A non-weekly cadence has no such intent to miss.
 */
export type ScheduleMode = "grid" | "rolling" | "none";

export function scheduleMode(
  shotDay: Weekday | undefined,
  intervalDays: number | undefined,
): ScheduleMode {
  if (typeof intervalDays !== "number" || !isValidIntervalDays(intervalDays)) {
    return "none";
  }
  if (!isWeeklyMultiple(intervalDays)) return "rolling";
  return shotDay ? "grid" : "none";
}

/**
 * The planned date for a rolling cadence: one interval on from the shot before
 * it.
 *
 * No cascade, despite chaining on the previous ACTUAL date — because this
 * measures the GAP rather than a position, so a late shot shifts the next
 * expectation by exactly the amount it should. Measured: one late shot then a
 * return to rhythm reads "3 after" and then "on time", and a skipped cycle
 * reads "10 after" and then "on time".
 *
 * The first shot has no predecessor, so it has no planned date — never "0 days
 * after", which would state a fact we do not have.
 */
export function plannedDateRolling(
  previousShotDate: string | undefined,
  intervalDays: number,
): string | undefined {
  if (!previousShotDate || !isValidIntervalDays(intervalDays)) return undefined;
  const planned = addDaysCivil(previousShotDate, intervalDays);
  if (planned === previousShotDate) return undefined; // addDaysCivil refused it
  // Unbounded above without this: previous + interval can walk past the range.
  return isShotDateInRange(planned) ? planned : undefined;
}

export interface PlanInput {
  /** The date being saved. */
  date: string;
  /** The shot logged immediately before this one, if any — rolling mode's
   *  reference. */
  previousShotDate?: string;
  /** The earliest shot on record, which a grid anchor is established from the
   *  first time one is needed. */
  earliestShotDate?: string;
  profile: {
    shotDay?: Weekday;
    intervalDays?: number;
    scheduleAnchor?: string;
  };
}

export interface Plan {
  /** Freeze this onto the shot. Absent when the settings answer no question. */
  plannedFor?: string;
  /** Set only when a grid anchor was established just now; the caller must
   *  persist it to the profile, or the next save establishes a different one. */
  anchorToPersist?: string;
}

/**
 * The one entry point for "when was this shot meant to be", and deliberately
 * the only place that decides.
 *
 * It recomputes the MODE on every save rather than trusting the frozen anchor,
 * and that is not a nicety. The anchor is established once and frozen, so a user
 * who set 7 days, logged shots, then switched to 10 kept a weekday-snapped
 * anchor that no longer described anything: measured, a user injecting exactly
 * every 10 days read "3 days before" on every shot, forever — the module
 * header's own named failure, reached through the save path instead of the
 * anchor path, because the weekly-multiple guard lived only in
 * `establishAnchor`. Asking `scheduleMode` here makes that unreachable: the
 * moment the interval stops being a whole number of weeks, the grid anchor
 * stops being consulted at all.
 *
 * Returning the anchor to persist rather than writing it keeps this pure, and
 * keeps the decision in one function instead of split across the caller.
 */
export function planShot({
  date,
  previousShotDate,
  earliestShotDate,
  profile,
}: PlanInput): Plan {
  const mode = scheduleMode(profile.shotDay, profile.intervalDays);
  if (mode === "none" || typeof profile.intervalDays !== "number") return {};

  if (mode === "rolling") {
    // No anchor involved: the reference is the shot before this one, so a
    // frozen anchor from an earlier weekly cadence cannot leak in.
    return {
      plannedFor: plannedDateRolling(previousShotDate, profile.intervalDays),
    };
  }

  // Grid. `shotDay` is non-undefined here by scheduleMode's definition.
  const existing = profile.scheduleAnchor;
  if (existing) {
    return {
      plannedFor:
        plannedDateFor(date, existing, profile.intervalDays) ?? undefined,
    };
  }
  const anchor = establishAnchor(
    earliestShotDate ?? date,
    profile.shotDay!,
    profile.intervalDays,
  );
  if (!anchor) return {};
  return {
    plannedFor: plannedDateFor(date, anchor, profile.intervalDays) ?? undefined,
    anchorToPersist: anchor,
  };
}

/**
 * How far a shot landed from its planned date, in whole days. Positive means
 * after, negative means before, zero means on it.
 *
 * Derived rather than stored: it follows from two facts already on the shot, so
 * storing it would be a third value free to disagree with them — the shape this
 * codebase has paid for repeatedly.
 */
export function daysFromPlanned(shot: {
  date: string;
  plannedFor?: string;
}): number | null {
  if (!shot.plannedFor) return null;
  const days = daysApart(shot.plannedFor, shot.date);
  return Number.isNaN(days) ? null : days;
}

/**
 * The shot logged immediately before `date`, excluding the one being edited.
 *
 * Rolling mode's reference. Excluding `exceptId` matters: editing a shot must
 * not use that same shot as its own predecessor.
 */
export function previousShotDateBefore(
  date: string,
  shots: { id: string; date: string }[],
  exceptId?: string,
): string | undefined {
  let best: string | undefined;
  for (const shot of shots) {
    if (shot.id === exceptId || shot.date >= date) continue;
    if (best === undefined || shot.date > best) best = shot.date;
  }
  return best;
}

/** The earliest shot on record, which a grid anchor is established from. */
export function earliestShotDate(
  shots: { id: string; date: string }[],
  exceptId?: string,
): string | undefined {
  let best: string | undefined;
  for (const shot of shots) {
    if (shot.id === exceptId) continue;
    if (best === undefined || shot.date < best) best = shot.date;
  }
  return best;
}
