// src/context/ShotsContext.tsx
// This file intentionally co-locates the provider component with its hook and
// context (the conventional Context module shape); Fast Refresh's
// component-only-export rule doesn't apply.
/* eslint-disable react-refresh/only-export-components */
// App-wide provider for shot data and operations. Lets the Settings subtree
// (ManageValues, DataManagement) read shots and mutate them without App threading
// the data and four callbacks down through Settings as props. As roadmap state
// grows (start date, display name, milestones, theme), this is where shared
// state lives instead of deeper prop-drilling.
import React, { createContext, useContext } from "react";
import { useShots, type UseShots } from "../hooks/useShots";

const ShotsContext = createContext<UseShots | null>(null);

export const ShotsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const shots = useShots();
  return <ShotsContext.Provider value={shots}>{children}</ShotsContext.Provider>;
};

/** Access the shared shots store. Throws if used outside <ShotsProvider>. */
export function useShotsContext(): UseShots {
  const ctx = useContext(ShotsContext);
  if (!ctx) {
    throw new Error("useShotsContext must be used within a ShotsProvider");
  }
  return ctx;
}

// Exported for tests that want to supply a mock store without the real hook.
export { ShotsContext };
