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
import { backupFilename, downloadTextFile } from "../utils/download";
import { pluralizeEntries } from "../utils/format";
import { hasProfileData, pickProfileFields } from "../utils/backupDto";
import { Modal } from "./Modal";

interface DataManagementProps {
  shots: ShotEntry[];
  onReplaceAll: (next: ShotEntry[]) => void;
  // Profile export/import is all-or-nothing: both props are required so a caller
  // can't wire the shot restore without the matching profile restore (which would
  // leave a stale name attached to freshly imported shots).
  /** Current profile, included in exports so a backup is a complete snapshot. */
  profile: Profile;
  /** Replace the profile on import (part of the same destructive restore). */
  onReplaceProfile: (next: Profile) => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

/** Pending import awaiting the user's confirmation to replace existing data. */
interface PendingImport {
  incoming: ShotEntry[];
  incomingProfile: Profile;
  currentCount: number;
}

const EXPORT_ERROR =
  "Couldn’t save the file. Your browser may be blocking downloads — try again, or check its settings.";

const IMPORT_BACKUP_ERROR =
  "Couldn’t back up your current data, so nothing was changed. Try again, or check your browser’s download settings.";

/**
 * Download, returning false instead of throwing if the browser rejects it (e.g.
 * blocked object URLs in a sandboxed context). Callers decide how to report it —
 * exports show a notice; the destructive import aborts rather than proceed.
 */
function tryDownload(text: string, name: string, mime: string): boolean {
  try {
    downloadTextFile(text, name, mime);
    return true;
  } catch {
    return false;
  }
}

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
      !tryDownload(
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
      !tryDownload(
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
      !tryDownload(
        toJson(shots, profile),
        backupFilename("t-shot-backup-before-import", "json"),
        "application/json"
      )
    ) {
      setStatus({ kind: "error", message: IMPORT_BACKUP_ERROR });
      setPending(null);
      return;
    }
    onReplaceAll(pending.incoming);
    onReplaceProfile(pending.incomingProfile);

    // Tell the user what actually changed. The profile is part of this restore,
    // so a name that was overwritten or cleared shouldn't happen silently — but
    // don't claim a change when the imported profile matches the current one
    // (e.g. re-importing your own backup). Compare on known fields only.
    const knownCurrent = pickProfileFields(profile);
    // incomingProfile is already DTO-picked (from parseBackup), so its own keys
    // are exactly the known non-blank fields — no need to re-pick it.
    const incomingHasData = Object.keys(pending.incomingProfile).length > 0;
    const profileChanged =
      knownCurrent.startDate !== pending.incomingProfile.startDate ||
      knownCurrent.preferredName !== pending.incomingProfile.preferredName;

    let message = `Restored ${pluralizeEntries(pending.incoming.length)} from backup.`;
    if (profileChanged) {
      message += incomingHasData
        ? " Your profile was updated."
        : " Your saved profile was cleared.";
    }
    setStatus({ kind: "success", message });
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
        <p
          className={
            status.kind === "error" ? "data-status--error" : "data-status--ok"
          }
          role="status"
        >
          {status.message}
        </p>
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
