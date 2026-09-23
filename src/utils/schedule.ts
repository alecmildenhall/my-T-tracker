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
import type { ScheduleMode } from "../types/profile";
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
 * The next occurrence of `weekday` on or after `iso` — FORWARD only, never the
 * nearest.
 *
 * The distinction is the whole correctness of a multi-day grid, and a sweep
 * caught it rather than review. {@link snapToWeekday} moves to the nearest
 * match, which is right for establishing an anchor (it minimises how far the
 * anchor moves from the first shot) and wrong for locating the other days of a
 * set: anchored on Monday, Friday is 4 days forward, so "nearest" jumps to the
 * PREVIOUS Friday and puts that day's grid one week out of phase with Monday's.
 *
 * Invisible at a one-week interval, where every Friday is a slot. Measured
 * wrong at two and four: Mon/Wed/Fri read "2 days later" on every single Friday,
 * forever, frozen at log time.
 */
function forwardToWeekday(iso: string, weekday: Weekday): string | null {
  const current = weekdayOf(iso);
  if (!current) return null;
  const forward =
    (WEEKDAYS.indexOf(weekday) - WEEKDAYS.indexOf(current) + 7) % 7; // 0..6
  return addDaysCivil(iso, forward);
}

/**
 * A weekday set in week order, de-duplicated, with anything unrecognised
 * dropped.
 *
 * Order is imposed here rather than trusted from storage so the anchor and the
 * planned date always agree about which day is "first" — a hand-edited or
 * imported `["thursday", "monday"]` would otherwise anchor to Thursday while
 * reading as Monday-first everywhere a person looks at it.
 */
function sortedDays(days: Weekday[] | undefined): Weekday[] {
  if (!days) return [];
  const present = new Set(days);
  return WEEKDAYS.filter((d) => present.has(d));
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
  shotDays: Weekday[],
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
  // ONE anchor still suffices for a whole set. It is snapped to the earliest
  // weekday in the set, and `plannedDateFor` re-snaps it to each of the others
  // when it needs them — snapping moves at most 3 days, so every day's grid
  // sits inside the same week and they cannot drift apart.
  // Two steps, and doing it in one was a real bug. Snapping the reference
  // straight to `days[0]` moves to the NEAREST occurrence, which can be
  // forward — and when it moved forward past the reference shot, that shot's
  // own weekday then sat in the PREVIOUS grid week, so at any interval above 7
  // the grid was permanently one cycle out. Measured: shot days Sun+Thu,
  // fortnightly, first shot on a Thursday — every perfectly adhered shot read
  // "3 days before", forever, frozen at log time.
  //
  // So: find the nearest day OF THE SET to the reference, which is the slot the
  // first shot is really closest to, then step BACK inside that same week to
  // `days[0]`, since `plannedDateFor` only ever walks FORWARD from the anchor.
  // For a single-day set both steps collapse to the old behaviour.
  const days = sortedDays(shotDays);
  const first = days[0];
  if (!first) return null;
  let nearestDate: string | null = null;
  let nearestDay: Weekday | null = null;
  let bestGap = Infinity;
  for (const day of days) {
    const snapped = snapToWeekday(firstShotDate, day);
    if (!snapped) continue;
    const gap = Math.abs(daysApart(snapped, firstShotDate));
    if (gap < bestGap) {
      bestGap = gap;
      nearestDate = snapped;
      nearestDay = day;
    }
  }
  if (!nearestDate || !nearestDay) return null;
  const backToFirst =
    (WEEKDAYS.indexOf(nearestDay) - WEEKDAYS.indexOf(first) + 7) % 7;
  const anchor = addDaysCivil(nearestDate, -backToFirst);
  // The two-step anchor moves up to 9 days BACK from the reference — 3 for the
  // snap to the nearest day of the set, and up to 6 more stepping back to the
  // set's first day — where the single-day version moved at most 3 either way.
  // So it can step outside the range
  // every persistence boundary enforces — `establishAnchor("1900-01-01",
  // "sunday", 7)` gives "1899-12-31". Those boundaries would each drop it
  // silently, leaving the user with no planned dates and no explanation. The
  // producer refuses instead of minting a value its consumers delete.
  return anchor && isShotDateInRange(anchor) ? anchor : null;
}

