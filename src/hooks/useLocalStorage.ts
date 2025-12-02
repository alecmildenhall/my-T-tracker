// src/hooks/useLocalStorage.ts
import { useEffect, useState } from "react";

type InitialValue<T> = T | (() => T);

export function useLocalStorage<T>(key: string, initialValue: InitialValue<T>) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return typeof initialValue === "function"
        ? (initialValue as () => T)()
        : initialValue;
    }

    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch (error) {
      console.warn("[useLocalStorage] Failed to read from localStorage:", error);
    }

    return typeof initialValue === "function"
      ? (initialValue as () => T)()
      : initialValue;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("[useLocalStorage] Failed to write to localStorage:", error);
    }
  }, [key, value]);

  return [value, setValue] as const;
}
