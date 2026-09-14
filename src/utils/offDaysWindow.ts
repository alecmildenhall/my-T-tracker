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
 * it says nothing rather than guessing. Same for a date the form cannot parse
 * yet, which is every date halfway through being typed.
 *
 * `null` means UNKNOWN and nothing else. A same-day repeat returns `0`, not
 * `null` -- it used to return `null` on the reasoning that a zero-length window
 * has no days in it to have felt off, which is true about the question and
 * wrong about this value. It made `null` carry two meanings, "there is no
 * predecessor" and "the gap is zero", and they render identically -- so the one
 * case where the app knows the span EXACTLY was displayed the same as the case
 * where it has no idea. Zero is a number the app knows; the rule about optional
 * numbers here has always been that `0` is an answer, not an absence.
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
  // Only a NEGATIVE gap is unknowable -- it would mean the predecessor helper
  // handed back a later shot, so nothing here can be trusted to name a span.
  // Zero is a real, knowable answer and passes straight through.
  return days >= 0 ? days : null;
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
 * The length is folded INTO the sentence rather than hung off a separator. A
 * "·" reads as metadata — a chip beside a label — where this is the sentence's
 * own content, and the guidance on relative time says the same: it belongs
 * "within a sentence, following the action that it's relative to".
 *
 * "BEFORE THIS ONE", never "ago", and never "today". That is an accuracy rule
 * rather than a style one, and the obvious wording is wrong: "ago" and "today"
 * are relative to NOW, while this window is relative to THE SHOT BEING LOGGED.
 * Measured before the change — logging a shot dated 1 June with a previous shot
 * that same day reported "today", months after the fact. Every backdated entry
 * would have inherited the error the moment "N days ago" replaced "N days".
 *
 * Naming the reference out loud is what makes that safe rather than merely
 * true. "4 days earlier" was accurate and left the question open — earlier than
 * what? — so the reader supplies "than now", which is the very error being
 * avoided. "taken 4 days before this one" cannot be read that way.
 *
 * "taken" earns its five characters by making the clause grammatical rather
 * than elliptical: it is a participle modifying the shot ("your previous shot,
 * TAKEN 4 days before this one"), where the bare "4 days before this one" hung
 * off the comma as a fragment the reader had to attach for themselves.
 *
 * "the day before this one" for a one-day gap, on the same reasoning that rules
 * out "yesterday": the relative-time guidance prefers a named day at that
 * distance, and every name it offers is anchored to now.
 *
 * The dates themselves stay out of it. Every date this app displays is the
 * stored ISO string, and ShotListItem's comment warns against inventing a
 * second format on the same surface.
 */
export function offDaysWindowLabel(days: number | null): string {
  const anchor = "Since your previous shot";
  if (days === null) return anchor;
  if (days === 0) return `${anchor}, taken the same day as this one`;
  if (days === 1) return `${anchor}, taken the day before this one`;
  return `${anchor}, taken ${days} days before this one`;
}
