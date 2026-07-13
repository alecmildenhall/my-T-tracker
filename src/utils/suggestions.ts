// src/utils/suggestions.ts
import type { ShotEntry } from "../types/shot";

/** Canonical form for matching values: trimmed and lower-cased. */
export const normalizeValue = (value: string): string => value.trim().toLowerCase();

/** Free-text categorical fields users can reuse and manage. */
export type TextField =
  | "injectionSite"
  | "injectionSitePosition"
  | "testosteroneEster"
  | "carrierOil"
  | "mood";

/** Fields that can be reused from past entries as tap suggestions. */
export type SuggestField = TextField | "doseMg";

/** A distinct value and how many shots use it. */
export interface ValueGroup {
  value: string;
  count: number;
}

interface Accum {
  display: string;
  count: number;
  lastIndex: number;
}

/**
 * Collapse a field's values across shots into distinct entries. Matching is
 * case-insensitive and trimmed, so "Cypionate", "cypionate " and "CYPIONATE"
 * fold into one; the display form kept is the one from the most recent entry.
 * Numeric fields (e.g. doseMg) are stringified, so a dose of 50 yields "50".
 * Expects `shots` in chronological order (oldest first) — how `useShots` stores
 * them — so `lastIndex` reflects recency.
 */
function accumulate(shots: ShotEntry[], field: SuggestField): Accum[] {
  const seen = new Map<string, Accum>();

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

    const key = normalizeValue(value);
    const existing = seen.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastIndex = index;
      existing.display = value; // most recent display form wins
    } else {
      seen.set(key, { display: value, count: 1, lastIndex: index });
    }
  });

  return [...seen.values()];
}

/**
 * Distinct values a user has previously entered for a field, **most recently
 * used first**, for one-tap reuse while logging. Shot history is the single
 * source of truth — there is no separate stored list to keep in sync.
 */
export function suggestionsFor(shots: ShotEntry[], field: SuggestField): string[] {
  return accumulate(shots, field)
    .sort((a, b) => b.lastIndex - a.lastIndex)
    .map((entry) => entry.display);
}

/**
 * Distinct values for a categorical field with a usage count each, most-used
 * first (ties alphabetical). Used by the manage-values screen so the canonical
 * value floats to the top and stray one-offs are easy to spot and clean up.
 */
export function valueGroupsFor(shots: ShotEntry[], field: TextField): ValueGroup[] {
  return accumulate(shots, field)
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display))
    .map((entry) => ({ value: entry.display, count: entry.count }));
}
