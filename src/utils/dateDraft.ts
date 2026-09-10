// src/utils/dateDraft.ts
import { isRealDate } from "./civilDate";

/** What leaving a date field should do to the value behind it. */
export type DateCommit =
  | { action: "set"; date: string }
  | { action: "clear" }
  | { action: "restore" };

/**
 * Decide what an abandoned date draft means, for every field that stores an
 * OPTIONAL date.
 *
 * An empty `<input type="date">` reports `""` for two different things — "I
 * cleared this" and "I am part-way through retyping" — and this used to be
 * treated as undecidable, so emptying a field restored the stored value and
 * removing was a separate button. That reasoning was right about the ambiguity
 * and wrong that nothing could resolve it: the platform already separates them.
 * Measured in Chromium, on the real control:
 *
 *   complete date        value "2025-09-08"  badInput false
 *   cleared outright     value ""            badInput false   <- deliberate
 *   month typed, no year value ""            badInput true    <- mid-edit
 *   one segment deleted  value ""            badInput true    <- mid-edit
 *
 * So `badInput` is the discriminator, which is exactly what the interval box
 * next door already trusts for a number. A cleared field now clears, which is
 * what the native "Reset" in the iOS picker has always appeared to do and
 * silently did not.
 *
 * Shared rather than written twice: these two fields have already drifted apart
 * once and answered the same question opposite ways, which is worse than either
 * answer on its own.
 *
 * The residual, stated rather than hidden: a browser that reports `badInput`
 * false for an incomplete date would clear on a mid-edit blur. That is the same
 * bet the interval field makes, and the failure is now recoverable in a way it
 * was not before — the value is optional, the field is right there, and Settings
 * still carries an explicit Remove.
 */
export function commitDateDraft(draft: string, badInput: boolean): DateCommit {
  if (isRealDate(draft)) return { action: "set", date: draft };
  // Empty AND well-formed: the field was emptied on purpose.
  if (draft === "" && !badInput) return { action: "clear" };
  // Half-typed, or unparseable: put back what is actually stored, rather than
  // leaving the field showing a value nothing holds.
  return { action: "restore" };
}
