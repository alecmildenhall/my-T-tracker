// src/components/RecentShots.tsx
// The Home teaser: the few most recent shots plus a link to the full History.
// Read-only on purpose — editing and deleting live in History, so Home stays
// focused on its primary action (logging) and a destructive control is never one
// stray tap from the button you press most often.
import React from "react";
import type { ShotEntry } from "../types/shot";
import { takeRecent } from "../utils/shotQuery";
import { ShotListItem } from "./ShotListItem";

/** How many shots the teaser shows. Small enough that the greeting, the log
 *  button, and the teaser all fit above the fold on a phone. */
export const TEASER_COUNT = 3;

interface RecentShotsProps {
  shots: ShotEntry[];
  onSeeAll: () => void;
}

export const RecentShots: React.FC<RecentShotsProps> = ({ shots, onSeeAll }) => {
  const recent = takeRecent(shots, TEASER_COUNT);

  return (
    <section className="recent-shots">
      <div className="recent-shots__header">
        <h2>Recent shots</h2>
        {shots.length > 0 && (
          <button type="button" className="link-button" onClick={onSeeAll}>
            See all →
          </button>
        )}
      </div>

      {recent.length === 0 ? (
        <p className="empty-state">
          No shots logged yet. Your data stays on this device.
        </p>
      ) : (
        <ul>
          {recent.map((shot) => (
            <ShotListItem key={shot.id} shot={shot} />
          ))}
        </ul>
      )}
    </section>
  );
};
