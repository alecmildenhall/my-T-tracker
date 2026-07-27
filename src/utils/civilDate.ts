// src/utils/civilDate.ts
// The single source of truth for civil dates: validating and parsing plain
// YYYY-MM-DD strings (string → bool / parts). This is deliberately separate from
// datetime.ts, whose job is the opposite direction — deriving strings from the
// current instant (Date → string). Keeping the two concerns in focused modules
// (one reason to change each) also makes this the natural future home for a
// branded `CivilDate` type: a `toCivilDate(value): CivilDate | null` constructor
// would slot in here additively, alongside these lower-level helpers.

/** Shape of a civil date string, YYYY-MM-DD. Shape only — see isRealDate for
 *  calendar validity. Single source of truth for the pattern. */
export const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a *valid* civil date into [year, month(1-12), day], or null if the string
 * isn't a real calendar date. The regex only checks shape, so we round-trip
 * through Date to reject impossible values like 2026-13-40 or 2026-02-30. This is
 * the one parse+validate implementation for the app — import validation, milestone
 * math, and any future date consumer share it.
 *
 * Low-level parts extractor; the name `toCivilDate`/`parseCivilDate` is reserved
 * for a future branded-type constructor (see the module header).
 */
export function civilDateParts(value: string): [number, number, number] | null {
  if (!CIVIL_DATE_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return [y, m, d];
}

/** True for a real calendar date in YYYY-MM-DD form. Thin predicate over
 *  civilDateParts (the single parse+validate). */
export function isRealDate(value: string): boolean {
  return civilDateParts(value) !== null;
}
