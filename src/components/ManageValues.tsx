// src/components/ManageValues.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ShotEntry } from "../types/shot";
import {
  normalizeValue,
  valueGroupsFor,
  type TextField,
} from "../utils/suggestions";
import { pluralizeEntries as entries } from "../utils/format";
import { Modal } from "./Modal";
import { handOffFocus } from "../utils/focus";
import { WASH_ANIMATION } from "../utils/wash";

interface ManageValuesProps {
  shots: ShotEntry[];
  /** Returns whether the change reached storage. */
  onRenameValue: (field: TextField, from: string, to: string) => boolean;
  /** Returns whether the change reached storage. */
  onClearValue: (field: TextField, value: string) => boolean;
}

const FIELDS: { field: TextField; title: string }[] = [
  { field: "injectionSite", title: "Injection site" },
  { field: "injectionSitePosition", title: "Position" },
  { field: "testosteroneEster", title: "Type of T" },
  { field: "carrierOil", title: "Carrier oil" },
];

type Dialog =
  | { mode: "remove"; field: TextField; value: string; count: number }
  | { mode: "rename"; field: TextField; value: string; count: number }
  | {
      mode: "combine";
      field: TextField;
      value: string;
      count: number;
      target: string;
    };

export const ManageValues: React.FC<ManageValuesProps> = ({
  shots,
  onRenameValue,
  onClearValue,
}) => {
  const groups = useMemo(
    () => FIELDS.map((f) => ({ ...f, values: valueGroupsFor(shots, f.field) })),
    [shots],
  );

  /**
   * The value whose row is owed a wash, or null. Armed ONLY where a rename
   * actually altered stored data and the write came back landed — the two are
   * separate conditions and both have to hold:
   *
   *   - Nothing changed (an empty box, or the same name back) closes the dialog
   *     and arms nothing. A wash means "that did something"; playing it for a
   *     no-op teaches you to stop believing it.
   *   - A REFUSED write arms nothing either, and keeps the dialog open with its
   *     error. `onRenameValue` returning true is the verification that storage
   *     matches the request, so celebrating before checking it would be the
   *     silent-success bug this panel was already fixed for once.
   *
   * Identified by NORMALIZED value plus field, not by the string typed. The
   * display name a group shows is "most recent display form wins"
   * (`accumulate`), so after combining "thigh" into "Glute" the surviving row
   * may read a different casing than the name that was submitted — matching
   * exactly would find no row and silently skip the wash. Field too, because the
   * same word can be saved under two fields ("left" as a position and a site)
   * and only one of them changed.
   */
  const [washed, setWashed] = useState<{
    field: TextField;
    key: string;
  } | null>(null);
  const armWash = (field: TextField, value: string) =>
    setWashed({ field, key: normalizeValue(value) });

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [writeFailed, setWriteFailed] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  // The row button that opened the dialog, captured explicitly so focus returns
  // to it on close (WAI-ARIA APG). We can't rely on document.activeElement:
  // Safari/iOS don't focus a <button> on click, so the "previously focused"
  // element would be <body>, not the opener.
  const openerRef = useRef<HTMLElement | null>(null);
  // Logical focus fallback when a confirm removes the opener's row (see Modal).
  const containerRef = useRef<HTMLDivElement>(null);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);

  // The rename step focuses its input; destructive/combine steps focus Cancel.
  // When rename collides and switches to the combine step in place (the Modal
  // stays mounted, so its open-time focus doesn't re-run), move focus to Cancel.
  //
  // The fallback is the dialog's own HEADING, not this panel: while the Modal is
  // open it marks `#root` inert, and the panel lives inside it — so focusing the
  // panel is a silent no-op and would read as a working floor that isn't one.
  // The floor has to be inside the dialog's portal, which is exactly why the
  // Modal's own open-time chain ends at the dialog element. jsdom ignores
  // `inert` entirely, so no unit test would ever have said so.
  useEffect(() => {
    if (dialog?.mode === "combine") handOffFocus(cancelRef, dialogTitleRef);
  }, [dialog?.mode]);

  // Closing ANY dialog retires an outstanding wash — the same "clears on your
  // next deliberate action" rule the post-log line follows, and it doubles as
  // the guard the shot lists need an effect for.
  //
  // A wash is an animation on a row, so one whose row never mounts (or unmounts
  // mid-play) never fires `animationend` and never retires by itself. RecentShots
  // and HistoryView watch for that in an effect because their rows come and go
  // underneath them. Here every route into and out of this panel's dialogs runs
  // `close()`, so retiring there covers it without a render-phase setState — and
  // the arming sites below deliberately call `close()` FIRST, then arm.
  const close = () => {
    setDialog(null);
    setWriteFailed(false);
    setWashed(null);
  };

  const openRemove = (
    opener: HTMLElement,
    field: TextField,
    value: string,
    count: number,
  ) => {
    openerRef.current = opener;
    setDialog({ mode: "remove", field, value, count });
  };

  const openRename = (
    opener: HTMLElement,
    field: TextField,
    value: string,
    count: number,
  ) => {
    openerRef.current = opener;
    setRenameInput(value);
    setDialog({ mode: "rename", field, value, count });
  };

  // Another existing value in the same field that the new name collides with.
  const findCollision = (
    field: TextField,
    from: string,
    to: string,
  ): string | null => {
    const values = groups.find((g) => g.field === field)?.values ?? [];
    const hit = values.find(
      (v) =>
        normalizeValue(v.value) === normalizeValue(to) &&
        normalizeValue(v.value) !== normalizeValue(from),
    );
    return hit ? hit.value : null;
  };

  // Every one of these closes the dialog ONLY when the change reached storage.
  // Closing regardless was the same silent failure the log sheet was fixed for:
  // the dialog dismisses as though it worked, the list still shows the old
  // value, and only a generic banner elsewhere hints why. Settings is one of the
  // four write sites this feature exists to stop being silent.
  const confirmRemove = () => {
    if (dialog?.mode !== "remove") return;
    if (!onClearValue(dialog.field, dialog.value)) return setWriteFailed(true);
    close();
  };

  const submitRename = () => {
    if (dialog?.mode !== "rename") return;
    const to = renameInput.trim();
    if (!to || to === dialog.value) {
      close();
      return;
    }
    // Same value, only re-cased: apply the new capitalisation, no collision.
    if (normalizeValue(to) === normalizeValue(dialog.value)) {
      if (!onRenameValue(dialog.field, dialog.value, to)) {
        setWriteFailed(true);
        return;
      }
      // Re-casing IS a change — every entry now stores the new capitalisation —
      // so it earns the wash like any other rename. The no-change cases were
      // already returned above.
      close();
      armWash(dialog.field, to);
      return;
    }
    const target = findCollision(dialog.field, dialog.value, to);
    if (target) {
      setDialog({ ...dialog, mode: "combine", target });
      return;
    }
    if (!onRenameValue(dialog.field, dialog.value, to)) {
      setWriteFailed(true);
      return;
    }
    close();
    armWash(dialog.field, to);
  };

  const confirmCombine = () => {
    if (dialog?.mode !== "combine") return;
    if (!onRenameValue(dialog.field, dialog.value, dialog.target)) {
      return setWriteFailed(true);
    }
    // The row that survives is the target's, and it is the one that changed —
    // it absorbed the other value's entries, so its count just went up.
    close();
    armWash(dialog.field, dialog.target);
  };

  return (
    // tabIndex={-1} makes the panel programmatically focusable (not tabbable) so
    // it can be the logical focus target when a confirm removes the row that
    // opened the dialog.
    <div className="manage-values" ref={containerRef} tabIndex={-1}>
      {groups.map(({ field, title, values }) => (
        <section className="manage-group" key={field}>
          <h3 className="manage-group__title">{title}</h3>
          {values.length === 0 ? (
            <p className="manage-empty">Nothing saved yet.</p>
          ) : (
            <ul className="manage-list">
              {values.map(({ value, count }) => {
                const washing =
                  washed?.field === field &&
                  washed.key === normalizeValue(value);
                return (
                  <li
                    className={`manage-row${washing ? " manage-row--washing" : ""}`}
                    key={value}
                    // Guarded on the animation NAME: onAnimationEnd bubbles, so
                    // "an animation ended" is not "the wash ended" — any animation
                    // on a descendant control would otherwise cut it short.
                    onAnimationEnd={(e) => {
                      if (e.animationName === WASH_ANIMATION) setWashed(null);
                    }}
                  >
                    <div className="manage-row__main">
                      <span className="manage-row__name">{value}</span>
                      <span className="manage-row__count">
                        used in {entries(count)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="manage-row__action"
                      onClick={(e) =>
                        openRename(e.currentTarget, field, value, count)
                      }
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="manage-row__remove"
                      aria-label={`Remove ${value}`}
                      onClick={(e) =>
                        openRemove(e.currentTarget, field, value, count)
                      }
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      {dialog && (
        <Modal
          labelledBy="dialog-title"
          onClose={close}
          initialFocusRef={
            dialog.mode === "rename" ? renameInputRef : cancelRef
          }
          restoreFocusRef={openerRef}
          fallbackFocusRef={containerRef}
        >
          {dialog.mode === "remove" && (
            <>
              <h3 id="dialog-title">Remove “{dialog.value}”?</h3>
              <p className="dialog-text">
                This removes it from <b>{entries(dialog.count)}</b>. Those
                entries keep everything else.
              </p>
              {writeFailed && (
                <p className="dialog-error" role="alert">
                  Couldn’t save that — this device isn’t accepting changes right
                  now. Nothing has been altered.
                </p>
              )}
              <div className="dialog-actions">
                <button
                  ref={cancelRef}
                  type="button"
                  className="secondary-button"
                  onClick={close}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="dialog-danger"
                  onClick={confirmRemove}
                >
                  Remove
                </button>
              </div>
            </>
          )}

          {dialog.mode === "rename" && (
            <>
              <h3 id="dialog-title">Rename “{dialog.value}”</h3>
              <label className="dialog-field">
                New name
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitRename();
                    }
                  }}
                />
              </label>
              <p className="dialog-text">
                Updates the name on all <b>{entries(dialog.count)}</b>. If you
                rename it to something you already use, they’ll be combined.
              </p>
              {writeFailed && (
                <p className="dialog-error" role="alert">
                  Couldn’t save that — this device isn’t accepting changes right
                  now. Nothing has been altered.
                </p>
              )}
              <div className="dialog-actions">
                <button
                  ref={cancelRef}
                  type="button"
                  className="secondary-button"
                  onClick={close}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="dialog-go"
                  onClick={submitRename}
                >
                  Rename
                </button>
              </div>
            </>
          )}

          {dialog.mode === "combine" && (
            <>
              <h3 id="dialog-title" ref={dialogTitleRef} tabIndex={-1}>
                “{dialog.target}” already exists
              </h3>
              <p className="dialog-text">
                Renaming will combine them — the <b>{entries(dialog.count)}</b>{" "}
                logged as “{dialog.value}” will be relabeled “{dialog.target}”.
              </p>
              {writeFailed && (
                <p className="dialog-error" role="alert">
                  Couldn’t save that — this device isn’t accepting changes right
                  now. Nothing has been altered.
                </p>
              )}
              <div className="dialog-actions">
                <button
                  ref={cancelRef}
                  type="button"
                  className="secondary-button"
                  onClick={close}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="dialog-go"
                  onClick={confirmCombine}
                >
                  Combine
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
};
