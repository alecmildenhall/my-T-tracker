// src/utils/timing.ts

/**
 * How long a ✓ shows before the surface it is on starts leaving.
 *
 * Inside the 100–300ms band that reads as an answer to what you just did rather
 * than a pause. Confirm-to-gone is therefore CONFIRM_MS + the surface's own exit
 * (`SHEET_EXIT_MS` for the log sheet), which is the point: the sheet used to
 * vanish before the press had registered.
 *
 * It lives here rather than in App.tsx, which is where it started, because the
 * first-run card needs it too — and App imports that card, so reading the
 * constant from App would have made a module cycle out of a number.
 */
export const CONFIRM_MS = 200;
