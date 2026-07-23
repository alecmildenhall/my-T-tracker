// src/utils/strings.ts
// Single source of truth for the "a blank string counts as absent" rule, shared
// by the storage read boundary (sanitizeShots), the profile normalizer
// (normalizeKnownFields), and the backup DTO (pickShotFields/pickProfileFields).
// Keeping one definition means those layers can't drift on what "empty" means —
// which matters because they must agree for a value to survive a save/restore.

/** True for a non-string, or a string that is empty or whitespace-only. */
export function isBlank(v: unknown): boolean {
  return typeof v !== "string" || v.trim() === "";
}

/** The string when it's non-blank, otherwise undefined. Narrows unknown input to
 *  a usable string or drops it — the coercion behind "never store empty strings". */
export function nonBlankString(v: unknown): string | undefined {
  return isBlank(v) ? undefined : (v as string);
}
