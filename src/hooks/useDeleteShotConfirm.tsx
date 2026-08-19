// src/hooks/useDeleteShotConfirm.tsx
// The "Delete this shot?" confirm, owned once and used by every list that
// offers deleting — History, and the Home teaser.
//
// INTERIM — slice C replaces it with an undo snackbar, which is the end state
// the roadmap chose (undo over confirm). Until then Delete sits beside Edit on
// every row of a dense phone list, there is no undo, and there is no server
// copy, so one mis-tap permanently loses a logged entry. A confirm is throwaway
// work and worth it against that. This note moved here from HistoryView with
// the state it describes.
//
// Extracted rather than copied when the teaser gained a Delete button. The
// dialog carries decisions that took several rounds to get right — holding open
// on a refused write, saying so rather than dismissing as though it worked,
// handing focus somewhere real afterwards — and a second copy is a second place
// for those to drift. Slice C replaces the confirm with an undo snackbar; when
// it does, there is one call site to change.
import React, { useRef, useState } from "react";
import type { ShotEntry } from "../types/shot";
import { Modal } from "../components/Modal";

interface Options {
  /** Returns whether the deletion reached storage. */
  onDeleteShot: (id: string) => boolean;
  /** Where focus goes if the row it came from has vanished. */
  fallbackFocusRef: React.RefObject<HTMLElement | null>;
  /** Called after a delete that actually landed, so the list can decide where
   *  focus should go — the next row in History, the section on Home. */
  onDeleted?: (id: string) => void;
}

export function useDeleteShotConfirm({
  onDeleteShot,
  fallbackFocusRef,
  onDeleted,
}: Options): {
  requestDelete: (shot: ShotEntry) => void;
  deleteDialog: React.ReactNode;
} {
  const [pending, setPending] = useState<ShotEntry | null>(null);
  const [failed, setFailed] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setFailed(false);
    setPending(null);
  };

  const confirm = (id: string) => {
    // A refused delete commits nothing, so the shot is still in the list.
    // Closing the dialog anyway was the worst version of this: it dismissed as
    // though it had worked, the row stayed put with nothing said, and a later
    // "Try again" force-wrote the UNCHANGED list, succeeded, and cleared the
    // banner — a green all-clear over a delete that never happened. Hold the
    // dialog open and say so, exactly as the log sheet does.
    if (!onDeleteShot(id)) {
      setFailed(true);
      return;
    }
    onDeleted?.(id);
    close();
  };

  return {
    requestDelete: setPending,
    deleteDialog: pending && (
      <Modal
        labelledBy="delete-shot-title"
        onClose={close}
        initialFocusRef={cancelRef}
        fallbackFocusRef={fallbackFocusRef}
      >
        <h3 id="delete-shot-title">Delete this shot?</h3>
        {failed && (
          <p className="dialog-error" role="alert">
            Couldn’t delete it — this device isn’t accepting changes right now.
            The shot is still here, and nothing has been altered.
          </p>
        )}
        <p className="dialog-text">
          The entry from <b>{pending.date}</b> will be removed from this device.
          There is no undo, and no copy anywhere else.
        </p>
        <div className="dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="secondary-button"
            onClick={close}
          >
            Keep it
          </button>
          <button
            type="button"
            className="dialog-danger"
            onClick={() => confirm(pending.id)}
          >
            Delete
          </button>
        </div>
      </Modal>
    ),
  };
}
