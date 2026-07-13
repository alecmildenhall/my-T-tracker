// src/utils/suggestions.ts
import type { ShotEntry } from "../types/shot";

/** Canonical form for matching values: trimmed and lower-cased. */
export const normalizeValue = (value: string): string => value.trim().toLowerCase();

/** Fields that can be reused from past entries as tap suggestions. */
export type SuggestField =
  | "injectionSite"
  | "injectionSitePosition"
  | "testosteroneEster"
  | "carrierOil"
  | "mood"
  | "doseMg";

/**
 * Distinct values a user has previously entered for a field, **most recently
 * used first**. `shots` is expected in chronological order (oldest first) —
 * which is how `useShots` stores them, appending each new entry — so the value
 * from the latest shot appears first, and re-using a value moves it back to the
 * front. Matching is case-insensitive and trimmed, so "Cypionate", "cypionate "
 * and "CYPIONATE" collapse to a single suggestion; the display form kept is the
 * one from the most recent entry. Numeric fields (e.g. doseMg) are stringified,
 * so a dose of 50 suggests "50".
 *
 * Shot history is the single source of truth — there is no separate stored
 * list of options to keep in sync.
 */
export function suggestionsFor(shots: ShotEntry[], field: SuggestField): string[] {
  const seen = new Map<string, { display: string; lastIndex: number }>();

  shots.forEach((shot, index) => {
    const raw = shot[field];
    let value: string;
    if (typeof raw === "number") {
      value = String(raw);
    } else if (typeof raw === "string") {
      value = raw.trim();
    } else {
      return; // undefined / absent
    }
    if (!value) return;

    // Iterating oldest→newest, each occurrence overwrites with its (larger)
    // index and latest display form, so the map holds each value's last use.
    seen.set(normalizeValue(value), { display: value, lastIndex: index });
  });

  // Most recently used first.
  return [...seen.values()]
    .sort((a, b) => b.lastIndex - a.lastIndex)
    .map((entry) => entry.display);
}
