// src/utils/wash.ts

/**
 * The name of the `@keyframes` that paints a row's success wash, shared by every
 * component that has to recognise its `animationend`.
 *
 * It lives here rather than beside either caller because it is a fact that spans
 * CSS and two components, and the same shape has already cost this project once:
 * `SHEET_EXIT_MS` and its two stylesheet values are a set that must move
 * together. A stale copy here does not throw — `animationend` simply never
 * matches, so the wash class is never dropped and the row stays tinted until it
 * unmounts.
 *
 * Named for the ROW rather than the shot: a saved value's row plays the same
 * wash when a rename lands, from the same keyframes.
 */
export const WASH_ANIMATION = "row-wash";
