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

/**
 * `downloadTextFile`, but reporting failure instead of throwing.
 *
 * Building a Blob, minting an object URL and synthesising a click can all throw
 * — a browser blocking downloads, or a device with nothing left to allocate,
 * which is exactly the device offering this button. A throw from a React event
 * handler is not caught by an error boundary, so unguarded it means the one
 * recovery path silently does nothing: the failure class this whole feature
 * exists to end, reappearing inside its own escape hatch.
 */
export function tryDownloadTextFile(
  text: string,
  filename: string,
  type: string
): boolean {
  try {
    downloadTextFile(text, filename, type);
    return true;
  } catch (error) {
    console.warn("[download] Failed to start the download:", error);
    return false;
  }
}

/** Timestamped filename stem, e.g. `t-shot-backup-2026-07-13`. Uses the local
 *  date so the filename matches the day the user is actually having. */
export function backupFilename(stem: string, ext: string): string {
  return `${stem}-${localISODate()}.${ext}`;
}
