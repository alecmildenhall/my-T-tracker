// src/utils/backupDto.ts
// The DTO (Data Transfer Object) boundary for the backup file. Everything that
// crosses the app<->file boundary — exported to a backup or read back from one —
// is rebuilt here from a fixed allowlist of known fields, never spread. This is
// the OWASP mass-assignment defense in both directions: an export can't leak an
// unexpected field a newer build (or a hand-edit) left on an object, and an
// import can't smuggle stray keys or a tampered prototype onto a domain object.
// Keeping one allowlist for each shape means export and the strict import schema
// can never drift apart (which would let an export produce a file its own
// importer rejects).
import {
  isOffDaysPattern,
  isPainLevel,
  type ShotEntry,
} from "../types/shot";
import type { Profile } from "../types/profile";
import { isValidIntervalDays } from "../types/profile";
import { isShotDateInRange } from "./civilDate";
import { nonBlankString } from "./strings";
import { isWeekday } from "./weekday";

/** Rebuild a shot from known fields only — fresh object, no spread, no carried
 *  prototype or stray keys, no blank strings. Accepts a domain shot (export) or a
 *  schema-validated shot (import); both share this shape. `doseMg` keeps the
 *  `!== undefined` guard so a legitimate 0 is preserved — truthiness would drop
 *  it. `pain` is no longer numeric and takes a real guard instead: that sentence
 *  used to cover both and, once pain became an enum, became the justification
 *  for a hole. The required
 *  `id`/`date` are copied as-is: sanitizeShots (the storage read boundary) and the
 *  import schema both guarantee they're present and non-blank, so re-checking here
 *  would be redundant ("parse, don't validate"). */
export function pickShotFields(s: ShotEntry): ShotEntry {
  const shot: ShotEntry = { id: s.id, date: s.date };
  const time = nonBlankString(s.time);
  if (time !== undefined) shot.time = time;
  if (s.doseMg !== undefined) shot.doseMg = s.doseMg;
  const injectionSite = nonBlankString(s.injectionSite);
  if (injectionSite !== undefined) shot.injectionSite = injectionSite;
  const injectionSitePosition = nonBlankString(s.injectionSitePosition);
  if (injectionSitePosition !== undefined)
    shot.injectionSitePosition = injectionSitePosition;
  const testosteroneEster = nonBlankString(s.testosteroneEster);
  if (testosteroneEster !== undefined)
    shot.testosteroneEster = testosteroneEster;
  const carrierOil = nonBlankString(s.carrierOil);
  if (carrierOil !== undefined) shot.carrierOil = carrierOil;
  // Validated, like `plannedFor` below and for the same reason. `sanitizeShots`
  // vets only a non-blank id and date, so a stored `pain: "agony"` reaches here
  // — and a bare presence check wrote it into the backup, which the app's own
  // importer then refuses. Measured: exporting one such shot and feeding the
  // file straight back gave "None of the 1 entry in this file could be read".
  // Backup export is the only recovery path in this product's durability model,
  // so a file that cannot be restored is the worst thing it can produce.
  if (isPainLevel(s.pain)) shot.pain = s.pain;
  if (isOffDaysPattern(s.offDays)) shot.offDays = s.offDays;
  const notes = nonBlankString(s.notes);
  if (notes !== undefined) shot.notes = notes;
  // The allowlist is on BOTH the export and the import path, so a field missing
  // here does not fail — it silently does not survive a backup. Leaving
  // plannedFor out cost the entire timing history on any restore, and by this
  // feature's own design it can never be regenerated: it is frozen at save time
  // from the settings in force then. The restore would have reported success.
  // `isShotDateInRange`, not just non-blank. The schema applies that rule, so
  // admitting anything looser here lets the app export a file its own importer
  // refuses — a skipped row for a shot, and for the atomic profile, the whole
  // thing. Reachable without hand-editing: establishAnchor("1900-01-01",
  // "sunday") returns "1899-12-31", which is out of range.
  if (
    typeof s.plannedFor === "string" &&
    isShotDateInRange(s.plannedFor.trim())
  ) {
    shot.plannedFor = s.plannedFor.trim();
  }
  return shot;
}

