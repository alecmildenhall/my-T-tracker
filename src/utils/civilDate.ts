// src/utils/civilDate.ts
// The single source of truth for civil dates: validating and parsing plain
// YYYY-MM-DD strings (string → bool / parts). This is deliberately separate from
// datetime.ts, whose job is the opposite direction — deriving strings from the
// current instant (Date → string).
//
// `CivilDate` is a *branded* string: a value that has been proven to be a real
// calendar date, mintable only through `toCivilDate` (the smart constructor).
// Date logic declares its parameters as `CivilDate`, so the compiler forces
// callers to parse untrusted strings at the boundary before doing date math —
// "parse, don't validate". A `CivilDate` *is* a `string` (it's a subtype), so
// every consumer that already accepts a string keeps working unchanged; branding
// only constrains *creation*. The brand is erased at runtime (it's just a string
// in storage, JSON, and the DOM), so it costs nothing at runtime and changes no
// on-disk format. Validity here means *calendar* validity only (a real day) —
// business rules like "no future dates" are a separate, per-field concern.

/**
 * A `YYYY-MM-DD` string proven to be a real calendar date. The `unique symbol`
 * tag makes it nominally distinct from a plain string, so a raw string can't be
 * passed where a `CivilDate` is required without going through `toCivilDate`.
 * The tag field never exists at runtime — it's a compile-time-only marker.
 */
export type CivilDate = string & { readonly __civilDate: unique symbol };

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

/**
 * The smart constructor for `CivilDate`: the *only* way to mint one from an
 * untrusted string. Returns the branded value when `value` is a real calendar
 * date, or null otherwise — so date logic never has to re-validate. Callers
 * parse at the trust boundary (form input, storage read, filter input) and
 * handle the null (surface an error, drop, or skip) once, up front.
 *
 * `value` is returned unchanged when valid — the cast only attaches the
 * compile-time brand; there is no runtime transformation.
 */
export function toCivilDate(value: string): CivilDate | null {
  return civilDateParts(value) === null ? null : (value as CivilDate);
}

/**
 * Brand a string already known to be a real calendar date, WITHOUT re-checking.
 * Reserved for *provably-valid producers* — code that constructs the date from
 * numeric components (see datetime.ts) or receives it from a validator that has
 * already run. Never call this on untrusted input; use `toCivilDate` there.
 */
export function unsafeCivilDate(value: string): CivilDate {
  return value as CivilDate;
}
