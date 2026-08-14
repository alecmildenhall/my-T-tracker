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
// on-disk format.
//
// Validity here means *calendar* validity only (a real day). Range rules are a
// per-field concern, and this file holds them separately rather than folding
// them into the brand:
//   - `civilDateParts` / `isRealDate` / `toCivilDate` — a real calendar date.
//     Nothing about which dates make sense for a given field.
//   - `isShotDateInRange` / `toShotDate` — the SHOT date's extra rule, 1900 to a
//     year out. Used by the log sheet and by import.
//
// The two are separate because the app's two date fields genuinely disagree, and
// an earlier version of this bound both through `toCivilDate` — which quietly
// applied the shot rule to the T start date, where it does not belong. A start
// date is a fact about someone's life that they are reporting, not a value we
// have standing to second-guess: any real date is accepted, and a wrong one
// announces itself immediately in the greeting rather than hiding in a list.

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
 * The earliest year a SHOT may be dated. Comfortably before anyone alive could
 * have started HRT, so it rejects typos without ever arguing with a real history.
 */
export const EARLIEST_YEAR = 1900;

/**
 * How far ahead a SHOT may be dated. You log a shot after taking it, so the only
 * legitimate future date is a clock or timezone edge — but a year of room costs
 * nothing and still catches a mistyped year outright.
 */
export const FUTURE_YEAR_ALLOWANCE = 1;

/**
 * The latest acceptable date, as [year, month, day], read from the clock now.
 *
 * Read fresh on every check rather than captured once, and that is safe here in
 * a way it is NOT elsewhere in this codebase: this bound only ever moves
 * *forward*, so a value that was acceptable can never later become
 * unacceptable. Nothing already stored can be invalidated by the passage of
 * time, which is what makes a moving baseline the trap it usually is (see
 * `dateBaseline` in ShotForm for the version of this that bit).
 */
function latestAcceptable(): string {
  const now = new Date();
  // Through Date.UTC so 29 February rolls over rather than producing a day that
  // does not exist (2028-02-29 + 1 year → 2029-03-01).
  const max = new Date(
    Date.UTC(
      now.getFullYear() + FUTURE_YEAR_ALLOWANCE,
      now.getMonth(),
      now.getDate()
    )
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${max.getUTCFullYear()}-${pad(max.getUTCMonth() + 1)}-${pad(
    max.getUTCDate()
  )}`;
}

/** The earliest acceptable shot date. A constant, unlike the upper bound. */
const EARLIEST_DATE = `${EARLIEST_YEAR}-01-01`;

/**
 * A real calendar date that could plausibly be a SHOT in an HRT log: no earlier
 * than {@link EARLIEST_YEAR}, no later than {@link FUTURE_YEAR_ALLOWANCE} years
 * from today.
 *
 * This exists because the date field had no year bound at all and browsers
 * actively invite the mistake — Chromium auto-fills the segments you have not
 * typed, so typing `08` into a cleared field yields `0008-08-05`, reading `08`
 * as the *year*. Sub-100 years happened to be rejected already, but only by
 * accident: `civilDateParts` round-trips through `Date.UTC`, which maps years
 * 0–99 into the 1900s, so the round-trip failed. A four-digit typo like `0999`
 * or `9999` sailed through, and was then in storage, in History, in the CSV a
 * provider reads, and — once slice D lands — stretching a chart axis across a
 * millennium and flattening every real trend to a single pixel.
 *
 * The bound is here, at the parse boundary, and NOT in the chart: clamping an
 * axis hides a wrong date instead of preventing one, and leaves it wrong
 * everywhere else it is read.
 *
 * Deliberately NOT applied to `Profile.startDate` — see the module header.
 */
export function isShotDateInRange(value: string): boolean {
  // Real date first, which also guarantees the zero-padded YYYY-MM-DD shape the
  // comparison below relies on.
  if (!isRealDate(value)) return false;
  // Lexical, against the very strings {@link shotDateRange} publishes — so the
  // check and the input's `min`/`max` cannot disagree about a single day. They
  // did: this compared year/month/day components while the range rolled 29
  // February forward, leaving the picker offering two days the form refused.
  // One function computes the bound; everything else reads it.
  return value >= EARLIEST_DATE && value <= latestAcceptable();
}

/**
 * The acceptable range as `YYYY-MM-DD` strings, for the `min`/`max` attributes
 * of a date input.
 *
 * Belt and braces on purpose, which is the standard treatment for a bounded date
 * field: the attributes keep the native picker inside the range and stop it
 * scrolling to the year 9999 in the first place, while {@link isShotDateInRange}
 * remains the check that actually decides — attributes are a hint a user can get
 * around, and `noValidate` on this app's form means the browser never blocks a
 * submit on its own.
 *
 * The same two strings the check compares against, so the picker can never offer
 * a day the form would refuse. Call it where it is used rather than caching the
 * result at module load: it reads the clock, and a session left open across New
 * Year would otherwise show last year's bound.
 */
export function shotDateRange(): { min: string; max: string } {
  return { min: EARLIEST_DATE, max: latestAcceptable() };
}

/**
 * The smart constructor for `CivilDate`: the *only* way to mint one from an
 * untrusted string. Returns the branded value when `value` is a real calendar
 * date, or null otherwise — so date logic never has to re-validate. Callers
 * parse at the trust boundary (form input, storage read, filter input) and
 * handle the null (surface an error, drop, or skip) once, up front.
 *
 * Calendar validity only. A field with a range rule uses {@link toShotDate} (or
 * its own check) on top — see the module header for why the range is not folded
 * in here.
 *
 * `value` is returned unchanged when valid — the cast only attaches the
 * compile-time brand; there is no runtime transformation.
 */
export function toCivilDate(value: string): CivilDate | null {
  return civilDateParts(value) === null ? null : (value as CivilDate);
}

/**
 * `toCivilDate` plus the shot-date range: the constructor the log sheet and the
 * import schema both use, so the two can never disagree about what they accept.
 * `Profile.startDate` deliberately does NOT go through here.
 */
export function toShotDate(value: string): CivilDate | null {
  return isShotDateInRange(value) ? (value as CivilDate) : null;
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
