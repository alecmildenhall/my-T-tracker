// src/utils/painLabel.ts
import type { PainLevel } from "../types/shot";

/**
 * The one place a stored pain level becomes words for a reader.
 *
 * Shared rather than inlined because three surfaces render it — the log sheet's
 * chips, the History filter, and the row pill — and a level that reads "Mild"
 * in one and "mild" in another is the kind of drift nobody notices until a
 * screenshot goes to a doctor.
 */
const LABELS: Record<PainLevel, string> = {
  none: "None",
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
};

export function painLabel(level: PainLevel): string {
  return LABELS[level];
}
