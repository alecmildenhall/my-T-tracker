// src/components/StorageBanner.tsx
// The one place the app says "that didn't save".
//
// A banner rather than a snackbar or a dialog. A snackbar is transient, and
// Material is explicit that they aren't for critical or persistent errors —
// timing out is exactly wrong when nothing else recorded the failure and the
// entry is gone. A dialog is for blocking, decision-based problems, and there is
// no decision here: retry is the only move, and a repeating failure would become
// a modal you cannot escape mid-log.
//
// It sits above the view rather than inside the log sheet because writes fail
// from at least four places — logging, editing, deleting, and Settings — and an
// in-sheet message would leave three of them silent.
import React, { useEffect, useRef, useState } from "react";
import { useStorageHealth } from "../context/StorageHealthContext";
import { useBackupExport } from "../hooks/useBackupExport";

export const StorageBanner: React.FC<{
  /** Where focus goes when the banner removes itself. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}> = ({ returnFocusRef }) => {
  const { failingKeys, dismissed, dismiss, retry } = useStorageHealth();
  const exportBackup = useBackupExport();
  // A download can be refused too — by a browser blocking it, or by a device
  // with nothing left to allocate, which is the device reading this banner. An
  // export button that silently does nothing is this feature's own bug, inside
  // its own escape hatch.
  const [exportFailed, setExportFailed] = useState(false);
  const handleExport = () => setExportFailed(!exportBackup());

  const shown = failingKeys.size > 0 && !dismissed;

  // Every control in here removes the element that contains it: ✕ hides the
  // banner, and a successful "Try again" clears the failure that renders it. The
  // browser's response to losing the focused element is to drop focus on <body>,
  // which strands a keyboard user at the top of the document and silences the
  // next screen-reader announcement. See CLAUDE.md — this is the defect class
  // that produced nine bugs in slice B, so the hand-off lives with the thing
  // that removes itself rather than being left to the caller.
  const wasShown = useRef(false);
  useEffect(() => {
    if (shown) {
      wasShown.current = true;
      return;
    }
    if (!wasShown.current) return;
    wasShown.current = false;
    // Only rescue focus that was actually dropped — if something else has since
    // claimed it, moving it again would be the more surprising behaviour.
    if (document.activeElement === document.body) {
      returnFocusRef?.current?.focus();
    }
  }, [shown, returnFocusRef]);

  if (!shown) return null;

  return (
    // `alert`, not `status`: this is not incidental progress information, it is
    // the app telling you something it did not do.
    <div className="storage-banner" role="alert">
      <div className="storage-banner__text">
        {/* No number, deliberately. The roadmap asked for a count, and building
            it showed the count cannot mean what anyone would read it as: writes
            fire per store and on mount, so a single failed save reported FIVE.
            Nor are they five separate losses — the in-memory state holds
            everything, so a run of failures is one unsaved state, not a tally.
            "Not being saved" is the fact we actually have. */}
        <strong className="storage-banner__title">
          Your changes aren’t being saved
        </strong>
        Anything you add stays on screen but won’t survive a reload. Storage may
        be full, or private browsing may be blocking it.
      </div>

      {exportFailed && (
        <p className="storage-banner__export-error">
          The download didn’t start. Try Settings → Your data, or free up space
          first.
        </p>
      )}

      <div className="storage-banner__actions">
        <button type="button" className="storage-banner__go" onClick={retry}>
          Try again
        </button>
        {/* Beside retry, not behind it: a device that cannot save is exactly when
            a copy off it is worth most, and export is the only recovery that
            survives eviction, a full disk, and a cleared browser. */}
        <button type="button" className="storage-banner__alt" onClick={handleExport}>
          Export a backup
        </button>
      </div>

      {/* Dismissible on purpose. A genuinely full device will never succeed on
          retry, and a banner that cannot be dismissed leaves the app permanently
          degraded with no way to say "I know". The next failure re-raises it, so
          acknowledging this one never silences the next. */}
      <button
        type="button"
        className="storage-banner__dismiss"
        onClick={dismiss}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
};
