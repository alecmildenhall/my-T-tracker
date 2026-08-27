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
import { weekdayOf } from "./weekday";
import type { Weekday } from "./weekday";

/** Whole days added to a civil date, DST-proof for the same reason
 *  `daysBetweenCivil` is: both ends are anchored to UTC midnight and treated
 *  purely as calendar dates. Returns the input unchanged if it cannot parse,
 *  matching `addMonthsCivil`. */
export function addDaysCivil(iso: string, days: number): string {
  const parts = civilDateParts(iso);
  if (!parts) return iso;
  const [y, m, d] = parts;
  const shifted = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000);
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${mm}-${dd}`;
}

/**
 * The date the grid is aligned to: the earliest shot, moved to the nearest
 * occurrence of the user's shot day.
 *
 * Snapping is the whole reason shot day is required. Without it the anchor is
 * "wherever the first shot happened to land", and a first shot taken a day early
 * makes the entire schedule a day early — which then marks every correctly
 * timed shot afterwards as late. Measured, not theorised: that pattern produced
 * "1 late" on every shot from the second onwards, permanently.
 *
 * Returns null when there are no shots to anchor to.
 */
export function scheduleAnchor(
  shotDates: string[],
  shotDay: Weekday,
): string | null {
  if (shotDates.length === 0) return null;
  const earliest = shotDates.reduce((a, b) => (a <= b ? a : b));
  // Nearest occurrence within half a week. Ties (exactly 3 or 4 either side
  // cannot tie; ±3.5 is not reachable with whole days) resolve to the smaller
  // absolute offset, and a forward one wins an equal comparison because the
  // loop reaches it second only for a strictly smaller distance.
  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let offset = -3; offset <= 3; offset++) {
    const candidate = addDaysCivil(earliest, offset);
    if (weekdayOf(candidate) !== shotDay) continue;
    if (Math.abs(offset) < bestDistance) {
      best = candidate;
      bestDistance = Math.abs(offset);
    }
  }
  return best;
}

/**
 * The grid slot this shot is nearest to.
 *
 * `Math.floor(x + 0.5)`, deliberately, and NOT `Math.round`: a shot exactly half
 * an interval from two slots has to resolve the same way on both sides of the
 * anchor, and `Math.round` breaks that symmetry by rounding half **away from
 * zero** — so -3.5 would go to -4 while 3.5 goes to 4, and two shots equally
 * spaced either side of the anchor would land on slots a full interval apart.
 */
export function plannedDateFor(
  actual: string,
  anchor: string,
  intervalDays: number,
): string {
  const offset = daysApart(anchor, actual);
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
 * **Both settings are required and neither is defaulted.** No interval or no
 * shot day means no planned date at all — not a fallback, not a guess. A
 * default of 7 would be uniquely harmful here because the value is *frozen*: a
 * fortnightly user who never opened Settings would accumulate months of shots
 * marked against a schedule they were never on, and correcting the setting
 * afterwards would not repair a single one of them.
 *
 * @param actual the date being saved
 * @param existingShotDates every other shot's date, for anchoring the grid
 */
export function plannedDateOnSave(
  actual: string,
  existingShotDates: string[],
  shotDay: Weekday | undefined,
  intervalDays: number | undefined,
): string | undefined {
  if (!shotDay || !intervalDays || intervalDays <= 0) return undefined;
  // The shot being saved counts toward the anchor, so a first shot anchors to
  // itself (snapped) rather than producing nothing.
  const anchor = scheduleAnchor([...existingShotDates, actual], shotDay);
  if (!anchor) return undefined;
  return plannedDateFor(actual, anchor, intervalDays);
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
