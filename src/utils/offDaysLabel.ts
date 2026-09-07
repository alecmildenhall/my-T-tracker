// src/utils/offDaysLabel.ts
import type { OffDaysPattern } from "../types/shot";

/**
 * The three ways an off-days pattern becomes words, and the one way it becomes
 * a picture. Shared, for the reason `painLabel` is: several surfaces render
 * these, and a value that reads one way in one place and another elsewhere is
 * drift nobody notices until a screenshot goes to a doctor.
 *
 * There are two label sets rather than one because the log sheet draws the
 * interval beside each option and the other surfaces do not.
 */

/**
 * Self-contained wording, for anywhere the answer appears ALONE — the History
 * facet and the row pill. These have to survive with no picture beside them and
 * no question above them, so they name the shot they are anchored to.
 */
const LABELS: Record<OffDaysPattern, string> = {
  none: "Not really",
  "right-after": "Right after the last shot",
  "here-and-there": "Here and there",
  "right-before": "Right before this shot",
  "most-of-the-time": "Most days",
};

/**
 * Short wording, for the log sheet's rows, where the strip draws the position
 * and the question sits directly above.
 *
 * Five long phrases were measured as the thing that made the group hard to
 * read: three of them were positional variants differing in the MIDDLE of the
 * phrase ("Right after the last one" against "Right before this one"), so you
 * re-read to find the difference. Short labels put the difference first, and
 * one row stops wrapping.
 */
const SHORT: Record<OffDaysPattern, string> = {
  none: "Not really",
  "right-after": "Early on",
  "here-and-there": "Here and there",
  "right-before": "Right before",
  "most-of-the-time": "Most days",
};

/**
 * What assistive tech is given for each row, and it is NOT optional.
 *
 * Shortening the visible words moves the position into the strip, and the strip
 * is `aria-hidden` — so without this, "Early on" is early in nothing and the
 * information exists only in dots a screen reader cannot see (WCAG 1.3.1).
 *
 * Each one STARTS with its visible label, which is what WCAG 2.5.3 (Label in
 * Name) asks for: extra context after the visible text is allowed, and leading
 * with it keeps voice control working — "tap Early on" still matches.
 */
const SPOKEN: Record<OffDaysPattern, string> = {
  none: "Not really",
  "right-after": "Early on — the days right after your last shot",
  "here-and-there": "Here and there — scattered across the interval",
  "right-before": "Right before — the days right before this shot",
  "most-of-the-time": "Most days",
};

/**
 * Where the off days sit, as eight slots across the interval. Decorative by
 * design: `SPOKEN` carries the same fact in words, so the strip is safely
 * `aria-hidden` rather than being the only carrier of it.
 *
 * Note that `right-after`, `here-and-there` and `right-before` all light THREE
 * slots. That is the point of drawing it — a count cannot tell them apart, and
 * only the position can.
 */
const STRIPS: Record<OffDaysPattern, readonly boolean[]> = {
  none: [false, false, false, false, false, false, false, false],
  "right-after": [true, true, true, false, false, false, false, false],
  "here-and-there": [false, true, false, false, true, false, true, false],
  "right-before": [false, false, false, false, false, true, true, true],
  "most-of-the-time": [true, true, false, true, true, true, false, true],
};

/** Self-contained wording, for the History facet and the row pill. */
export function offDaysLabel(pattern: OffDaysPattern): string {
  return LABELS[pattern];
}

/** Short wording, for the log sheet's rows, where the strip carries position. */
export function offDaysShortLabel(pattern: OffDaysPattern): string {
  return SHORT[pattern];
}

/** The accessible name for a log-sheet row. Always starts with the short label. */
export function offDaysSpokenLabel(pattern: OffDaysPattern): string {
  return SPOKEN[pattern];
}

/** Eight slots across the interval; `true` is an off day. Decorative. */
export function offDaysStrip(pattern: OffDaysPattern): readonly boolean[] {
  return STRIPS[pattern];
}
