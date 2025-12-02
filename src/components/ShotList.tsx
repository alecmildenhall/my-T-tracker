// src/components/ShotList.tsx
import React from "react";
import type { ShotEntry } from "../types/shot";
import { ShotListItem } from "./ShotListItem";

interface ShotListProps {
  shots: ShotEntry[];
  onDeleteShot?: (id: string) => void;
}

export const ShotList: React.FC<ShotListProps> = ({ shots, onDeleteShot }) => {
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

  const sorted = [...shots].sort((a, b) => {
    if (a.date === b.date) return a.id < b.id ? 1 : -1;
    return a.date < b.date ? 1 : -1;
  });

  return (
    <section className="shot-list">
      <h2>Shot history</h2>
      <ul>
        {sorted.map((shot) => (
          <ShotListItem
            key={shot.id}
            shot={shot}
            onDelete={onDeleteShot}
          />
        ))}
      </ul>
    </section>
  );
};
