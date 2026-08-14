// src/components/DataManagement.tsx
// The Settings → "Your data" panel: export a backup (JSON) or clinical CSV, and
// import a JSON backup. Import is destructive (it replaces the current data), so
// it always downloads a safety backup of the current data first and asks for
// confirmation before replacing.
import React, { useEffect, useRef, useState } from "react";
import type { ShotEntry } from "../types/shot";
import type { Profile } from "../types/profile";
import { toCsv, toJson } from "../utils/exportData";
import { parseBackup } from "../utils/importData";
import { backupFilename, tryDownloadTextFile } from "../utils/download";
import { pluralizeEntries } from "../utils/format";
import type { SkippedEntry } from "../utils/importData";
import { hasProfileData, pickProfileFields } from "../utils/backupDto";
import { Modal } from "./Modal";

interface DataManagementProps {
  shots: ShotEntry[];
  /** Returns whether the restore reached storage. */
  onReplaceAll: (next: ShotEntry[]) => boolean;
  // Profile export/import is all-or-nothing: both props are required so a caller
  // can't wire the shot restore without the matching profile restore (which would
  // leave a stale name attached to freshly imported shots).
  /** Current profile, included in exports so a backup is a complete snapshot. */
  profile: Profile;
  /** Replace the profile on import (part of the same destructive restore). */
  onReplaceProfile: (next: Profile) => boolean;
}

type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  // `skipped` lists what a restore could not use; `note` closes off underneath
  // it. They are separate because the note is NOT one of the skipped entries —
  // rendered into the same list it read as a fourth bullet claiming to be one.
  | { kind: "success"; message: string; skipped?: string[]; note?: string };

/** Pending import awaiting the user's confirmation to replace existing data. */
interface PendingImport {
  incoming: ShotEntry[];
  incomingProfile: Profile;
  currentCount: number;
  /** Entries the file held that the restore cannot use — see parseBackup. */
  skipped: SkippedEntry[];
  /** Entries the file held in total, from the parser rather than re-derived. */
  total: number;
  /** The file's profile was unreadable, so this device's own is kept. */
  profileUnreadable: boolean;
}

/**
 * One skipped entry, in a sentence. Named by the date the user typed where that
 * is readable, because that is what they recognise; by position only when the
 * date is the unreadable part.
 */
/** How many skipped entries to name before summarising the rest. Enough to be
 *  useful for the realistic case (a typo or two), few enough that a badly
 *  corrupt file cannot bury the count that matters under a wall of bullets. */
const MAX_LISTED_SKIPS = 5;

const describeSkipped = (entry: SkippedEntry): string =>
  entry.date
    ? `An entry dated ${entry.date} — ${entry.reason}.`
    : `The ${ordinal(entry.position)} entry in the file — ${entry.reason}.`;

/** 1st, 2nd, 3rd… for naming an entry with no readable date. */
function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

const EXPORT_ERROR =
  "Couldn’t save the file. Your browser may be blocking downloads — try again, or check its settings.";

const IMPORT_WRITE_ERROR =
  "Couldn’t restore the backup — this device isn’t accepting writes. Nothing has " +
  "been changed. Try again when there’s more space; the safety copy just " +
  "downloaded is unaffected.";

/**
 * Shots landed, the profile didn't. Deliberately its own message: the one above
 * says "nothing has been changed", and here the history HAS been replaced. This
 * is also the likelier of the two — the large shots write is what exhausts the
 * remaining quota, leaving the small profile write to fail right behind it.
 */
const IMPORT_PARTIAL_ERROR =
  "Your shots were restored, but the name and journey settings from the backup " +
  "weren’t — this device stopped accepting writes part-way. Re-enter them in " +
  "Settings, or import again when there’s more space.";

const IMPORT_BACKUP_ERROR =
  "Couldn’t back up your current data, so nothing was changed. Try again, or check your browser’s download settings.";

/**
 * Download, returning false instead of throwing if the browser rejects it (e.g.
 * blocked object URLs in a sandboxed context). Callers decide how to report it —
 * exports show a notice; the destructive import aborts rather than proceed.
 */