/**
 * The user's shot days, if they currently mean anything.
 *
 * Empty in every mode but the grid: a weekday cannot describe a cadence that is
 * not a whole number of weeks, and it describes nothing at all for someone who
 * chose to count from their last shot or not to track timing. Deliberately a
 * *read-through* rather than clearing the stored value, so switching rhythms and
 * switching back returns the days rather than asking for them again.
 */
export function shotDaysInEffect(profile: {
  shotDays?: Weekday[];
  intervalDays?: number;
  scheduleMode?: ScheduleMode;
}): Weekday[] {
  const days = sortedDays(profile.shotDays);
  if (days.length === 0) return [];
  // The rhythms where a weekday means nothing: counting from your last shot has
  // no weekday, and not tracking has switched this off.
  if (profile.scheduleMode === "rolling" || profile.scheduleMode === "none") {
    return [];
  }
  // An interval no weekday can describe makes them inert — the grid would walk
  // across the week. Deliberately NOT gated on having an interval at all: the
  // greeting is "today is a day you inject", which is true before anyone sets a
  // cadence, and gating it on one silently removed the greeting for every user
  // who had only ever picked a day.
  if (
    isValidIntervalDays(profile.intervalDays) &&
    !isWeeklyMultiple(profile.intervalDays)
  ) {
    return [];
  }
  return days;
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
  shotDays: Weekday[],
): string | null {
  // `isValidIntervalDays`, not a looser lookalike: a 7.5 would have divided the
  // grid into fractional days and still returned a date.
  if (!isValidIntervalDays(intervalDays)) return null;
  const days = sortedDays(shotDays);
  if (days.length === 0) return null;

  // One grid per weekday, each anchored by re-snapping the single stored anchor
  // to that day. The planned date is the nearest slot across the whole set,
  // which is what makes `[mon, thu]` twice weekly rather than two schedules.
  let best: string | null = null;
  let bestGap = Infinity;
  for (const day of days) {
    const dayAnchor = forwardToWeekday(anchor, day);
    if (!dayAnchor) continue;
    const offset = daysApart(dayAnchor, actual);
    // Null rather than a junk string. This is exported and was reachable with an
    // unparseable date, and the result would have been frozen onto a shot.
    if (!Number.isFinite(offset)) continue;
    const slots = Math.floor(offset / intervalDays + 0.5);
    const planned = addDaysCivil(dayAnchor, slots * intervalDays);
    const gap = Math.abs(daysApart(planned, actual));
    // Strictly nearer, so an exact tie keeps the earlier weekday in week order.
    // Ties are reachable — [sun, wed] at 7 days puts a Saturday shot 3 days from
    // each — and an arbitrary winner would make the frozen value depend on
    // array order rather than on the calendar.
    if (gap < bestGap) {
      bestGap = gap;
      best = planned;
    }
  }
  // Range-checked ONCE, on the winner, and never as a filter inside the loop.
  // Filtering there quietly promoted the runner-up: with the nearest day's slot
  // out of range and a farther day's inside it, the shot was frozen against the
  // farther day — a wrong "N days later" rather than no planned date at all,
  // and frozen means unrepairable. The single-day version returned null here,
  // and it was right to.
  //
  // The bound is the one every persistence boundary enforces: the rounded slot
  // sits up to half an interval from the shot, so a long cadence near the edge
  // can produce a date `pickShotFields` drops from the backup and `toCsv`
  // blanks while History still renders it.
  return best !== null && isShotDateInRange(best) ? best : null;
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
export function scheduleMode(
  shotDays: Weekday[] | undefined,
  intervalDays: number | undefined,
): ScheduleMode {
  if (typeof intervalDays !== "number" || !isValidIntervalDays(intervalDays)) {
    return "none";
  }
  if (!isWeeklyMultiple(intervalDays)) return "rolling";
  return shotDays && shotDays.length > 0 ? "grid" : "none";
}

/**
 * The rhythm actually in force: what the user SAID, falling back to what the
 * values imply.
 *
 * The stored answer wins because it carries what inference cannot. "Every 7
 * days, counting from my last shot" and "every Wednesday" both store
 * `intervalDays: 7`, and {@link scheduleMode} resolves that collision by
 * returning `none` — correct when it is a guess, and wrong once the person has
 * told us, because they would have picked a rhythm and silently received no
 * planned dates.
 *
 * Inference remains for profiles written before the field existed and for
 * backups from those builds, where a guess is all there is.
 */
export function effectiveScheduleMode(profile: {
  shotDays?: Weekday[];
  intervalDays?: number;
  scheduleMode?: ScheduleMode;
}): ScheduleMode {
  if (!isValidIntervalDays(profile.intervalDays)) return "none";
  switch (profile.scheduleMode) {
    case "none":
      return "none";
    case "rolling":
      return "rolling";
    case "grid":
      // A grid with nothing to align to plans nothing. Stated rather than
      // assumed: the UI cannot store this, but an edited file can.
      return isWeeklyMultiple(profile.intervalDays) &&
        (profile.shotDays?.length ?? 0) > 0
        ? "grid"
        : "none";
    default:
      return scheduleMode(profile.shotDays, profile.intervalDays);
  }
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
  /** The date a grid anchor is established from, the first time one is needed.
   *  See `anchorReferenceDate`, which is what should compute it — the name
   *  matters, because this was `earliestShotDate` and the earliest shot is
   *  precisely the wrong answer. */
  anchorFrom?: string;
  profile: {
    shotDays?: Weekday[];
    intervalDays?: number;
    scheduleAnchor?: string;
    scheduleMode?: ScheduleMode;
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
  anchorFrom,
  profile,
}: PlanInput): Plan {
  // The rhythm the user CHOSE, not one reverse-engineered from their fields.
  const mode = effectiveScheduleMode(profile);
  if (mode === "none" || typeof profile.intervalDays !== "number") return {};

  if (mode === "rolling") {
    // No anchor involved: the reference is the shot before this one, so a
    // frozen anchor from an earlier weekly cadence cannot leak in.
    return {
      plannedFor: plannedDateRolling(previousShotDate, profile.intervalDays),
    };
  }

  // Grid. `shotDays` is non-empty here by effectiveScheduleMode's definition.
  const days = profile.shotDays ?? [];
  const existing = profile.scheduleAnchor;
  if (existing) {
    return {
      plannedFor:
        plannedDateFor(date, existing, profile.intervalDays, days) ?? undefined,
    };
  }
  const anchor = establishAnchor(
    anchorFrom ?? date,
    days,
    profile.intervalDays,
  );
  if (!anchor) return {};
  const planned = plannedDateFor(date, anchor, profile.intervalDays, days);
  // No planned date, no anchor. `plannedDateFor` refuses a slot outside the
  // range every persistence boundary enforces, which `establishAnchor` can
  // still have succeeded for — a large interval with a shot dated near 1900 or
  // near today+1y. Persisting anyway froze the grid to a shot that carries no
  // planned date of its own, and the anchor has no UI to inspect or reset, so
  // the state would be unrepairable.
  if (!planned) return {};
  return { plannedFor: planned, anchorToPersist: anchor };
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
  return previousShotBefore(date, shots, exceptId)?.date;
}

/**
 * The same question, answered with the SHOT rather than just its date.
 *
 * The log form needs the id as well: the soreness answers describe the previous
 * shot's site, so they are written onto that entry. One owner for "which shot
 * came before this one", so the id and the date can never disagree about which
 * shot that is.
 */
export function previousShotBefore<T extends { id: string; date: string }>(
  date: string,
  shots: T[],
  exceptId?: string,
): T | undefined {
  let best: T | undefined;
  for (const shot of shots) {
    // `>`, not `>=`: a shot logged on the SAME civil date is still the one
    // before this one. Skipping it reached past to the shot before that, and
    // froze a planned date measured from the wrong reference — a plausible
    // mis-log (two entries on one day) producing a wrong value that only a hand
    // edit could repair. A shot cannot be its own predecessor because `exceptId`
    // removes it, and a brand-new shot has no id in the list yet.
    if (shot.id === exceptId || shot.date > date) continue;
    if (best === undefined || shot.date > best.date) best = shot;
  }
  return best;
}

/**
 * The mirror: the shot logged immediately AFTER `date`.
 *
 * The settled block uses it when editing, to say what window the question
 * covers — "how long was it sore" is about the days following that shot, and
 * the next shot is where those days stop being attributable to it.
 *
 * `>`, strictly, where {@link previousShotBefore} keeps a same-day shot. That
 * is deliberate and the two must not disagree: a shot on the same civil date is
 * the PREVIOUS one by that function's rule, so admitting it here as well would
 * let one entry be both the predecessor and the successor of another.
 *
 * A separate named owner rather than an inline filter, for the reason the
 * function above gives: one place answers "which shot came next", so the id and
 * the date can never disagree about which shot that is.
 */
export function nextShotAfter<T extends { id: string; date: string }>(
  date: string,
  shots: T[],
  exceptId?: string,
): T | undefined {
  let best: T | undefined;
  for (const shot of shots) {
    if (shot.id === exceptId || shot.date <= date) continue;
    if (best === undefined || shot.date < best.date) best = shot;
  }
  return best;
}

/**
 * The date a grid anchor is established from: the most recent date this app
 * knows about — the shot being saved, or a later one already on record when
 * this save is a backdated entry.
 *
 * It used to be the EARLIEST shot, and that was wrong in a way no amount of
 * reading found. An anchor is re-derived whenever the cadence or shot day
 * changes, and the earliest shot is the same date before and after such a
 * change — so clearing the stored anchor accomplished nothing, and the new
 * cadence inherited the old grid's phase. A user whose shots then fell on the
 * other phase read a fixed offset on every shot, frozen at log time and
 * therefore permanent: -7 on a fortnightly cadence, -14 on 28 days, -21 on the
 * 12-week chip.
 *
 * Measured over 2250 combinations of before/after interval, prior-shot count,
 * gap length and weekday, asking only "does perfect adherence read 0?":
 * anchoring on the earliest shot was wrong in 1317 of them, and on the latest
 * EXISTING shot in 1350 — the naive fix is worse, because no past shot is a
 * whole number of NEW intervals away. Anchoring on the most recent date known
 * is wrong in none.
 *
 * Why the max rather than simply the shot being saved: those two differ only
 * when a backdated entry is the first save after a settings change, and
 * anchoring the whole future grid on a forgotten shot from months ago
 * reintroduces the same permanent offset by another route. Measured, again.
 *
 * The shot being edited is deliberately NOT excluded — see the call site.
 */
export function anchorReferenceDate(
  date: string,
  shots: { id: string; date: string }[],
  notAfter: string,
): string {
  // A shot dated in the FUTURE is not evidence about anyone's rhythm, and it
  // must never become the reference. Taking the plain maximum meant one such
  // entry anchored the whole grid: swept over 7280 combinations of interval,
  // shot day and how far ahead it sat, 4126 (56.7%) shifted a later shot's
  // planned date and 2023 inverted its sign — 2 days late reading as 5 days
  // early. Lateness is frozen at log time, so each shot after it is born wrong
  // and then protected from correction.
  //
  // The log form now refuses a future date, so this is defence rather than the
  // primary fix — and it is the half that covers what the form cannot reach:
  // entries already stored from before that rule, and anything arriving through
  // import. Import is deliberately NOT tightened to match the form, because a
  // backup written at 23:00 in one timezone can legitimately restore where it is
  // still the previous day, and skipping the user's own entry over that is worse
  // than ignoring it here.
  //
  // NOT the same thing as clamping a chart axis, which this project rejects: the
  // shot keeps its date everywhere it is shown, exported and edited. It is only
  // excluded from being the SCHEDULE's reference, which is a claim about rhythm
  // that a dose not yet taken cannot support.
  // `notAfter` is PASSED IN rather than read from the clock here. Reading it
  // inside would make pure schedule maths depend on the current date, which is
  // the moving-baseline trap this codebase has already paid for once — and it
  // is not theoretical: doing it that way broke the 3060-case adherence sweep,
  // whose fixtures run past today by construction and are meant to be
  // clock-independent. The caller knows what "not yet taken" means; this
  // function only applies it.
  let best = date <= notAfter ? date : notAfter;
  for (const shot of shots) {
    if (shot.date > best && shot.date <= notAfter) best = shot.date;
  }
  return best;
}
