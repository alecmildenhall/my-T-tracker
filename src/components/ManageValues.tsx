// src/components/ManageValues.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { ShotEntry } from "../types/shot";
import { normalizeValue, valueGroupsFor, type TextField } from "../utils/suggestions";
import { pluralizeEntries as entries } from "../utils/format";

interface ManageValuesProps {
  shots: ShotEntry[];
  onRenameValue: (field: TextField, from: string, to: string) => void;
  onClearValue: (field: TextField, value: string) => void;
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
  | { mode: "combine"; field: TextField; value: string; count: number; target: string };

export const ManageValues: React.FC<ManageValuesProps> = ({
  shots,
  onRenameValue,
  onClearValue,
}) => {
  const groups = useMemo(
    () => FIELDS.map((f) => ({ ...f, values: valueGroupsFor(shots, f.field) })),
    [shots]
  );

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [renameInput, setRenameInput] = useState("");

  // Close the dialog on Escape.
  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDialog(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  const close = () => setDialog(null);

  const openRemove = (field: TextField, value: string, count: number) =>
    setDialog({ mode: "remove", field, value, count });

  const openRename = (field: TextField, value: string, count: number) => {
    setRenameInput(value);
    setDialog({ mode: "rename", field, value, count });
  };

  // Another existing value in the same field that the new name collides with.
  const findCollision = (field: TextField, from: string, to: string): string | null => {
    const values = groups.find((g) => g.field === field)?.values ?? [];
    const hit = values.find(
      (v) =>
        normalizeValue(v.value) === normalizeValue(to) &&
        normalizeValue(v.value) !== normalizeValue(from)
    );
    return hit ? hit.value : null;
  };

  const confirmRemove = () => {
    if (dialog?.mode !== "remove") return;
    onClearValue(dialog.field, dialog.value);
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
      onRenameValue(dialog.field, dialog.value, to);
      close();
      return;
    }
    const target = findCollision(dialog.field, dialog.value, to);
    if (target) {
      setDialog({ ...dialog, mode: "combine", target });
      return;
    }
    onRenameValue(dialog.field, dialog.value, to);
    close();
  };

  const confirmCombine = () => {
    if (dialog?.mode !== "combine") return;
    onRenameValue(dialog.field, dialog.value, dialog.target);
    close();
  };

  return (
    <div className="manage-values">
      {groups.map(({ field, title, values }) => (
        <section className="manage-group" key={field}>
          <h4 className="manage-group__title">{title}</h4>
          {values.length === 0 ? (
            <p className="manage-empty">Nothing saved yet.</p>
          ) : (
            <ul className="manage-list">
              {values.map(({ value, count }) => (
                <li className="manage-row" key={value}>
                  <div className="manage-row__main">
                    <span className="manage-row__name">{value}</span>
                    <span className="manage-row__count">used in {entries(count)}</span>
                  </div>
                  <button
                    type="button"
                    className="manage-row__action"
                    onClick={() => openRename(field, value, count)}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="manage-row__remove"
                    aria-label={`Remove ${value}`}
                    onClick={() => openRemove(field, value, count)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {dialog && (
        <div
          className="dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="dialog">
            {dialog.mode === "remove" && (
              <>
                <h3 id="dialog-title">Remove “{dialog.value}”?</h3>
                <p className="dialog-text">
                  This removes it from <b>{entries(dialog.count)}</b>. Those entries
                  keep everything else.
                </p>
                <div className="dialog-actions">
                  <button type="button" className="secondary-button" onClick={close}>
                    Cancel
                  </button>
                  <button type="button" className="dialog-danger" onClick={confirmRemove}>
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
                    type="text"
                    autoFocus
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
                  Updates the name on all <b>{entries(dialog.count)}</b>. If you rename
                  it to something you already use, they’ll be combined.
                </p>
                <div className="dialog-actions">
                  <button type="button" className="secondary-button" onClick={close}>
                    Cancel
                  </button>
                  <button type="button" className="dialog-go" onClick={submitRename}>
                    Rename
                  </button>
                </div>
              </>
            )}

            {dialog.mode === "combine" && (
              <>
                <h3 id="dialog-title">“{dialog.target}” already exists</h3>
                <p className="dialog-text">
                  Renaming will combine them — the <b>{entries(dialog.count)}</b> logged
                  as “{dialog.value}” will be relabeled “{dialog.target}”.
                </p>
                <div className="dialog-actions">
                  <button type="button" className="secondary-button" onClick={close}>
                    Cancel
                  </button>
                  <button type="button" className="dialog-go" onClick={confirmCombine}>
                    Combine
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
