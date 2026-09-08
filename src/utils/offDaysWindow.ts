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

/**
 * What window the question is asking about — ALWAYS a string, never null.
 *
 * The anchor used to disappear when the length was unknown, which is the one
 * shot where it was needed most: on a first entry there is no predecessor to
 * measure from, so the only surface naming the window vanished for the person
 * with the least context. And "since when" was never in the question itself, so
 * nothing on screen said it.
 *
 * "Since your previous shot" is true even when the app cannot compute it —
 * someone logging their first shot here may have been injecting for years and
 * knows their own previous one. So this says WHAT the window is always, and adds
 * HOW LONG only when it knows, which is the same split the planned date already
 * uses when the schedule cannot answer.
 *
 * "Previous", not "last", and not by preference: "your last shot" means the most
 * recent one, so on an entry from three months ago the words and the number
 * described different things. "Previous" is relative to the shot in front of
 * you, which is what is measured — and it matches `offDaysLabel`, which anchors
 * on "the previous shot" for the same reason.
 *
 * The ISO dates stay out of it. Every date this app displays is the stored
 * string, and ShotListItem's comment warns against inventing a second format.
 * Measured at 236px — the narrowest this field ever gets, at a 561px viewport,
 * NOT on a phone — this fits one line where "Since the shot before this one ·
 * 13 days" wraps.
 */
export function offDaysWindowLabel(days: number | null): string {
  const anchor = "Since your previous shot";
  if (days === null) return anchor;
  return `${anchor} · ${days} ${days === 1 ? "day" : "days"}`;
}
