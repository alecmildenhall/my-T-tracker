// src/hooks/useLocalStorage.ts
import { useEffect, useRef, useState } from "react";

type InitialValue<T> = T | (() => T);

interface Options<T> {
  /**
   * Normalize a value parsed from storage before it becomes state. localStorage
   * is untrusted input (corruptable, hand-editable via devtools, or left over
   * from an older app version), so `JSON.parse` succeeding doesn't mean the shape
   * is valid. Return a safe value; return the initial value to discard garbage.
   * Applied on the initial read and on cross-tab storage events. Keep it lenient
   * (shape check, not a strict whitelist) so a future field doesn't drop the
   * user's own data.
   */
  sanitize?: (raw: unknown) => T;
}

const resolveInitial = <T,>(initialValue: InitialValue<T>): T =>
  typeof initialValue === "function"
    ? (initialValue as () => T)()
    : initialValue;

export function useLocalStorage<T>(
  key: string,
  initialValue: InitialValue<T>,
  options?: Options<T>
) {
  // Keep the latest initialValue/sanitize without re-subscribing effects on every
  // render (callers commonly pass a fresh literal like `[]` or inline function).
  // Updated in an effect, not during render, so we never mutate a ref while
  // rendering.
  const initialRef = useRef(initialValue);
  const sanitizeRef = useRef(options?.sanitize);
  useEffect(() => {
    initialRef.current = initialValue;
    sanitizeRef.current = options?.sanitize;
  });

  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return resolveInitial(initialValue);
    }

    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        const parsed = JSON.parse(stored) as unknown;
        return options?.sanitize ? options.sanitize(parsed) : (parsed as T);
      }
    } catch (error) {
      console.warn("[useLocalStorage] Failed to read from localStorage:", error);
    }

    return resolveInitial(initialValue);
  });

  useEffect(() => {
    try {
      const serialized = JSON.stringify(value);
      // Skip a redundant write when storage already holds this exact value. This
      // avoids a needless write on mount AND breaks the cross-tab echo loop: a
      // value applied *from* another tab's storage event is already persisted,
      // so we don't re-write it and fire the event back.
      if (window.localStorage.getItem(key) === serialized) return;
      window.localStorage.setItem(key, serialized);
    } catch (error) {
      console.warn("[useLocalStorage] Failed to write to localStorage:", error);
    }
  }, [key, value]);

  // Stay in sync when another tab changes the same key.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.storageArea !== window.localStorage) return;
      if (e.newValue === null) {
        // The key was removed in another tab — fall back to the initial value.
        setValue(resolveInitial(initialRef.current));
        return;
      }
      try {
        const parsed = JSON.parse(e.newValue) as unknown;
        const sanitize = sanitizeRef.current;
        setValue(sanitize ? sanitize(parsed) : (parsed as T));
      } catch (error) {
        console.warn("[useLocalStorage] Failed to parse storage event:", error);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  return [value, setValue] as const;
}
