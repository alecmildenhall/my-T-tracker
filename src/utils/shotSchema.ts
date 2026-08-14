// src/utils/shotSchema.ts
// Zod schemas describing the on-disk backup format. This is the single source of
// truth for validating untrusted import files: structure, types, and ranges are
// all enforced here so importData.ts can trust anything that parses.
import { z } from "zod";
import { APP_NAME, FORMAT_VERSION } from "../appMeta";
import { isRealDate, isShotDateInRange } from "./civilDate";
import { WEEKDAYS } from "./weekday";

const TIME_RE = /^\d{2}:\d{2}$/; // HH:MM

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
  // The same plausible range the log form enforces, not merely a real calendar
  // date. Import is the other way into storage, so a bound applied only at the
  // form is a bound with a door beside it — a hand-edited or hand-written file
  // could still put year 9999 in front of a chart. `isShotDateInRange` is that one
  // rule; see civilDate.ts.
  //
  // A file this rejects fails with a field-level error rather than a clean
  // "wrong version" message, and the whole file is refused rather than the one
  // row dropped. That is the accepted cost of strict import and the same trade
  // the README already records for slice B½'s pain enum. Post-GA it becomes a
  // migration question, which is why it is written down there too.
  date: z.string().refine(isShotDateInRange, "date outside the supported range"),
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
  // A future start date is allowed on purpose: someone planning to start T later
  // is a legitimate case. The milestone engine reads a future start as "not
  // started yet" (currentMilestone returns null until the date passes), so there
  // is no negative-time bug to guard against — and rejecting it here would make a
  // profile fail to re-import the very date the app let the user set.
  // Any real calendar date, with no range — matching the field itself, which is
  // deliberately unbounded (see JourneySettings and the civilDate.ts header).
  // Importing must accept whatever the app let someone set, or a profile fails
  // to re-import the very date it stored.
  startDate: z.string().refine(isRealDate, "invalid date").optional(),
  preferredName: z.string().min(1).optional(),
  // Shot day is an enum: only the seven weekday keys are accepted, so a hand-edit
  // or hostile file can't smuggle an arbitrary string past the boundary.
  shotDay: z.enum(WEEKDAYS).optional(),
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
