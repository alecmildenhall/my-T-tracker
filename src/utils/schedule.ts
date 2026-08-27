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
import { civilDateParts } from "./civilDate";
import { weekdayOf, WEEKDAYS } from "./weekday";
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
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${mm}-${dd}`;
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
): string | null {
  return snapToWeekday(firstShotDate, shotDay);
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
    !Number.isFinite(offset) ||
    !Number.isFinite(intervalDays) ||
    intervalDays <= 0
  ) {
    return null;
  }
  const slots = Math.floor(offset / intervalDays + 0.5);
  return addDaysCivil(anchor, slots * intervalDays);
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
 * The planned date to freeze onto a shot being saved, or `undefined` when the
 * app has no business guessing one.
 *
 * Takes the profile's frozen `scheduleAnchor` rather than working one out from
 * the shot list — see {@link establishAnchor} for why deriving it was a bug.
 * A caller with no anchor yet establishes one first and persists it.
 *
 * **Both settings are required and neither is defaulted.** No interval, no shot
 * day, or no anchor means no planned date at all — not a fallback, not a guess.
 * A default of 7 would be uniquely harmful because the value is *frozen*: a
 * fortnightly user who never opened Settings would accumulate months of shots
 * measured against a schedule they were never on, and correcting the setting
 * afterwards would repair none of them.
 */
export function plannedDateOnSave(
  actual: string,
  anchor: string | undefined,
  intervalDays: number | undefined,
): string | undefined {
  if (!anchor || !intervalDays) return undefined;
  return plannedDateFor(actual, anchor, intervalDays) ?? undefined;
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
