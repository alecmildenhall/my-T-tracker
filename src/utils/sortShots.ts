// src/utils/sortShots.ts
import type { ShotEntry } from "../types/shot";

/**
 * Chronological comparator for shots: by date, then time (a missing time sorts
 * as 00:00), then id as a stable tiebreak so equal timestamps keep a
 * deterministic order. Ascending (oldest first) — negate the result for
 * newest-first. Shared by the export (oldest-first clinical log) and the history
 * list (newest-first) so the two can never disagree on ordering.
 */
export function compareShotsChrono(a: ShotEntry, b: ShotEntry): number {
  const ka = `${a.date}T${a.time ?? "00:00"}`;
  const kb = `${b.date}T${b.time ?? "00:00"}`;
  if (ka < kb) return -1;
  if (ka > kb) return 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
