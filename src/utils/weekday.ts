// src/utils/weekday.ts
// Day-of-week vocabulary for the optional "shot day" greeting. Weekdays are stored
// as lowercase English keys (not 0-6) so a backup file reads plainly and z.enum
// can validate them at the import boundary — see profileSchema. A weekday is not
// PII.
//
// Deriving the weekday of a civil date uses a LOCAL Date constructor
// (new Date(y, m-1, d)) so there's no UTC drift — consistent with datetime.ts,
// where civil dates are always read from local components. `new Date("YYYY-MM-DD")`
// would parse as UTC midnight and could report the wrong day west of UTC.
import { civilDateParts } from "./civilDate";

/** The seven weekday keys, indexed to match JS `Date.getDay()` (0 = Sunday). */
export const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/** True when `v` is one of the seven weekday keys. */
export function isWeekday(v: unknown): v is Weekday {
  return typeof v === "string" && (WEEKDAYS as readonly string[]).includes(v);
}

/** The weekday of a civil date (YYYY-MM-DD), or null if it isn't a real date.
 *  Uses a local Date constructor purely to read the day index — timezone-safe
 *  because the components come straight from the civil parts. */
export function weekdayOf(iso: string): Weekday | null {
  const parts = civilDateParts(iso);
  if (!parts) return null;
  const [y, m, d] = parts;
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

/** Title-case label for display, e.g. "wednesday" -> "Wednesday". */
export function weekdayLabel(day: Weekday): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}
