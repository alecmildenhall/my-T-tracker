// src/types/profile.ts

// Optional, local-only personalization for HRT milestones.
//
// Deliberately separate from ShotEntry: this holds a preferred name (identity
// data that ShotEntry must never contain) and the T start date. It lives under
// its own storage key and, like everything else, never leaves the device.
// Every field is optional — the app is fully usable without setting any of it.
export interface Profile {
  /** Local calendar date HRT started (YYYY-MM-DD). May predate app install. */
  startDate?: string;
  /** How the user likes to be addressed in milestone messages. Free text. */
  preferredName?: string;
}
