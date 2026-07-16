// src/hooks/useProfile.ts
import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { Profile } from "../types/profile";
import { STORAGE_KEYS } from "../storageKeys";

export interface UseProfile {
  profile: Profile;
  /** Set (or clear, with undefined) the T start date. */
  setStartDate: (date: string | undefined) => void;
  /** Set (or clear, with undefined) the preferred name. */
  setPreferredName: (name: string | undefined) => void;
  /** Merge a partial patch into the profile. */
  updateProfile: (patch: Partial<Profile>) => void;
}

const EMPTY: Profile = {};

/**
 * Drop the two known optional string fields from `o` unless they're a non-blank
 * string, so an optional field is never carried as "" (or a non-string). Unknown
 * fields are left untouched — see coerce/updateProfile for why.
 */
function normalizeKnownFields(o: Record<string, unknown>): void {
  if (typeof o.startDate !== "string" || !o.startDate.trim()) {
    delete o.startDate;
  }
  if (typeof o.preferredName !== "string" || !o.preferredName.trim()) {
    delete o.preferredName;
  }
}

/**
 * Coerce whatever is in storage into a usable Profile. localStorage is untrusted
 * (corruptable, hand-editable, or from an older app version), so a successful
 * JSON.parse doesn't guarantee the shape. Non-objects fall back to empty. Unknown
 * fields are preserved (like sanitizeShots) so a field written by a newer build
 * isn't stripped when an older one reads and rewrites the profile.
 */
function sanitizeProfile(raw: unknown): Profile {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const clean: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  normalizeKnownFields(clean);
  return clean as Profile;
}

export function useProfile(): UseProfile {
  const [profile, setProfile] = useLocalStorage<Profile>(
    STORAGE_KEYS.profile,
    EMPTY,
    { sanitize: sanitizeProfile }
  );

  const updateProfile = useCallback(
    (patch: Partial<Profile>) => {
      setProfile((prev) => {
        // Merge, then drop any now-blank known field so it's never stored as "".
        // The value is kept exactly as typed (no trim) — trimming per keystroke
        // would stop a name with spaces from being entered; rendering trims at
        // point of use. Unknown fields carried by prev are preserved.
        const next: Record<string, unknown> = { ...prev, ...patch };
        normalizeKnownFields(next);
        return next as Profile;
      });
    },
    [setProfile]
  );

  const setStartDate = useCallback(
    (date: string | undefined) => updateProfile({ startDate: date }),
    [updateProfile]
  );

  const setPreferredName = useCallback(
    (name: string | undefined) => updateProfile({ preferredName: name }),
    [updateProfile]
  );

  return { profile, setStartDate, setPreferredName, updateProfile };
}
