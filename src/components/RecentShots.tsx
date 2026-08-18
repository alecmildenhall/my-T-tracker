// src/components/RecentShots.tsx
// The Home teaser: the few most recent shots plus a link to the full History.
// Read-only on purpose — editing and deleting live in History, so Home stays
// focused on its primary action (logging) and a destructive control is never one
// stray tap from the button you press most often.
import React, { useRef } from "react";
import type { ShotEntry } from "../types/shot";
import { takeRecent } from "../utils/shotQuery";
import { ShotListItem } from "./ShotListItem";
import { useDeleteShotConfirm } from "../hooks/useDeleteShotConfirm";

/** How many shots the teaser shows. Small enough that the greeting, the log
 *  button, and the teaser all fit above the fold on a phone. */
export const TEASER_COUNT = 3;

interface RecentShotsProps {
  shots: ShotEntry[];
  onSeeAll: () => void;
  /** Edit a shot: takes you to History with its editor open. An explicit
   *  button, not the whole row — the row is card-sized and sits beside the
   *  button you press most, and what this opens is an editor, not a page. */
  onEditShot: (shot: ShotEntry) => void;
  /** Returns whether the deletion reached storage. Behind the same confirm
   *  History uses — the reason Delete was kept off this screen was that a
   *  mis-tap could lose an entry, and a confirm is what makes that two
   *  deliberate acts rather than one. */
  onDeleteShot: (id: string) => boolean;
  /** id of the shot just logged, if its wash is still owed. */
  justLoggedId?: string | null;
  /** Fired when that wash finishes. */
  onWashEnd?: () => void;
}

export const RecentShots: React.FC<RecentShotsProps> = ({
  shots,
  onSeeAll,
  onEditShot,
  onDeleteShot,
  justLoggedId = null,
  onWashEnd,
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const recent = takeRecent(shots, TEASER_COUNT);
  // The same dialog History shows, not a second copy of it: it carries
  // decisions that took rounds to settle — holding open on a refused write,
  // saying so rather than dismissing as though it worked — and slice C has one
  // place to replace when the confirm becomes an undo snackbar.
  const { requestDelete, deleteDialog } = useDeleteShotConfirm({
    onDeleteShot,
    // The deleted row is gone, so focus lands on the section heading rather
    // than <body>.
    fallbackFocusRef: sectionRef,
  });

  return (
    // tabIndex -1 so it can actually take focus when the confirm falls back to
    // it, its row having vanished underneath. Without it `.focus()` is a silent
    // no-op and focus lands on <body>.
    <section className="recent-shots" ref={sectionRef} tabIndex={-1}>
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
            <ShotListItem
              key={shot.id}
              shot={shot}
              onEdit={onEditShot}
              onDelete={() => requestDelete(shot)}
              justLogged={shot.id === justLoggedId}
              onWashEnd={onWashEnd}
            />
          ))}
        </ul>
      )}
      {deleteDialog}
    </section>
  );
};
