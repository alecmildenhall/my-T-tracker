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
import type { ShotEntry } from "../types/shot";
import type { Profile } from "../types/profile";
import { nonBlankString } from "./strings";

/** Rebuild a shot from known fields only — fresh object, no spread, no carried
 *  prototype or stray keys, no blank strings. Accepts a domain shot (export) or a
 *  schema-validated shot (import); both share this shape. Numeric fields keep the
 *  `!== undefined` guard so a legitimate 0 (dose/pain) is preserved. The required
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
  if (s.painScore !== undefined) shot.painScore = s.painScore;
  const mood = nonBlankString(s.mood);
  if (mood !== undefined) shot.mood = mood;
  const notes = nonBlankString(s.notes);
  if (notes !== undefined) shot.notes = notes;
  return shot;
}

/** Copy only the known profile fields, dropping unknowns and blanks. */
export function pickProfileFields(p: Partial<Profile>): Profile {
  const out: Profile = {};
  const startDate = nonBlankString(p.startDate);
  if (startDate !== undefined) out.startDate = startDate;
  const preferredName = nonBlankString(p.preferredName);
  if (preferredName !== undefined) out.preferredName = preferredName;
  return out;
}

/** True when the profile carries at least one known field. */
export function hasProfileData(p: Profile): boolean {
  return Object.keys(pickProfileFields(p)).length > 0;
}
