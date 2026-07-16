// src/utils/download.ts
// Trigger a client-side file download for exported data. No network — the file
// is built in memory and handed to the browser via a temporary object URL.
import { localISODate } from "./datetime";

// Object URLs must be revoked to free memory — but revoking too soon cancels the
// still-in-progress download, producing an empty file. The download read is
// async and unobservable, so even a next-tick (0 ms) revoke can be too early in
// Firefox/Safari/Chrome; the safe pattern is to defer by tens of seconds, which
// is what FileSaver.js does. The blob is small (a text export), so holding it
// briefly is negligible. Refs: Mozilla bug 1282407, Chromium issue 41380177.
const REVOKE_DELAY_MS = 40_000;

/** Download `text` as a file named `filename` with the given MIME `type`. */
export function downloadTextFile(
  text: string,
  filename: string,
  type: string
): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/** Timestamped filename stem, e.g. `t-shot-backup-2026-07-13`. Uses the local
 *  date so the filename matches the day the user is actually having. */
export function backupFilename(stem: string, ext: string): string {
  return `${stem}-${localISODate()}.${ext}`;
}
