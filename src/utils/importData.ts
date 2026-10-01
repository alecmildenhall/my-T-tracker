// src/utils/importData.ts
// Parses an untrusted backup file into validated ShotEntry[]. Layered defenses:
//   1. size cap        — refuse pathologically large input before parsing
//   2. reviver         — reject prototype-pollution keys during JSON.parse
//   3. Zod schema      — envelope strictly, then each entry on its own
//   4. allowlist copy  — rebuild each shot from known fields only (never spread)
//
// STRICT AT THE FILE LEVEL, LENIENT AT THE ROW LEVEL, and the split is the point.
// A wrong `app`, a wrong `formatVersion`, unparseable JSON or a hostile key all
// mean "this is not your backup", so the file is refused. One entry with a date
// nothing can read means "this entry is unusable" — and refusing 43 good entries
// over it optimises for schema purity over the single thing a backup exists for.
// By the time someone imports one, it is usually the only copy left.
//
// The caller gets a plain discriminated result. Error text stays generic so we
// never leak parser internals; the per-entry reasons are a small curated set,
// not Zod's messages.
import type { ShotEntry } from "../types/shot";
import type { Profile } from "../types/profile";
import {
  backupEnvelopeSchema,
  shotEntrySchema,
  profileSchema,
} from "./shotSchema";
import { pickProfileFields, pickShotFields } from "./backupDto";

/** Hard ceiling on input size. Realistic backups are kilobytes; this only stops
 *  a hostile or corrupt multi-hundred-MB file from exhausting memory. */
const MAX_INPUT_CHARS = 10 * 1024 * 1024; // ~10 MB

/** Object keys that enable prototype-pollution; never legitimate in our data. */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * One entry the file contained and the restore could not use.
 *
 * Carries what the user needs to recognise it — the date they typed, when that
 * much is readable — rather than a row number they have no way to map back to
 * anything. `position` is the fallback for an entry whose date is the unreadable
 * part.
 */
export interface SkippedEntry {
  /** 1-based position in the file's `shots` array. */
  position: number;
  /** The date as written, when it is a string at all. */
  date?: string;
  /** Plain-language reason, from the curated set below. */
  reason: string;
}

export type ImportResult =
  | {
      ok: true;
      shots: ShotEntry[];
      profile: Profile;
      /** Entries in the file, restored plus skipped. */
      total: number;
      skipped: SkippedEntry[];
      /**
       * The file carried a profile that could not be read, so the caller should
       * leave the device's own profile alone rather than replacing it with
       * nothing. A profile is one object, not a list: there is no "43 of 44" to
       * salvage, and silently clearing someone's name would be a worse answer
       * than keeping what they already have.
       */
      profileUnreadable: boolean;
    }
  | { ok: false; error: string };

const GENERIC_ERROR =
  "This file couldn’t be read as a T-Shot Tracker backup. Make sure you picked a backup file exported from this app.";

/**
 * Every entry unusable. Not the same message as a wrong file, because it is not
 * the same problem — this one IS a T-Shot Tracker backup, there is simply
 * nothing in it we can restore, and saying "pick a file exported from this app"
 * would send someone looking for a file they already have.
 */
const nothingUsableError = (total: number) =>
  `None of the ${total} ${total === 1 ? "entry" : "entries"} in this file could be read, so nothing was restored. Your entries on this device haven’t been changed.`;

/**
 * Why an entry was skipped, in the user's vocabulary.
 *
 * Keyed by the field that failed, and deliberately a small fixed set rather than
 * Zod's messages: those name internal types and constraints, and this text goes
 * on screen. Anything unmapped falls back to the generic line rather than
 * inventing a specific claim.
 */
const REASON_BY_FIELD: Record<string, string> = {
  id: "it has no identifier",
  date: "its date isn’t one this app can use",
  time: "its time couldn’t be read",
  doseMg: "its dose couldn’t be read",
  pain: "its pain level couldn’t be read",
  offDays: "its off-days answer couldn’t be read",
  // Named like the two above, and for the same reason: the report is the only
  // account of what a restore dropped, and "some of it couldn't be read" tells
  // the person nothing they can act on. One line per field, which is the gap
  // the DTO allowlist rule exists to catch.
  afterSoreness: "its soreness answer couldn’t be read",
  afterLump: "its lump answer couldn’t be read",
};

const FALLBACK_REASON = "some of it couldn’t be read";

