// src/utils/sortShots.ts
import type { ShotEntry } from "../types/shot";

/**
 * Chronological comparator for shots: by date, then time (a missing time sorts
 * as 00:00). Ascending (oldest first) — negate the result for newest-first.
 * Shared by the export (oldest-first clinical log) and the history list
 * (newest-first) so the two can never disagree on ordering.
 *
 * **Exact ties return 0 — deliberately.** This used to fall back to comparing
 * ids, described as "a stable tiebreak so equal timestamps keep a deterministic
 * order". Deterministic it was; meaningful it was not, because an id is a random
 * UUID. Time is optional, so every pair of shots logged on the same day with no
 * time ties, and which one the app called "most recent" was a coin flip.
 *
 * That was not theoretical. It put the shot you had *just logged* below three
 * same-day ones, so it never entered the Home teaser: no row arrived, no wash
 * played, and the greeting still said "Logged for you." — told it landed, shown
 * nothing. `carryForward` in ShotForm had already been written to avoid this
 * comparator for the same reason, which was the signal that the comparator was
 * wrong rather than that it needed avoiding.
 *
 * Ties are now resolved by the order shots are STORED in, which is the order
 * they were logged (`addShot` appends). Callers get that by sorting stably — see
 * `sortShots`, which decorates with the index so the tiebreak reverses along
 * with the sort direction, and `chronological` in exportData, which relies on
 * Array#sort being stable (guaranteed since ES2019).
 */
export function compareShotsChrono(a: ShotEntry, b: ShotEntry): number {
  const ka = `${a.date}T${a.time ?? "00:00"}`;
  const kb = `${b.date}T${b.time ?? "00:00"}`;
  if (ka < kb) return -1;
  if (ka > kb) return 1;
  return 0;
}
