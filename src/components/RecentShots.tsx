// src/components/RecentShots.tsx
// The Home teaser: the few most recent shots plus a link to the full History.
//
// It was read-only at first, on the reasoning that a destructive control should
// never sit one stray tap from the button you press most often. Both Edit and
// Delete are here now, and the argument that changed it is that the confirm
// dialog already makes deleting two deliberate acts — so the risk being guarded
// against was a mis-tap that cannot actually destroy anything, while the cost
// was a row offering Edit and not Delete beside an identical row, one tab away,
// offering both. There is no difference there a user can see a reason for.
//
// What that spends is vertical space: three rows of actions on the one screen
// whose whole point is fitting the greeting, the log button and the teaser above
// the fold. Worth knowing before anything else is added here.
import React, { useEffect, useRef } from "react";
import type { ShotEntry } from "../types/shot";
import { takeRecent } from "../utils/shotQuery";
import { ShotListItem } from "./ShotListItem";
import { useDeleteShotConfirm } from "../hooks/useDeleteShotConfirm";
import { useRowFocusAfterRemoval } from "../hooks/useRowFocusAfterRemoval";

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
  const listRef = useRef<HTMLUListElement>(null);
  const recent = takeRecent(shots, TEASER_COUNT);
  // The same landing History uses, from the same hook: focus goes to the row
  // that takes the deleted one's place. Deleting from the teaser used to drop
  // focus on the whole <section>, which a screen reader reads out entirely —
  // for the same act, behind the same dialog, one tab away from a list that
  // did it properly. There is usually a row to take the place here too: the
  // teaser shows three of however many exist, so a fourth slides up.
  const { aimAt } = useRowFocusAfterRemoval(listRef, sectionRef);
  // The same dialog History shows, not a second copy of it: it carries
  // decisions that took rounds to settle — holding open on a refused write,
  // saying so rather than dismissing as though it worked — and slice C has one
  // place to replace when the confirm becomes an undo snackbar.
  const { requestDelete, deleteDialog } = useDeleteShotConfirm({
    onDeleteShot,
    // Only reached when the teaser has no row left at all — deleting the last
    // shot. Otherwise onDeleted aims at a real row.
    fallbackFocusRef: sectionRef,
    onDeleted: (id) => {
      aimAt(recent.findIndex((s) => s.id === id));
    },
  });

  // The teaser is the only thing rendering these rows while Home is up, so it
  // is the only one that knows whether the washed row is on screen. App used to
  // ask the model instead ("is it in the newest three"), which is a proxy: it
  // answered no for a row History was showing, and yes for one a filter had
  // hidden. No dependency list — a wash must be retired the moment the row goes,
  // whatever caused the render.
  useEffect(() => {
    if (justLoggedId && !recent.some((s) => s.id === justLoggedId)) {
      onWashEnd?.();
    }
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
        <ul ref={listRef}>
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
