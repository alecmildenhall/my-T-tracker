// src/hooks/useBackupExport.ts
// One way to write a backup file, for every place that offers one.
//
// Export is the only recovery that survives eviction, a full disk, private
// browsing and a cleared browser — so it is offered wherever a write has just
// failed, which is now four screens. Building the same three calls at each of
// them is how the filename or the envelope quietly drifts apart between one
// button and the next.
import { useCallback } from "react";
import { useShotsContext } from "../context/ShotsContext";
import { useProfileContext } from "../context/ProfileContext";
import { toJson } from "../utils/exportData";
import { backupFilename, tryDownloadTextFile } from "../utils/download";

/**
 * Returns a callback that downloads everything the app currently holds, and
 * reports whether the download actually started.
 *
 * It reads in-memory state, not storage, so it still produces a complete file on
 * a device that has stopped accepting writes — which is the whole point. What it
 * cannot include is an entry that has not been saved yet: a shot still sitting in
 * the log form has deliberately not been committed anywhere, so anything offering
 * this button beside an unsaved entry has to say so.
 */
export function useBackupExport(): () => boolean {
  const { shots } = useShotsContext();
  const { profile } = useProfileContext();

  return useCallback(
    () =>
      tryDownloadTextFile(
        toJson(shots, profile),
        backupFilename("t-shot-backup", "json"),
        "application/json"
      ),
    [shots, profile]
  );
}
