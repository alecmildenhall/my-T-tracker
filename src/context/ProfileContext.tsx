// src/context/ProfileContext.tsx
// This file intentionally co-locates the provider component with its hook and
// context (the conventional Context module shape); Fast Refresh's
// component-only-export rule doesn't apply.
/* eslint-disable react-refresh/only-export-components */
// App-wide provider for the optional user profile (T start date, preferred
// name) that drives HRT milestones. Kept as its own context, separate from
// ShotsContext, because profile and shot history are independent concerns with
// separate storage keys.
import React, { createContext, useContext } from "react";
import { useProfile, type UseProfile } from "../hooks/useProfile";

const ProfileContext = createContext<UseProfile | null>(null);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const profile = useProfile();
  return (
    <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
  );
};

/** Access the shared profile store. Throws if used outside <ProfileProvider>. */
export function useProfileContext(): UseProfile {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfileContext must be used within a ProfileProvider");
  }
  return ctx;
}

// Exported for tests that want to supply a mock store without the real hook.
export { ProfileContext };
