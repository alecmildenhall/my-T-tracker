// src/utils/exportData.ts
// Builds backup/export payloads from the in-memory shot list. Two formats:
//   - JSON: the full round-trippable backup envelope (import reads this back)
//   - CSV:  a flat, spreadsheet-friendly export for clinical conversations
// CSV is export-only — we never parse it back — so it optimises for safety in
// spreadsheet apps (formula-injection guard) and correctness (RFC 4180 quoting).
import { isOffDaysPattern, isPainLevel, isSorenessDuration, type OffDaysPattern, type ShotEntry, type SorenessDuration } from "../types/shot";
import { offDaysLabel } from "./offDaysLabel";
import { sorenessLabel } from "./soreness";
import { isShotDateInRange } from "./civilDate";
import type { Profile } from "../types/profile";
import { APP_NAME, APP_VERSION, FORMAT_VERSION } from "../appMeta";
import type { Backup } from "./shotSchema";
import { compareShotsChrono } from "./sortShots";
import { pickProfileFields, pickShotFields } from "./backupDto";

/** Oldest-first, matching how shots are stored and how a reader expects a log.
 *  Ties (same date, and time is optional) keep the order they were logged in:
 *  the comparator returns 0 for them and Array#sort is stable, so the stored
 *  order carries through. */
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

const CSV_COLUMNS: Array<{
  header: string;
  key: keyof ShotEntry;
  /** Optional gate on the raw stored value, for columns whose validity the
   *  shots store deliberately does not enforce. */
  usable?: (value: unknown) => boolean;
  /** Optional rendering, for a stored value that is not readable on its own. */
  format?: (value: unknown) => string;
}> = [
  { header: "date", key: "date" },
  // Beside the date it belongs to, so a provider reading the CSV can see the
  // gap without arithmetic. Empty for shots logged before a cadence was set.
  //
  // Gated, unlike the other columns, because this one can disagree with the
  // JSON backup. `sanitizeShots` is deliberately lenient — it protects the
  // SHOT from being dropped and explicitly does not vet field validity — while
  // `pickShotFields` drops an out-of-range plannedFor from the backup. Without
  // this, a hand-edited or legacy value would be absent from the JSON and
  // written verbatim into the file a provider reads, which is the wrong way
  // round for the two.
  {
    header: "plannedFor",
    key: "plannedFor",
    usable: (v) => typeof v === "string" && isShotDateInRange(v),
  },
  { header: "time", key: "time" },
  { header: "doseMg", key: "doseMg" },
  { header: "injectionSite", key: "injectionSite" },
  { header: "injectionSitePosition", key: "injectionSitePosition" },
  { header: "testosteroneEster", key: "testosteroneEster" },
  { header: "carrierOil", key: "carrierOil" },
  // Gated like plannedFor, and it has to move with pickShotFields: a value the
  // backup drops must not be written verbatim into the file a provider reads,
  // and the two exports disagreeing either way is the failure.
  //
  // The RAW level, deliberately, not `painLabel`'s "Moderate". That helper
  // exists so a level does not read differently across the app's own surfaces,
  // and this file is not one of them: every header here is a field name
  // (`injectionSitePosition`, `testosteroneEster`) and every value is as
  // stored — the row shows `8:45 PM` while this column writes `20:45`.
  // Capitalising one column against that would make pain the odd one out in a
  // data file. Recorded because "the CSV is for clinical conversations" makes
  // the opposite look right until you look at the rest of the file.
  { header: "pain", key: "pain", usable: isPainLevel },
  // `offDays`, not `off_days`: the comment above is explicit that every header
  // here is a FIELD NAME, and the file is full of camelCase ones. Guarded like
  // pain, for the same reason — a value that predates the enum, or a
  // hand-edited backup, must not be written verbatim into a file a provider
  // reads.
  //
  // And WRITTEN OUT, unlike pain — which looks like an inconsistency and is
  // the rule applied properly. The rule the pain column states is that a cell
  // is the value as stored; the rule it is really serving is that a cell must
  // be readable on its own. `mild` satisfies both. `right-after` satisfies only
  // the first: it is a fragment, and right after WHAT is answerable only from
  // the label this field has a whole function for. A provider reading
  // "Right after the previous shot" needs nothing else; one reading
  // `right-after` needs the app.
  //
  // Nothing depends on the raw form here — CSV is export-only, the backup
  // format is JSON, and `escapeCsvCell` already quotes to RFC 4180, so the
  // spaces cost nothing.
  {
    header: "offDays",
    key: "offDays",
    usable: isOffDaysPattern,
    format: (v) => offDaysLabel(v as OffDaysPattern),
  },
  // Written out like offDays, and for the rule that column states: a cell must
  // be readable on its own. `several-days` is a fragment — several days of
  // what? — where "Sore several days" needs nothing else. Guarded like the
  // others so a value the backup drops is never written verbatim into the file
  // a provider reads.
  {
    header: "afterSoreness",
    key: "afterSoreness",
    usable: isSorenessDuration,
    format: (v) => sorenessLabel(v as SorenessDuration),
  },
  // yes/no rather than true/false: the column beside it is prose, and a
  // spreadsheet reader is not a JSON reader.
  {
    header: "afterLump",
    key: "afterLump",
    usable: (v) => typeof v === "boolean",
    format: (v) => (v ? "yes" : "no"),
  },
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
    rows.push(
      CSV_COLUMNS.map((c) => {
        const value = shot[c.key];
        if (c.usable && value !== undefined && !c.usable(value)) return "";
        if (c.format && value !== undefined) return escapeCsvCell(c.format(value));
        // A boolean-valued column must declare a `format`: "true" is not a word
        // a file a provider reads should contain. Blank rather than leak it —
        // fail safe, and a test pins the one column this applies to.
        if (typeof value === "boolean") return "";
        return escapeCsvCell(value);
      }).join(","),
    );
  }
  const BOM = "\uFEFF";
  return `${BOM}${rows.join("\r\n")}`;
}
