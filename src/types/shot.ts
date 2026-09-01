// src/types/shot.ts

// Core model for a single HRT shot log.
// Intentionally PII-free: only HRT-related fields.
export interface ShotEntry {
  id: string; // local-only ID
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  doseMg?: number; // numeric dose (unit configurable later)
  injectionSite?: string; // e.g. "thigh", "glute", "stomach"
  injectionSitePosition?: string; // e.g. "left", "right", "upper left"
  testosteroneEster?: string; // e.g. "cypionate", "enanthate"
  carrierOil?: string; // e.g. "cottonseed", "sesame", "grapeseed"
  painScore?: number; // 0–10
  mood?: string; // free text or later enum
  notes?: string; // long-form notes
  /** The day this shot was meant to be, frozen at save time (YYYY-MM-DD).
   *
   *  Computed once, from the shot day and interval in force when it was logged,
   *  and NEVER recomputed — changing your cadence later must not repaint clean
   *  history with lateness you did not have at the time. Absent when either
   *  setting was unset, which is the honest answer rather than a guess.
   *
   *  How far the shot landed from it is derived (`daysFromPlanned`), not stored:
   *  it follows from two facts already here, and a third value would be free to
   *  disagree with them. */
  plannedFor?: string;
}
