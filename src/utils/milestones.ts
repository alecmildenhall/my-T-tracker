// src/utils/milestones.ts
// HRT milestone logic, driven by *time on T* (not shot count — skipped or shifted
// shots are normal). All arithmetic is on civil dates (plain YYYY-MM-DD), never
// `new Date("YYYY-MM-DD")` — that parses as UTC midnight and shifts the day for
// anyone west of UTC. Parsing/validation goes through civilDate.ts.
//
// Cadence: every month through the first year (1..12), every three months in the
// second year (15, 18, 21, 24), then every six months after two years (30, 36,
// ...). A milestone is "celebratable" only on or after its date and for a short
// window (~2 weeks) — never before it. Only the most recent milestone is surfaced.
import { todayLocalISO } from "./datetime";
import { civilDateParts, type CivilDate } from "./civilDate";

// How long after a milestone's date we keep celebrating it. Year-one *monthly*
// milestones get a short window so the greeting doesn't linger most of the time;
// whole-year anniversaries (12, 24, 36 ...) and all later milestones get the full
// two weeks, since they're bigger, rarer landmarks.
export const YEAR_ONE_WINDOW_DAYS = 7;
export const LATER_WINDOW_DAYS = 14;

/** True when a milestone in months lands on a whole-year anniversary (12, 24, ...). */
function isWholeYear(months: number): boolean {
  return months % 12 === 0;
}

/** Celebration window (days) for a milestone at `months` on T. Whole-year
 *  anniversaries always get the full window; the other (monthly) year-one
 *  milestones get the shorter one. */
export function celebrationWindowDays(months: number): number {
  if (!isWholeYear(months) && months <= 12) return YEAR_ONE_WINDOW_DAYS;
  return LATER_WINDOW_DAYS;
}

export interface Milestone {
  /** Months on T this milestone marks: every month in year one (1..12), then
   *  15, 18, 21, 24 in year two, then 30, 36, ... after two years. */
  months: number;
  /** Human label, e.g. "1 month", "1 year", "15 months", "2 years". */
  label: string;
  /** Civil date (YYYY-MM-DD) the milestone was reached. */
  date: string;
}

/** Days in a civil month (`month` is 1-based). Uses Date purely for month length,
 *  which is timezone-independent. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Whole months elapsed from `start` to `today`, civil. Counts a month as complete
 * only once the day-of-month is reached (Jan 15 → Feb 14 is 0 months, Feb 15 is 1).
 * Negative if `start` is in the future.
 */
export function monthsOnT(startISO: string, todayISO: string): number {
  const start = civilDateParts(startISO);
  const today = civilDateParts(todayISO);
  if (!start || !today) return NaN;
  const [sy, sm, sd] = start;
  const [ty, tm, td] = today;
  let months = (ty - sy) * 12 + (tm - sm);
  // A month completes when the start day-of-month is reached. If the start day
  // exceeds the target month's length (e.g. a Jan-31 start in February), it
  // completes on that month's last day instead — matching addMonthsCivil's clamp,
  // so the two helpers agree on when a month-end milestone lands.
  const dueDay = Math.min(sd, daysInMonth(ty, tm));
  if (td < dueDay) months -= 1;
  return months;
}

/** Add `months` to a civil date, clamping the day to the target month's length
 *  (Jan 31 + 1 month → Feb 28/29). Returns YYYY-MM-DD. */
export function addMonthsCivil(startISO: string, months: number): string {
  const start = civilDateParts(startISO);
  if (!start) return startISO;
  const [y, m, d] = start;
  const total = y * 12 + (m - 1) + months; // months since year 0, 0-based month
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12; // 0-based month in [0, 11]
  const nd = Math.min(d, daysInMonth(ny, nm + 1));
  const mm = String(nm + 1).padStart(2, "0");
  const dd = String(nd).padStart(2, "0");
  return `${ny}-${mm}-${dd}`;
}

/** Whole days from `a` to `b`, civil (b - a). Both anchored to UTC midnight so the
 *  count is DST-proof; they're treated purely as calendar dates. */
export function daysBetweenCivil(aISO: string, bISO: string): number {
  const a = civilDateParts(aISO);
  const b = civilDateParts(bISO);
  if (!a || !b) return NaN;
  const aUTC = Date.UTC(a[0], a[1] - 1, a[2]);
  const bUTC = Date.UTC(b[0], b[1] - 1, b[2]);
  return Math.round((bUTC - aUTC) / 86_400_000);
}

/** The most recent milestone threshold reached at `months` on T, or null if none
 *  (under one month). Every month in year one, every 3 months in year two, every
 *  6 months after two years. */
export function mostRecentThreshold(months: number): number | null {
  if (!Number.isFinite(months) || months < 1) return null;
  const m = Math.floor(months);
  if (m <= 12) return m; // year one: every month (1..12)
  if (m < 24) return 12 + Math.floor((m - 12) / 3) * 3; // year two: every 3 months
  return 24 + Math.floor((m - 24) / 6) * 6; // after two years: every 6 months
}

/** Friendly label for a milestone in months, expressed as years + months so it
 *  reads warmly rather than clinically: "1 month", "1 year", "1 year 3 months",
 *  "2 years 6 months", "3 years". Never months-only past a year (no "15 months").
 *  Singular/plural is kept correct on each part. */
export function milestoneLabel(months: number): string {
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const yearPart = years ? `${years} year${years === 1 ? "" : "s"}` : "";
  const monthPart = rem ? `${rem} month${rem === 1 ? "" : "s"}` : "";
  if (yearPart && monthPart) return `${yearPart} ${monthPart}`;
  return yearPart || monthPart;
}

/**
 * The milestone to celebrate right now, or null. Returns the most recent milestone
 * reached, but only on or after its date and for up to its celebration window
 * (see celebrationWindowDays) — never before the date (a milestone is never
 * previewed). A start date in the future or unset, or a window that has passed,
 * yields nothing. `todayISO` defaults to today's local date.
 *
 * Both dates are `CivilDate`, so the caller has already validated any untrusted
 * string (e.g. `Profile.startDate` from storage) through `toCivilDate` — an
 * impossible date can't reach this entry point. The low-level arithmetic helpers
 * still take plain strings and re-derive [y, m, d] themselves (a `CivilDate` is a
 * string), so they stay independently usable and defensively tested; that extra
 * parse is intentional, not a missing optimization.
 */
export function currentMilestone(
  startISO: CivilDate | undefined,
  todayISO: CivilDate = todayLocalISO()
): Milestone | null {
  if (!startISO) return null;
  const months = monthsOnT(startISO, todayISO);
  const threshold = mostRecentThreshold(months);
  if (threshold === null) return null;

  const date = addMonthsCivil(startISO, threshold);
  const daysSince = daysBetweenCivil(date, todayISO);
  // daysSince < 0 → today is before the milestone date: never show early.
  // daysSince > window → the celebration window has passed.
  if (
    !Number.isFinite(daysSince) ||
    daysSince < 0 ||
    daysSince > celebrationWindowDays(threshold)
  ) {
    return null;
  }
  return { months: threshold, label: milestoneLabel(threshold), date };
}
