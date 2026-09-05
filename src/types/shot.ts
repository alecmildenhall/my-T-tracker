// src/types/shot.ts

/**
 * In order, least to most — the order the chips render and charts should use.
 * Declared as the tuple first so `z.enum` can take it directly, matching
 * WEEKDAYS in weekday.ts.
 *
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
export const PAIN_LEVELS = ["none", "mild", "moderate", "severe"] as const;

export type PainLevel = (typeof PAIN_LEVELS)[number];

export function isPainLevel(value: unknown): value is PainLevel {
  return (
    typeof value === "string" &&
    (PAIN_LEVELS as readonly string[]).includes(value)
  );
}

/**
 * Where the off days sat in the interval just gone — a PATTERN, not an amount.
 *
 * This replaces free-text `mood`, and it is deliberately not a 1–5 intensity
 * scale either. A count cannot tell three scattered off days from three stacked
 * against the next shot, and only the second is a conversation about a shorter
 * interval or a split dose. Naming the shape gets both in one tap, and it is
 * the one insight this app can produce that a daily mood tracker structurally
 * cannot — because only this app knows where in the interval you were.
 *
 * Asked as "any days you felt off?" rather than "how was it": you notice
 * feeling off, so counting good days is counting non-events. That is a
 * deliberate departure from WHO-5, which is worded toward wellbeing and is also
 * answered under supervision rather than one-handed beside a sharps bin. It is
 * vague in the useful direction too — flat, irritable, foggy and dysphoric all
 * fit, without the app deciding any of them is a symptom.
 *
 * Accepted, and both real: the values are NOT a clean ordinal ("here-and-there"
 * is neither more nor less than "right-before"), so charts count how often each
 * appears rather than averaging; and off days landing AFTER a shot have no true
 * home here, which is a reported pattern rather than a hypothetical one. A
 * fifth value is additive and free while pre-GA.
 *
 * `undefined` is NOT `"none"`, exactly as with pain: one says there weren't
 * any, the other says nobody answered.
 */
export const OFF_DAYS_PATTERNS = [
  "none",
  "here-and-there",
  "right-before",
  "most-of-the-time",
] as const;

export type OffDaysPattern = (typeof OFF_DAYS_PATTERNS)[number];

export function isOffDaysPattern(value: unknown): value is OffDaysPattern {
  return (
    typeof value === "string" &&
    (OFF_DAYS_PATTERNS as readonly string[]).includes(value)
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
  offDays?: OffDaysPattern; // where the off days sat in the interval before this
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
