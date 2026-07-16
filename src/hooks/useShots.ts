// src/hooks/useShots.ts
import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { ShotEntry } from "../types/shot";
import { STORAGE_KEYS } from "../storageKeys";
import { normalizeValue, type TextField } from "../utils/suggestions";

export interface UseShots {
  shots: ShotEntry[];
  addShot: (shot: ShotEntry) => void;
  updateShot: (id: string, updatedShot: ShotEntry) => void;
  deleteShot: (id: string) => void;
  /** Rename every occurrence of a value in a field; merges if the new name already exists. */
  renameValue: (field: TextField, from: string, to: string) => void;
  /** Remove a value from a field on every shot that uses it (clears it to undefined). */
  clearValue: (field: TextField, value: string) => void;
  /** Replace the entire shot list atomically (used when restoring a backup). */
  replaceAll: (next: ShotEntry[]) => void;
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
    (s): s is ShotEntry =>
      typeof s === "object" &&
      s !== null &&
      typeof (s as { id?: unknown }).id === "string" &&
      typeof (s as { date?: unknown }).date === "string"
  );
}

export function useShots(): UseShots {
  const [shots, setShots] = useLocalStorage<ShotEntry[]>(
    STORAGE_KEYS.shots,
    [],
    { sanitize: sanitizeShots }
  );

  const addShot = useCallback(
    (shot: ShotEntry) => {
      setShots((prev) => [...prev, shot]);
    },
    [setShots]
  );

  const updateShot = useCallback(
    (id: string, updatedShot: ShotEntry) => {
      setShots((prev) =>
        prev.map((shot) => (shot.id === id ? updatedShot : shot))
      );
    },
    [setShots]
  );

  const deleteShot = useCallback(
    (id: string) => {
      setShots((prev) => prev.filter((shot) => shot.id !== id));
    },
    [setShots]
  );

  const renameValue = useCallback(
    (field: TextField, from: string, to: string) => {
      const target = to.trim();
      if (!target) return;
      setShots((prev) =>
        prev.map((shot) => {
          const current = shot[field];
          return typeof current === "string" &&
            normalizeValue(current) === normalizeValue(from)
            ? { ...shot, [field]: target }
            : shot;
        })
      );
    },
    [setShots]
  );

  const clearValue = useCallback(
    (field: TextField, value: string) => {
      setShots((prev) =>
        prev.map((shot) => {
          const current = shot[field];
          return typeof current === "string" &&
            normalizeValue(current) === normalizeValue(value)
            ? { ...shot, [field]: undefined }
            : shot;
        })
      );
    },
    [setShots]
  );

  const replaceAll = useCallback(
    (next: ShotEntry[]) => {
      setShots(next);
    },
    [setShots]
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