/** Copy only the known profile fields, dropping unknowns and blanks. */
export function pickProfileFields(p: Partial<Profile>): Profile {
  const out: Profile = {};
  const startDate = nonBlankString(p.startDate);
  if (startDate !== undefined) out.startDate = startDate;
  const preferredName = nonBlankString(p.preferredName);
  if (preferredName !== undefined) out.preferredName = preferredName;
  // Filtered per element rather than trusted as a list: this is the boundary a
  // hand-edited or hostile file arrives at, and one bad entry must not cost the
  // whole set. De-duplicated because a repeated day would double a grid slot.
  const shotDays = Array.isArray(p.shotDays)
    ? [...new Set(p.shotDays.filter(isWeekday))]
    : [];
  if (shotDays.length > 0) out.shotDays = shotDays;
  // The rhythm the user picked. Without this the mode reverts to whatever the
  // values imply on restore — which is exactly the collision the stored field
  // exists to resolve, so a rolling-every-7-days user would come back from
  // their own backup with no planned dates at all.
  if (
    p.scheduleMode === "grid" ||
    p.scheduleMode === "rolling" ||
    p.scheduleMode === "none"
  ) {
    out.scheduleMode = p.scheduleMode;
  }
  // Whole positive days only. A fraction or a zero would divide the schedule
  // grid into something meaningless, and this is the boundary where a
  // hand-edited or hostile file arrives.
  if (isValidIntervalDays(p.intervalDays)) out.intervalDays = p.intervalDays;
  // Carried like every other profile field. A flag-only profile does make
  // `hasProfileData` true, so dismissing the card and importing without ever
  // setting anything downloads a safety copy of almost nothing — harmless, and
  // the fail-safe direction: the alternative is skipping a backup someone
  // turned out to need.
  if (typeof p.firstRunDone === "boolean") out.firstRunDone = p.firstRunDone;
  if (
    typeof p.scheduleAnchor === "string" &&
    isShotDateInRange(p.scheduleAnchor.trim())
  ) {
    out.scheduleAnchor = p.scheduleAnchor.trim();
  }
  return out;
}

/** True when the profile carries at least one known field. */
export function hasProfileData(p: Profile): boolean {
  // `firstRunDone` is excluded: it records that someone dismissed a card, not
  // anything about their body or their schedule, and this function answers "is
  // there user data here?" for two decisions that both get it wrong otherwise.
  //
  //  - The pre-import safety copy. On a fresh install whose only action was
  //    tapping Done, this became true, so a restore first tried to download a
  //    file containing nothing but {"firstRunDone": true} — and if that
  //    download failed, the restore ABORTED. That is the "Returning with a
  //    backup?" path the first-run card advertises two lines below its own Done
  //    button, on the only recovery route this product has.
  //  - The import report. A backup carrying only the flag would be described as
  //    "Your profile was updated" while in fact clearing the destination's name,
  //    start date, shot day and interval, because replaceProfile is a full swap.
  //    The destructive outcome is the same either way; the sentence describing
  //    it was the wrong one.
  //
  // The flag still travels in the DTO — dropping it there is the allowlist trap
  // — it just does not count as data.
  return Object.keys(profileDataFields(p)).length > 0;
}

/**
 * The allowlisted fields that count as the user's profile — everything
 * `pickProfileFields` admits, minus `firstRunDone`.
 *
 * Extracted so the two questions asked about an imported profile — "is there
 * anything here?" and "did it change?" — cannot answer from different sets.
 * They did: `hasProfileData` excluded the flag and the change-compare did not,
 * so a fresh install whose only action was tapping Done reported "Your saved
 * profile was cleared." on importing a shots-only backup, and re-importing your
 * own file after tapping Done reported "Your profile was updated." Both on the
 * restore path, and the second is the exact false alarm that compare exists to
 * prevent.
 *
 * Key order survives the delete, so a serialized compare stays stable.
 */
export function profileDataFields(p: Partial<Profile>): Profile {
  const fields = pickProfileFields(p);
  delete fields.firstRunDone;
  return fields;
}
