// src/utils/storageWritable.ts
/**
 * Can this device be written to at all, right now?
 *
 * A probe rather than a prediction: it answers "would a write throw", which is
 * what Safari private browsing does unconditionally. It is deliberately NOT a
 * quota check — a one-byte probe can succeed on a device that then rejects a
 * real payload — so it is used to hold the sheet open on the common case, while
 * the banner above still catches whatever slips past.
 */
export function storageWritable(): boolean {
  try {
    const probe = "hrt-shot-tracker:__probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
