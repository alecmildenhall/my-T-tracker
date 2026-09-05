// src/utils/offDaysWindow.ts
import { daysBetweenCivil } from "./milestones";
import { isShotDateInRange } from "./civilDate";
import { previousShotDateBefore } from "./schedule";

/**
 * How many days the "any days you felt off?" question is asking about — the gap
 * back to the previous shot — or `null` when there is no previous shot to
 * measure from.
 *
 * The question needs its recall window NAMED rather than assumed, which is
 * standard for any symptom instrument. "This week" would be plain wrong here:
 * cadence in this app runs from 3 to 14 days, so a fixed word is wrong for most
 * people. Naming the real span is also what lets the four answers keep one
 * meaning each at any interval length — the chips never change, the span does.
 *
 * `null` for the first shot is not a failure. The question still gets asked,
 * because someone logging their first shot here may have been injecting for
 * years and knows their own last one; the app simply cannot name the window, so
 * it says nothing rather than guessing. It is also `null` for a same-day repeat
 * (a zero-length window has no days in it to have felt off) and for a date the
 * form cannot parse yet, which is every date halfway through being typed.
 *
 * `excludeId` keeps a shot being EDITED from being its own predecessor.
 */
export function offDaysWindowDays(
  shots: { id: string; date: string }[],
  date: string,
  excludeId?: string,
): number | null {
  if (!isShotDateInRange(date)) return null;
  // `previousShotDateBefore` rather than another scan of the same list. It
  // already owns "which shot came before this one", including the rule that a
  // shot cannot be its own predecessor, and it deliberately counts a SAME-DAY
  // shot as the one before — right for the schedule, where two entries on one
  // day are a plausible mis-log. This function only has to decide whether that
  // gap is a window worth naming, which the `> 0` below does.
  const previous = previousShotDateBefore(date, shots, excludeId);
  if (previous === undefined || !isShotDateInRange(previous)) return null;
  const days = daysBetweenCivil(previous, date);
  return days > 0 ? days : null;
}

/** "Since your last shot · 13 days", or null when the window is unknown. */
export function offDaysWindowLabel(days: number | null): string | null {
  if (days === null) return null;
  // The ISO date is deliberately NOT spelled out here. Every date this app
  // displays is the stored ISO string, and ShotListItem's own comment warns
  // against "inventing a second format" — a friendly "12–25 Aug" beside a
  // `2026-08-25` field would be exactly that. The day count is the part that
  // does the work; the dates are one tap away in History.
  return `Since your last shot · ${days} ${days === 1 ? "day" : "days"}`;
}
