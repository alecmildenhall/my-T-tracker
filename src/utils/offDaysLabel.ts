// src/utils/offDaysLabel.ts
import type { OffDaysPattern } from "../types/shot";

/**
 * The one place a stored off-days pattern becomes words for a reader.
 *
 * Shared for the same reason `painLabel` is: three surfaces render it — the log
 * sheet's chips, the History filter and the row pill — and a value that reads
 * one way in one place and another elsewhere is drift nobody notices until a
 * screenshot goes to a doctor.
 *
 * The labels are the question's answers verbatim. They read as replies to "any
 * days you felt off?", which is what keeps them one set: an earlier draft mixed
 * "Early on" (a place in the interval) with "Before this shot" (a distance from
 * an event), and they stopped sounding like answers to the same question.
 *
 * "Right before this one" and not merely "before this shot", because the ENTIRE
 * interval is before this shot — only "right before" says near it.
 */
const LABELS: Record<OffDaysPattern, string> = {
  none: "Not really",
  "here-and-there": "Here and there",
  "right-before": "Right before this one",
  "most-of-the-time": "Most of the time",
};

export function offDaysLabel(pattern: OffDaysPattern): string {
  return LABELS[pattern];
}
