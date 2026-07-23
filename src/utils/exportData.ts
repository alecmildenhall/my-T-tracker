// src/utils/exportData.ts
// Builds backup/export payloads from the in-memory shot list. Two formats:
//   - JSON: the full round-trippable backup envelope (import reads this back)
//   - CSV:  a flat, spreadsheet-friendly export for clinical conversations
// CSV is export-only — we never parse it back — so it optimises for safety in
// spreadsheet apps (formula-injection guard) and correctness (RFC 4180 quoting).
import type { ShotEntry } from "../types/shot";
import type { Profile } from "../types/profile";
import { APP_NAME, APP_VERSION, FORMAT_VERSION } from "../appMeta";
import type { Backup } from "./shotSchema";
import { compareShotsChrono } from "./sortShots";
import { pickProfileFields, pickShotFields } from "./backupDto";

/** Oldest-first, matching how shots are stored and how a reader expects a log. */
function chronological(shots: ShotEntry[]): ShotEntry[] {
  return [...shots].sort(compareShotsChrono);
}

/**
 * Assemble the versioned backup envelope. Shots and profile are both rebuilt
 * through the DTO allowlist (see backupDto), so the file carries only known
 * fields and can never contain a key the strict import schema would reject. The
 * profile is included only when it holds something — a user who set neither field
 * still gets a clean `{ ...shots }` envelope with no empty `profile` key. Defaults
 * to an empty profile so a caller with nothing to save (e.g. a test) can omit it.
 */
export function buildBackup(shots: ShotEntry[], profile: Profile = {}): Backup {
  const backup: Backup = {
    app: APP_NAME,
    formatVersion: FORMAT_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    shots: chronological(shots).map(pickShotFields),
  };
  const known = pickProfileFields(profile);
  if (Object.keys(known).length > 0) backup.profile = known;
  return backup;
}

/** Pretty-printed JSON backup text. */
export function toJson(shots: ShotEntry[], profile: Profile = {}): string {
  return JSON.stringify(buildBackup(shots, profile), null, 2);
}

const CSV_COLUMNS: Array<{ header: string; key: keyof ShotEntry }> = [
  { header: "date", key: "date" },
  { header: "time", key: "time" },
  { header: "doseMg", key: "doseMg" },
  { header: "injectionSite", key: "injectionSite" },
  { header: "injectionSitePosition", key: "injectionSitePosition" },
  { header: "testosteroneEster", key: "testosteroneEster" },
  { header: "carrierOil", key: "carrierOil" },
  { header: "painScore", key: "painScore" },
  { header: "mood", key: "mood" },
  { header: "notes", key: "notes" },
];

/**
 * Escape one CSV cell:
 *  - Formula-injection guard: a leading =, +, -, @, tab, or CR can be executed
 *    as a formula by Excel/Sheets; prefix such cells with a single quote so the
 *    value is shown literally (OWASP CSV-injection guidance). Spreadsheets trim
 *    leading whitespace, so " =cmd" is dangerous too — we also guard a formula
 *    character sitting behind leading spaces/tabs.
 *    Reviewed tradeoff: this also prefixes benign values that happen to start
 *    with these characters (e.g. a note "-5 mg"). That's intended and harmless —
 *    the quote keeps such a value literal text instead of letting a spreadsheet
 *    try to evaluate it, and Excel hides a leading text-marker apostrophe. We
 *    favour safe-by-default over avoiding a rare cosmetic apostrophe in a plain
 *    text viewer.
 *  - RFC 4180 quoting: wrap in double quotes and double any embedded quote when
 *    the cell contains a comma, quote, or newline.
 */
export function escapeCsvCell(value: string | number | undefined): string {
  if (value === undefined) return "";
  let cell = String(value);

  if (/^[=+\-@\t\r]/.test(cell) || /^\s+[=+\-@]/.test(cell)) {
    cell = `'${cell}`;
  }

  if (/[",\n\r]/.test(cell)) {
    cell = `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/**
 * Flat CSV export, chronological. Prefixed with a UTF-8 BOM so Excel opens
 * non-ASCII notes in the right encoding. Rows use CRLF per RFC 4180.
 */
export function toCsv(shots: ShotEntry[]): string {
  const rows = [CSV_COLUMNS.map((c) => c.header).join(",")];
  for (const shot of chronological(shots)) {
    rows.push(CSV_COLUMNS.map((c) => escapeCsvCell(shot[c.key])).join(","));
  }
  const BOM = "\uFEFF";
  return `${BOM}${rows.join("\r\n")}`;
}
