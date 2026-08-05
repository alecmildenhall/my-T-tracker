// src/hooks/useShots.ts
import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { ShotEntry } from "../types/shot";
import { STORAGE_KEYS } from "../storageKeys";
import { normalizeValue, type TextField } from "../utils/suggestions";
import { isBlank } from "../utils/strings";

export interface UseShots {
  shots: ShotEntry[];
  /** Append a shot. Returns whether it actually reached storage. */
  addShot: (shot: ShotEntry) => boolean;
  /** Replace a shot. Returns whether it actually reached storage. */
  updateShot: (id: string, updatedShot: ShotEntry) => boolean;
  deleteShot: (id: string) => boolean;
  /** Rename every occurrence of a value in a field; merges if the new name already exists. */
  renameValue: (field: TextField, from: string, to: string) => boolean;
  /** Remove a value from a field on every shot that uses it (clears it to undefined). */
  clearValue: (field: TextField, value: string) => boolean;
  /** Replace the entire shot list atomically (used when restoring a backup). */
  replaceAll: (next: ShotEntry[]) => boolean;
}

/**
 * Custom hook for managing shot data operations.
 * Encapsulates localStorage persistence and provides a clean API
 * for adding, deleting, and retrieving shots.
 */
/**
 * Coerce whatever is in storage into a usable ShotEntry[]. localStorage can hold
 * a non-array (corruption, a devtools edit, an old schema) or an array with junk
 * entries, either of which would crash rendering. Kept deliberately lenient — an
 * object with a string id is accepted, unknown fields and all — so evolving the
 * model never discards the user's own data (unlike the strict import schema,
 * which guards untrusted files). Bad top-level values fall back to empty.
 */
function sanitizeShots(raw: unknown): ShotEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    // Require id and date to be present and non-blank: a shot with a missing or
    // empty date is meaningless in a date-based tracker and can't be produced by
    // the form (which marks date `required`). This enforces *presence* only, not
    // date *validity* — a hand-edited but non-blank date like "2026-13-40" still
    // passes here (kept lenient on purpose, so a schema tweak never silently drops
    // a user's own data). Downstream can therefore trust id/date to be non-blank
    // strings, not to be well-formed dates. A blank one is dropped as corruption.
    (s): s is ShotEntry =>
      typeof s === "object" &&
      s !== null &&
      !isBlank((s as { id?: unknown }).id) &&
      !isBlank((s as { date?: unknown }).date)
  );
}

export function useShots(): UseShots {
  const [shots, , persistShots] = useLocalStorage<ShotEntry[]>(
    STORAGE_KEYS.shots,
    [],
    { sanitize: sanitizeShots }
  );

  // EVERY mutation goes through `persistShots`, which writes to storage and only
  // then commits to state, returning whether it landed. Two reasons:
  //
  // 1. The caller can finally ask "did my shot save?" and get the truth, so the
  //    log sheet can hold onto what was typed instead of closing on a write that
  //    threw. Nothing half-saved sits in the list waiting to be duplicated by the
  //    retry, because a refused write commits nothing at all.
  // 2. One path, one notion of "current". Mixing `persistShots` with plain
  //    `setShots` gave the store two: `setShots` queues a functional update React
  //    applies later, so a `persistShots` call in the same tick read a snapshot
  //    that predated it and wrote the stale list back — a delete followed by an
  //    add resurrected the deleted shot.
  const addShot = useCallback(
    (shot: ShotEntry) => persistShots((prev) => [...prev, shot]),
    [persistShots]
  );

  const updateShot = useCallback(
    (id: string, updatedShot: ShotEntry) =>
      persistShots((prev) =>
        prev.map((shot) => (shot.id === id ? updatedShot : shot))
      ),
    [persistShots]
  );

  const deleteShot = useCallback(
    (id: string) => persistShots((prev) => prev.filter((shot) => shot.id !== id)),
    [persistShots]
  );

  const renameValue = useCallback(
    (field: TextField, from: string, to: string) => {
      const target = to.trim();
      if (!target) return true; // nothing to write, so nothing failed
      return persistShots((prev) =>
        prev.map((shot) => {
          const current = shot[field];
          return typeof current === "string" &&
            normalizeValue(current) === normalizeValue(from)
            ? { ...shot, [field]: target }
            : shot;
        })
      );
    },
    [persistShots]
  );

  const clearValue = useCallback(
    (field: TextField, value: string) =>
      persistShots((prev) =>
        prev.map((shot) => {
          const current = shot[field];
          return typeof current === "string" &&
            normalizeValue(current) === normalizeValue(value)
            ? { ...shot, [field]: undefined }
            : shot;
        })
      ),
    [persistShots]
  );

  const replaceAll = useCallback(
    (next: ShotEntry[]) => persistShots(next),
    [persistShots]
  );

  return {
    shots,
    addShot,
    updateShot,
    deleteShot,
    renameValue,
    clearValue,
    replaceAll,
  };
}
