// src/components/DataManagement.tsx
// The Settings → "Your data" panel: export a backup (JSON) or clinical CSV, and
// import a JSON backup. Import is destructive (it replaces the current data), so
// it always downloads a safety backup of the current data first and asks for
// confirmation before replacing.
import React, { useEffect, useRef, useState } from "react";
import type { ShotEntry } from "../types/shot";
import { toCsv, toJson } from "../utils/exportData";
import { parseBackup } from "../utils/importData";
import { backupFilename, downloadTextFile } from "../utils/download";
import { pluralizeEntries } from "../utils/format";

interface DataManagementProps {
  shots: ShotEntry[];
  onReplaceAll: (next: ShotEntry[]) => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

/** Pending import awaiting the user's confirmation to replace existing data. */
interface PendingImport {
  incoming: ShotEntry[];
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
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState<PendingImport | null>(null);
  // Which export button just fired, so it can briefly show a confirmed state —
  // the same accent treatment the reuse chips use when selected.
  const [flashed, setFlashed] = useState<"json" | "csv" | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close the confirm dialog on Escape.
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPending(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  // Return focus to the Import button when the dialog closes (WAI-ARIA APG:
  // restore focus to the control that opened the modal).
  useEffect(() => {
    if (!pending) return;
    const trigger = importButtonRef.current;
    return () => trigger?.focus();
  }, [pending]);

  // Trap Tab within the modal so keyboard/screen-reader users can't reach the
  // obscured background controls (aria-modal alone is advisory only).
  const trapTab = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

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
        toJson(shots),
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
    setPending({ incoming: result.shots, currentCount: shots.length });
  };

  const confirmReplace = () => {
    if (!pending) return;
    // Fail-safe: download a recovery copy of the CURRENT data first. If that
    // fails, abort — never overwrite the user's data without the backup the
    // dialog promised.
    if (
      shots.length > 0 &&
      !tryDownload(
        toJson(shots),
        backupFilename("t-shot-backup-before-import", "json"),
        "application/json"
      )
    ) {
      setStatus({ kind: "error", message: IMPORT_BACKUP_ERROR });
      setPending(null);
      return;
    }
    onReplaceAll(pending.incoming);
    setStatus({
      kind: "success",
      message: `Restored ${pluralizeEntries(pending.incoming.length)} from backup.`,
    });
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
        entries. Save them somewhere private, and only import files you exported
        yourself.
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
        <div
          className="dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPending(null);
          }}
        >
          <div className="dialog" ref={dialogRef} onKeyDown={trapTab}>
            <h3 id="import-dialog-title">Replace your data?</h3>
            <p className="dialog-text">
              This replaces your current{" "}
              <b>{pluralizeEntries(pending.currentCount)}</b> with{" "}
              <b>{pluralizeEntries(pending.incoming.length)}</b> from the backup.
              A backup of your current data downloads first — keep that file so
              you can undo this.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                autoFocus
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
          </div>
        </div>
      )}
    </div>
  );
};