export const DataManagement: React.FC<DataManagementProps> = ({
  shots,
  onReplaceAll,
  profile,
  onReplaceProfile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState<PendingImport | null>(null);
  // Which export button just fired, so it can briefly show a confirmed state —
  // the same accent treatment the reuse chips use when selected.
  const [flashed, setFlashed] = useState<"json" | "csv" | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending flash timer on unmount.
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const flash = (which: "json" | "csv") => {
    setFlashed(which);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashed(null), 1400);
  };

  const handleExportJson = () => {
    if (
      !tryDownloadTextFile(
        toJson(shots, profile),
        backupFilename("t-shot-backup", "json"),
        "application/json"
      )
    ) {
      setStatus({ kind: "error", message: EXPORT_ERROR });
      return;
    }
    setStatus({ kind: "success", message: "Backup downloaded." });
    flash("json");
  };

  const handleExportCsv = () => {
    if (
      !tryDownloadTextFile(
        toCsv(shots),
        backupFilename("t-shot-export", "csv"),
        "text/csv"
      )
    ) {
      setStatus({ kind: "error", message: EXPORT_ERROR });
      return;
    }
    setStatus({ kind: "success", message: "CSV downloaded." });
    flash("csv");
  };

  const handleFileChosen = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    // Reset the input so choosing the same file again still fires onChange.
    event.target.value = "";
    if (!file) return;

    let text: string;
    try {
      text = await file.text();
    } catch {
      setStatus({
        kind: "error",
        message: "That file couldn’t be read. Please try again.",
      });
      return;
    }

    const result = parseBackup(text);
    if (!result.ok) {
      setStatus({ kind: "error", message: result.error });
      return;
    }

    setStatus({ kind: "idle" });
    setPending({
      incoming: result.shots,
      incomingProfile: result.profile,
      currentCount: shots.length,
      skipped: result.skipped,
      total: result.total,
      profileUnreadable: result.profileUnreadable,
    });
  };

  const confirmReplace = () => {
    if (!pending) return;
    // Fail-safe: download a recovery copy of the CURRENT data first. If that
    // fails, abort — never overwrite the user's data without the backup the
    // dialog promised. The recovery copy includes the profile, since the import
    // replaces that too.
    const hasCurrentData = shots.length > 0 || hasProfileData(profile);
    if (
      hasCurrentData &&
      !tryDownloadTextFile(
        toJson(shots, profile),
        backupFilename("t-shot-backup-before-import", "json"),
        "application/json"
      )
    ) {
      setStatus({ kind: "error", message: IMPORT_BACKUP_ERROR });
      setPending(null);
      return;
    }
    // Shots first, and the profile only if they landed. A device that refuses
    // writes would otherwise leave the restore half-applied — the imported name
    // in memory, the imported shots nowhere — under a green "Restored 12 entries
    // from backup." The count was the one thing it could not honestly claim.
    if (!onReplaceAll(pending.incoming)) {
      setStatus({ kind: "error", message: IMPORT_WRITE_ERROR });
      setPending(null);
      return;
    }
    // Only when the file actually carried a readable one. A profile is a single
    // object, so there is nothing partial to salvage — replacing it with `{}`
    // would clear the name and shot day this device already holds, in exchange
    // for nothing. Keeping them is the lesser wrong, and it is said out loud.
    if (
      !pending.profileUnreadable &&
      !onReplaceProfile(pending.incomingProfile)
    ) {
      setStatus({ kind: "error", message: IMPORT_PARTIAL_ERROR });
      setPending(null);
      return;
    }

    // Tell the user what actually changed. The profile is part of this restore,
    // so a name that was overwritten or cleared shouldn't happen silently — but
    // don't claim a change when the imported profile matches the current one
    // (e.g. re-importing your own backup). Compare on known fields only.
    const knownCurrent = pickProfileFields(profile);
    // incomingProfile is already DTO-picked (from parseBackup), so its own keys
    // are exactly the known non-blank fields — no need to re-pick it.
    const incomingHasData = Object.keys(pending.incomingProfile).length > 0;
    // Compare the whole picked profile, not field-by-field: pickProfileFields
    // writes keys in a fixed order, so a serialized compare is stable AND can't
    // silently miss a newly added field (e.g. shotDay) the way an explicit
    // per-field check does. Any change — including a shot-day-only one — surfaces
    // under the single generic "profile was updated" message; there is no
    // per-field messaging.
    const profileChanged =
      !pending.profileUnreadable &&
      JSON.stringify(knownCurrent) !== JSON.stringify(pending.incomingProfile);

    const restored = pending.incoming.length;
    // "43 of 44" only when the two differ. Saying "restored 44 of 44" on every
    // clean import would invite the reader to look for a problem that isn't
    // there.
    let message =
      pending.skipped.length === 0
        ? `Restored ${pluralizeEntries(restored)} from backup.`
        : `Restored ${restored} of ${pending.total} entries from backup.`;
    if (profileChanged) {
      message += incomingHasData
        ? " Your profile was updated."
        : " Your saved profile was cleared.";
    }
    if (pending.profileUnreadable) {
      message +=
        " The saved profile in the file couldn’t be read, so the one on this device was kept.";
    }

    // The count alone is what makes leniency safe rather than data quietly
    // vanishing, so what was skipped is named — and the file is untouched, which
    // is the fact that decides whether any of this matters.
    const extra = pending.skipped.length - MAX_LISTED_SKIPS;
    const skippedLines =
      pending.skipped.length === 0
        ? undefined
        : [
            ...pending.skipped.slice(0, MAX_LISTED_SKIPS).map(describeSkipped),
            ...(extra > 0
              ? [`…and ${extra} more ${extra === 1 ? "entry" : "entries"}.`]
              : []),
          ];
    const note =
      pending.skipped.length === 0
        ? undefined
        : `Your backup file is unchanged, so nothing is lost — you can add ${
            pending.skipped.length === 1 ? "that shot" : "those shots"
          } again whenever you like.`;
    setStatus({ kind: "success", message, skipped: skippedLines, note });
    setPending(null);
  };

  return (
    <div className="data-management">
      <div className="data-actions">
        <button
          type="button"
          className={`secondary-button${flashed === "csv" ? " secondary-button--flash" : ""}`}
          onClick={handleExportCsv}
        >
          {flashed === "csv" ? "✓ Exported" : "Export CSV"}
        </button>
        <button
          type="button"
          className={`secondary-button${flashed === "json" ? " secondary-button--flash" : ""}`}
          onClick={handleExportJson}
        >
          {flashed === "json" ? "✓ Exported" : "Export backup (JSON)"}
        </button>
        <button
          ref={importButtonRef}
          type="button"
          className="secondary-button"
          onClick={() => fileInputRef.current?.click()}
        >
          Import backup (JSON)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          aria-label="Import backup file"
          tabIndex={-1}
          className="visually-hidden"
          onChange={handleFileChosen}
        />
      </div>

      <p className="data-warning">
        Backups are <b>not encrypted</b> — anyone who opens the file can read your
        entries and your profile (including your name, if you set one). Save them
        somewhere private, and only import files you exported yourself.
      </p>

      {status.kind !== "idle" && (
        // One live region around both parts: the message and the list of skipped
        // entries are one announcement, and splitting them would either read the
        // list without its headline or announce twice.
        <div role="status">
          <p
            className={
              status.kind === "error" ? "data-status--error" : "data-status--ok"
            }
          >
            {status.message}
          </p>
          {status.kind === "success" && status.skipped && (
            <ul className="data-status__details">
              {/* Keyed by index, not by the text: two entries can fail the same
                  way on the same date and produce an identical sentence, and
                  React treats duplicate keys as a bug — it warns, and its
                  reconciliation for those children is undefined. (It does still
                  render both, so this is a correctness-of-the-contract fix, not
                  a visibly missing bullet.) The list is built once and never
                  reordered, so the index is stable. */}
              {status.skipped.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          {status.kind === "success" && status.note && (
            <p className="data-status__note">{status.note}</p>
          )}
        </div>
      )}

      {pending && (
        <Modal
          labelledBy="import-dialog-title"
          onClose={() => setPending(null)}
          initialFocusRef={cancelRef}
          restoreFocusRef={importButtonRef}
        >
          <h3 id="import-dialog-title">Replace your data?</h3>
          <p className="dialog-text">
            This replaces your current{" "}
            <b>{pluralizeEntries(pending.currentCount)}</b> with{" "}
            <b>{pluralizeEntries(pending.incoming.length)}</b> from the backup. A
            backup of your current data downloads first — keep that file so you
            can undo this.
          </p>
          {pending.skipped.length > 0 && (
            // Said before the destructive step, not only in the report after it.
            // "Replace 12 entries with 43" is a different decision from "replace
            // 12 with 43, and one in the file cannot be restored", and the second
            // is the one actually on offer.
            <p className="dialog-text">
              <b>
                {pluralizeEntries(pending.skipped.length)} in the backup can’t
                be restored
              </b>{" "}
              and will be skipped. Your backup file isn’t changed.
            </p>
          )}
          <div className="dialog-actions">
            <button
              ref={cancelRef}
              type="button"
              className="secondary-button"
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="dialog-danger"
              onClick={confirmReplace}
            >
              Replace
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
