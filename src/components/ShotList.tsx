// src/components/ShotList.tsx
import React from "react";
import type { ShotEntry } from "../types/shot";
import { compareShotsChrono } from "../utils/sortShots";
import { ShotListItem } from "./ShotListItem";

interface ShotListProps {
  shots: ShotEntry[];
  onDeleteShot?: (id: string) => void;
  onEditShot?: (shot: ShotEntry) => void;
}

export const ShotList: React.FC<ShotListProps> = ({
  shots,
  onDeleteShot,
  onEditShot,
}) => {
  if (shots.length === 0) {
    return (
      <section className="shot-list">
        <h2>Shot history</h2>
        <div className="empty-state">
          <p>No shots logged yet. Your data stays on this device.</p>
        </div>
      </section>
    );
  }

  // Newest first: reverse of the shared chronological (oldest-first) comparator,
  // so same-day shots order by time (not by random id) and the list agrees with
  // the export ordering.
  const sorted = [...shots].sort((a, b) => -compareShotsChrono(a, b));

  return (
    <section className="shot-list">
      <h2>Shot history</h2>
      <ul>
        {sorted.map((shot) => (
          <ShotListItem
            key={shot.id}
            shot={shot}
            onDelete={onDeleteShot}
            onEdit={onEditShot}
          />
        ))}
      </ul>
    </section>
  );
};