/** JSON.parse reviver that rejects dangerous keys anywhere in the tree. */
function safeReviver(key: string, value: unknown): unknown {
  if (FORBIDDEN_KEYS.has(key)) {
    throw new Error("forbidden key in import");
  }
  return value;
}

/**
 * The `date` of a raw entry, if it is a string at all — for naming it on screen.
 *
 * Truncated, because this comes from an untrusted file and ends up in the UI: a
 * corrupt or hostile backup can carry a megabyte-long "date", and there is no
 * reason to render it. A real one is ten characters.
 */
const MAX_SHOWN_DATE_CHARS = 30;

function readableDate(raw: unknown): string | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const date = (raw as { date?: unknown }).date;
  if (typeof date !== "string" || date.trim() === "") return undefined;
  return date.length > MAX_SHOWN_DATE_CHARS
    ? `${date.slice(0, MAX_SHOWN_DATE_CHARS)}…`
    : date;
}

/**
 * Validate raw backup-file text and return clean ShotEntry[] or a generic error.
 * Never throws — all failure modes collapse into `{ ok: false }` or a skip.
 */
/**
 * Fields the model has RETIRED, dropped before validation.
 *
 * `shotEntrySchema` is a `strictObject`, which is what keeps an unknown key from
 * riding into storage — but it cannot tell a key we have never heard of from one
 * we deliberately removed, and it skips the whole ENTRY either way. Measured: a
 * backup exported by the previous build, fed straight back, lost shot "a"
 * entirely — its notes, dose, site, pain and planned date — because it still
 * carried `mood`.
 *
 * The roadmap decided that old free-text mood values are dropped. It decided
 * nothing about dropping the shot around them, and this file's own rule points
 * the other way: refuse when accepting would write something wrong, DEGRADE when
 * refusing would withhold data the user already owns. The rest of that entry is
 * readable and theirs.
 *
 * A retired key is therefore not an unknown key. We know exactly what it was and
 * have decided to discard its value — so it is discarded here, by name, and the
 * strict check still catches everything genuinely unrecognised.
 */
// `painScore` belongs here for the same reason and from the same slice: it
// became the `pain` enum one PR before `mood` became `offDays`, so a backup
// from any build older than that carries a key the strict check calls unknown,
// and the ENTRY — its date, notes, dose, site — is skipped over one dead field.
const RETIRED_KEYS = ["mood", "painScore"] as const;

function withoutRetiredKeys(entry: unknown): unknown {
  if (typeof entry !== "object" || entry === null) return entry;
  const carried = RETIRED_KEYS.filter((k) => k in (entry as object));
  if (carried.length === 0) return entry;
  const copy = { ...(entry as Record<string, unknown>) };
  for (const key of carried) delete copy[key];
  return copy;
}

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

  const envelope = backupEnvelopeSchema.safeParse(raw);
  if (!envelope.success) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const shots: ShotEntry[] = [];
  const skipped: SkippedEntry[] = [];
  envelope.data.shots.forEach((entry, index) => {
    const parsed = shotEntrySchema.safeParse(withoutRetiredKeys(entry));
    if (parsed.success) {
      shots.push(pickShotFields(parsed.data));
      return;
    }
    // The first issue's field, not all of them: one reason is what a person can
    // act on, and the first failing field is the one they typed wrong.
    const field = parsed.error.issues[0]?.path[0];
    skipped.push({
      position: index + 1,
      date: readableDate(entry),
      reason:
        (typeof field === "string" ? REASON_BY_FIELD[field] : undefined) ??
        FALLBACK_REASON,
    });
  });

  // Everything unusable is a file-level problem wearing row-level clothes: there
  // is nothing to restore, so restoring "all of it" would mean wiping the
  // device's entries in exchange for none. Refuse instead, and change nothing.
  if (skipped.length > 0 && shots.length === 0) {
    return { ok: false, error: nothingUsableError(skipped.length) };
  }

  const rawProfile = envelope.data.profile;
  const parsedProfile =
    rawProfile === undefined ? undefined : profileSchema.safeParse(rawProfile);

  return {
    ok: true,
    shots,
    profile:
      parsedProfile?.success === true
        ? pickProfileFields(parsedProfile.data)
        : {},
    total: envelope.data.shots.length,
    skipped,
    profileUnreadable: parsedProfile !== undefined && !parsedProfile.success,
  };
}
