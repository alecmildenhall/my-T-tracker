// src/context/StorageHealthContext.tsx
// Co-locates the provider with its hook and context (the conventional Context
// module shape), as ShotsContext and ProfileContext already do; Fast Refresh's
// component-only-export rule doesn't apply.
/* eslint-disable react-refresh/only-export-components */
// Whether writes to localStorage are actually landing.
//
// `useLocalStorage` used to swallow a failed `setItem` into `console.warn`: the
// in-memory state updated, the UI showed the shot saved, and nothing persisted.
// Safari private browsing throws on write and a full device hits quota, so this
// is ordinary rather than exotic — and with no server copy the entry is simply
// gone, reported only to a console the user will never open.
//
// The state lives here rather than in the hook because storage health is a fact
// about the DEVICE, not about one store. Shots, profile and any future key all
// fail together and should say so once, in one place, instead of each growing
// its own message.
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export interface StorageHealth {
  /** How many writes have failed since the last successful one. */
  failures: number;
  /** True once the user has acknowledged the current run of failures. */
  dismissed: boolean;
  /**
   * Bumped by `retry()`. Every `useLocalStorage` includes it in its write
   * effect's dependencies, so incrementing it re-attempts every store's write —
   * which is the whole of "Try again". Nothing else needs to know which key
   * failed, because they share one device.
   */
  retryToken: number;
  /** Called by each store after every write attempt. */
  reportWrite: (ok: boolean) => void;
  dismiss: () => void;
  retry: () => void;
}

/**
 * Default is inert, so `useLocalStorage` works with no provider — in a unit test
 * that renders a hook alone, or anywhere the banner isn't mounted. Reporting
 * into the void is the old behaviour, minus the console noise.
 */
const INERT: StorageHealth = {
  failures: 0,
  dismissed: false,
  retryToken: 0,
  reportWrite: () => {},
  dismiss: () => {},
  retry: () => {},
};

const StorageHealthContext = createContext<StorageHealth>(INERT);

export const StorageHealthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [failures, setFailures] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const reportWrite = useCallback((ok: boolean) => {
    if (ok) {
      // Only a real success clears it — never a timer, and never the dismiss
      // button, which just hides what is still true.
      setFailures((n) => (n === 0 ? n : 0));
      setDismissed((d) => (d ? false : d));
      return;
    }
    setFailures((n) => n + 1);
    // A new failure is new information, so it re-raises even if the last run was
    // dismissed. Acknowledging one failure must not silence the next.
    setDismissed(false);
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);
  const retry = useCallback(() => setRetryToken((n) => n + 1), []);

  const value = useMemo(
    () => ({ failures, dismissed, retryToken, reportWrite, dismiss, retry }),
    [failures, dismissed, retryToken, reportWrite, dismiss, retry]
  );

  return (
    <StorageHealthContext.Provider value={value}>
      {children}
    </StorageHealthContext.Provider>
  );
};

export const useStorageHealth = (): StorageHealth =>
  useContext(StorageHealthContext);
