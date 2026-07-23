// src/utils/shotSchema.ts
// Zod schemas describing the on-disk backup format. This is the single source of
// truth for validating untrusted import files: structure, types, and ranges are
// all enforced here so importData.ts can trust anything that parses.
import { z } from "zod";
import { APP_NAME, FORMAT_VERSION } from "../appMeta";
import { todayLocalISO } from "./datetime";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
const TIME_RE = /^\d{2}:\d{2}$/; // HH:MM

/**
 * True for a real calendar date in YYYY-MM-DD form. The regex only checks shape,
 * so we round-trip through Date to reject impossible values like 2026-13-40 or
 * 2026-02-30 that a hand-edited or hostile file could otherwise smuggle in.
 */
function isRealDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** True for a valid 24-hour HH:MM time (rejects 24:00, 08:99, etc.). */
function isRealTime(value: string): boolean {
  if (!TIME_RE.test(value)) return false;
  const [h, min] = value.split(":").map(Number);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

/**
 * One shot entry. `strictObject` rejects any unexpected key so a malformed or
 * hostile file can't smuggle extra data past validation. Optional fields may be
 * omitted but, if present, must be well-formed — empty strings are rejected, in
 * line with the "undefined, never ''" rule for `ShotEntry`.
 */
export const shotEntrySchema = z.strictObject({
  id: z.string().min(1),
  date: z.string().refine(isRealDate, "invalid date"),
  time: z.string().refine(isRealTime, "invalid time").optional(),
  doseMg: z.number().finite().nonnegative().optional(),
  injectionSite: z.string().min(1).optional(),
  injectionSitePosition: z.string().min(1).optional(),
  testosteroneEster: z.string().min(1).optional(),
  carrierOil: z.string().min(1).optional(),
  painScore: z.number().int().min(0).max(10).optional(),
  mood: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
});

/**
 * Optional profile carried in a backup so a restore is a complete snapshot, not
 * just the shot list. Strict + allowlisted like a shot: unknown keys are rejected
 * so a hostile file can't smuggle data past validation, and both fields are
 * optional (an older backup with no profile, or a user who set neither, is fine).
 * `preferredName` is PII, so a backup file is inherently sensitive — the UI warns
 * that backups are unencrypted.
 */
export const profileSchema = z.strictObject({
  startDate: z
    .string()
    .refine(isRealDate, "invalid date")
    // Mirror the UI's `max={todayLocalISO()}` cap so a hand-edited or hostile
    // file can't set a future start date, which milestone math would read as a
    // negative time-on-T. Lexicographic compare is chronological for real ISO
    // dates. Evaluated per-parse, so "today" is always current.
    .refine((d) => d <= todayLocalISO(), "start date cannot be in the future")
    .optional(),
  preferredName: z.string().min(1).optional(),
});

/**
 * The backup envelope. `app` and `formatVersion` are fixed literals: a file from
 * another app or a newer/older format is rejected rather than guessed at. `profile`
 * is optional and additive — files without it (older exports) still validate, so
 * adding it needs no formatVersion bump.
 */
export const backupSchema = z.strictObject({
  app: z.literal(APP_NAME),
  formatVersion: z.literal(FORMAT_VERSION),
  appVersion: z.string(),
  exportedAt: z.string(),
  shots: z.array(shotEntrySchema),
  profile: profileSchema.optional(),
});

export type Backup = z.infer<typeof backupSchema>;
