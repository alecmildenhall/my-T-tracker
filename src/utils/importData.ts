// src/utils/importData.ts
// Parses an untrusted backup file into validated ShotEntry[]. Layered defenses:
//   1. size cap        — refuse pathologically large input before parsing
//   2. reviver         — reject prototype-pollution keys during JSON.parse
//   3. Zod schema      — enforce structure, types, and ranges (atomic: all-or-nothing)
//   4. allowlist copy  — rebuild each shot from known fields only (never spread)
// The caller gets a plain discriminated result; error text is deliberately
// generic so we never leak parser internals to the user.
import type { ShotEntry } from "../types/shot";
import { backupSchema, type Backup } from "./shotSchema";

/** Hard ceiling on input size. Realistic backups are kilobytes; this only stops
 *  a hostile or corrupt multi-hundred-MB file from exhausting memory. */
const MAX_INPUT_CHARS = 10 * 1024 * 1024; // ~10 MB

/** Object keys that enable prototype-pollution; never legitimate in our data. */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export type ImportResult =
  | { ok: true; shots: ShotEntry[] }
  | { ok: false; error: string };

const GENERIC_ERROR =
  "This file couldn’t be read as a T-Shot Tracker backup. Make sure you picked a backup file exported from this app.";

/** JSON.parse reviver that rejects dangerous keys anywhere in the tree. */
function safeReviver(key: string, value: unknown): unknown {
  if (FORBIDDEN_KEYS.has(key)) {
    throw new Error("forbidden key in import");
  }
  return value;
}

/** Rebuild a validated shot from known fields only — no spread, no carried-over
 *  prototype or stray keys. */
function toShotEntry(s: Backup["shots"][number]): ShotEntry {
  const shot: ShotEntry = { id: s.id, date: s.date };
  if (s.time !== undefined) shot.time = s.time;
  if (s.doseMg !== undefined) shot.doseMg = s.doseMg;
  if (s.injectionSite !== undefined) shot.injectionSite = s.injectionSite;
  if (s.injectionSitePosition !== undefined)
    shot.injectionSitePosition = s.injectionSitePosition;
  if (s.testosteroneEster !== undefined)
    shot.testosteroneEster = s.testosteroneEster;
  if (s.carrierOil !== undefined) shot.carrierOil = s.carrierOil;
  if (s.painScore !== undefined) shot.painScore = s.painScore;
  if (s.mood !== undefined) shot.mood = s.mood;
  if (s.notes !== undefined) shot.notes = s.notes;
  return shot;
}

/**
 * Validate raw backup-file text and return clean ShotEntry[] or a generic error.
 * Never throws — all failure modes collapse into `{ ok: false }`.
 */
export function parseBackup(text: string): ImportResult {
  if (typeof text !== "string" || text.length === 0) {
    return { ok: false, error: GENERIC_ERROR };
  }
  if (text.length > MAX_INPUT_CHARS) {
    return { ok: false, error: GENERIC_ERROR };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text, safeReviver);
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  const result = backupSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true, shots: result.data.shots.map(toShotEntry) };
}
