// src/hooks/useShots.ts
import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { ShotEntry } from "../types/shot";
import { STORAGE_KEYS } from "../storageKeys";

export interface UseShots {
  shots: ShotEntry[];
  addShot: (shot: ShotEntry) => void;
  updateShot: (id: string, updatedShot: ShotEntry) => void;
  deleteShot: (id: string) => void;
}

/**
 * Custom hook for managing shot data operations.
 * Encapsulates localStorage persistence and provides a clean API
 * for adding, deleting, and retrieving shots.
 */
export function useShots(): UseShots {
  const [shots, setShots] = useLocalStorage<ShotEntry[]>(
    STORAGE_KEYS.shots,
    []
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

  return {
    shots,
    addShot,
    updateShot,
    deleteShot,
  };
}
