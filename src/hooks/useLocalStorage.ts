// src/hooks/useLocalStorage.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { useStorageHealth } from "../context/StorageHealthContext";

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

/** Serialize and store one key, reporting the outcome. Returns whether it landed. */
function writeThrough<T>(
  key: string,
  value: T,
  reportWrite: (key: string, ok: boolean) => void,
  /**
   * Write even if storage already holds this exact value.
   *
   * "Try again" must actually try. Without this it was the one button in the app
   * guaranteed to lie: a refused write commits nothing, so state and storage stay
   * identical, the equality skip below short-circuits, success is reported, and
   * the banner clears with storage still refusing every write. For the shots
   * store — the only one that writes through `persist` — that made retry a
   * permanent no-op that always claimed to have worked.
   */
  force = false
): boolean {
  let ok = true;
  try {
    const serialized = JSON.stringify(value);
    // Skip a redundant write when storage already holds this exact value. This
    // avoids a needless write on mount AND breaks the cross-tab echo loop: a
    // value applied *from* another tab's storage event is already persisted,
    // so we don't re-write it and fire the event back. Storage already holding
    // it counts as persisted, so this still reports success.
    if (force || window.localStorage.getItem(key) !== serialized) {
      window.localStorage.setItem(key, serialized);
    }
  } catch (error) {
    ok = false;
    // Kept for a developer at a desk; the user is told by the banner, because
    // a console message is a report to someone who will never read it.
    console.warn("[useLocalStorage] Failed to write to localStorage:", error);
  }
  reportWrite(key, ok);
  return ok;
}

export function useLocalStorage<T>(
  key: string,
  initialValue: InitialValue<T>,
  options?: Options<T>
) {
  // Keep the latest initialValue/sanitize without re-subscribing effects on every
  // render (callers commonly pass a fresh literal like `[]` or inline function).
  // Updated in an effect, not during render, so we never mutate a ref while
  // rendering.
  const { reportWrite, retryToken } = useStorageHealth();
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

  // The latest value, as a functional updater passed to `persist` should see it.
  // `persist` advances this SYNCHRONOUSLY on a successful write, because
  // `setValue` does not: two calls in one tick would otherwise both read the
  // pre-render snapshot and the second would silently discard the first (adding
  // two shots in one handler kept only the last). The effect covers changes that
  // arrive by other routes — the initial read, cross-tab sync, `setValue`.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });

  /**
   * Write `next` to storage and report the real result, synchronously.
   *
   * This exists because the caller's question — "did my shot actually save?" —
   * cannot be answered by anything other than the write itself. The first
   * version of this feature answered it with a *probe*: a one-byte write to a
   * throwaway key just before the real one. That is a different write, and a
   * quota rejection depends on the size of the value, so the probe sailed
   * through while the shot was rejected: the sheet closed, the draft cleared,
   * and the app reported success for something it had not saved.
   *
   * State is committed only on success, so a rejected write leaves the caller's
   * form holding the single copy — which is what lets it stay open and retry
   * without the half-saved entry also sitting in the list, waiting to be
   * duplicated by the next attempt.
   */
  const persist = useCallback(
    (next: T | ((prev: T) => T)): boolean => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: T) => T)(valueRef.current)
          : next;
      const ok = writeThrough(key, resolved, reportWrite);
      if (ok) {
        valueRef.current = resolved;
        setValue(resolved);
      }
      return ok;
    },
    [key, reportWrite]
  );

  // The single write boundary for the whole app, which is why the failure has to
  // be reported from here: every store, and every future one, passes through it.
  // `retryToken` is a dependency so that "Try again" in the banner simply bumps a
  // number and every store re-attempts.
  //
  // Still an effect as well as `persist`, because most state changes don't go
  // through `persist` (cross-tab sync, the mount write, "Try again"). When
  // `persist` has already written, the value-matches check below makes this a
  // no-op that reports the success it just had.
  const lastRetry = useRef(retryToken);
  useEffect(() => {
    // A bump in `retryToken` is the user pressing "Try again", which has to be a
    // real attempt rather than a re-affirmation of what storage already holds.
    const forced = lastRetry.current !== retryToken;
    lastRetry.current = retryToken;

    // Don't seed an untouched store. On mount with nothing stored yet this used
    // to write `"[]"` — a write nobody asked for, which on a brand-new install in
    // private browsing threw, and greeted a first-time user with "Your changes
    // aren't being saved" before they had made any. The app should report a
    // failure when something real needed saving, not when it decided to tidy up.
    // Nothing is lost by waiting: an absent key already reads back as the initial
    // value.
    if (
      !forced &&
      window.localStorage.getItem(key) === null &&
      JSON.stringify(value) === JSON.stringify(resolveInitial(initialRef.current))
    ) {
      return;
    }
    writeThrough(key, value, reportWrite, forced);
  }, [key, value, retryToken, reportWrite]);

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

  return [value, setValue, persist] as const;
}
