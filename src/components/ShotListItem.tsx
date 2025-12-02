// src/components/ShotListItem.tsx
import React from "react";
import type { ShotEntry } from "../types/shot";

interface ShotListItemProps {
  shot: ShotEntry;
  onDelete?: (id: string) => void;
}

export const ShotListItem: React.FC<ShotListItemProps> = ({
  shot,
  onDelete,
}) => {
  const dateLabel = shot.date;
  const timeLabel = shot.time || "—";

  return (
    <li className="shot-list-item">
      <header className="shot-list-item__header">
        <div>
          <div className="shot-list-item__date">{dateLabel}</div>
          <div className="shot-list-item__time">{timeLabel}</div>
        </div>
        {typeof shot.painScore === "number" && (
          <div className="shot-list-item__pill">
            Pain: {shot.painScore}/10
          </div>
        )}
      </header>

      <div className="shot-list-item__meta">
        {shot.doseMg !== undefined && <span> Dose: {shot.doseMg} mg</span>}
        {shot.injectionSite && <span> • Site: {shot.injectionSite}</span>}
        {shot.mood && <span> • Mood: {shot.mood}</span>}
      </div>

      {shot.notes && <p className="shot-list-item__notes">{shot.notes}</p>}

      {onDelete && (
        <button
          type="button"
          className="secondary-button secondary-button--danger"
          onClick={() => onDelete(shot.id)}
        >
          Delete
        </button>
      )}
    </li>
  );
};
