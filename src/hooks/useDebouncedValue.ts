// src/hooks/useDebouncedValue.ts
import { useEffect, useState } from "react";

/**
 * The value, settled: updates only after `delayMs` has passed with no further
 * change. Used for the History search box so filtering runs on a pause in typing
 * rather than on every keystroke.
 *
 * The work being debounced is purely in-memory (see shotQuery) — there is no
 * network call to save — so the delay exists to keep re-renders and the
 * `aria-live` result announcement calm, not to save bandwidth. Keep it short
 * enough to still feel instant.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return settled;
}
