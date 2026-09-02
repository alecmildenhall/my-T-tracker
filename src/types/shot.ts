// src/types/shot.ts

/**
 * How much the injection itself hurt, as an ordinal rather than a number.
 *
 * A 0–10 score was stored and only ever READ as four bands (`PAIN_BANDS`), so
 * seven of the eleven values were discarded at the one place pain is used. The
 * clinical literature does slightly favour a numeric scale for discriminating
 * power — but that matters when 6 versus 7 changes someone's analgesia, and the
 * published cut-points for mild/moderate/severe vary by population anyway, so
 * storing a number and bucketing it later bakes in a threshold the field itself
 * does not agree on. Storing what the person said claims nothing.
 *
 * `undefined` is NOT `"none"`: one says the injection did not hurt, the other
 * says nobody answered. Keeping them apart is why the form has a Clear control.
 */
/** In order, least to most — the order the chips render and charts should use.
 *  Declared as the tuple first so `z.enum` can take it directly, matching
 *  WEEKDAYS in weekday.ts. */
export const PAIN_LEVELS = ["none", "mild", "moderate", "severe"] as const;

export type PainLevel = (typeof PAIN_LEVELS)[number];

export function isPainLevel(value: unknown): value is PainLevel {
  return (
    typeof value === "string" &&
    (PAIN_LEVELS as readonly string[]).includes(value)
  );
}

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
  pain?: PainLevel; // how much the injection itself hurt
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
