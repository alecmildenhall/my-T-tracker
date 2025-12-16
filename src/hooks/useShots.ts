// src/hooks/useShots.ts
import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { ShotEntry } from "../types/shot";

const STORAGE_KEY = "hrt-shot-tracker:v1:shots";

export interface UseShots {
  shots: ShotEntry[];
  addShot: (shot: ShotEntry) => void;
  deleteShot: (id: string) => void;
}

/**
 * Custom hook for managing shot data operations.
 * Encapsulates localStorage persistence and provides a clean API
 * for adding, deleting, and retrieving shots.
 */
export function useShots(): UseShots {
  const [shots, setShots] = useLocalStorage<ShotEntry[]>(STORAGE_KEY, []);

  const addShot = useCallback(
    (shot: ShotEntry) => {
      setShots((prev) => [...prev, shot]);
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
    deleteShot,
  };
}
