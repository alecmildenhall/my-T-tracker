// src/components/ShotListItem.tsx
import React from "react";
import type { ShotEntry } from "../types/shot";

/** Name of the wash keyframes, shared with styles.css. */
const WASH_ANIMATION = "shot-wash";

interface ShotListItemProps {
  shot: ShotEntry;
  onDelete?: (id: string) => void;
  onEdit?: (shot: ShotEntry) => void;
  /**
   * Makes the whole row activate — the Home teaser's way through to editing.
   *
   * Mutually exclusive with `onEdit`/`onDelete`, and not by convention: those
   * render buttons INSIDE the row, and a button inside a button is invalid HTML
   * that browsers reconstruct however they like. The teaser passes this one;
   * History passes the other two.
   */
  onOpen?: (shot: ShotEntry) => void;
  /** This is the shot that was just logged: play the wash once. */
  justLogged?: boolean;
  /** Called when the wash finishes, so the parent can retire the state that
   *  armed it. Driven by the animation's own end rather than a timer, so the
   *  2.2s lives only in CSS. */
  onWashEnd?: () => void;
}

export const ShotListItem: React.FC<ShotListItemProps> = ({
  shot,
  onDelete,
  onEdit,
  onOpen,
  justLogged = false,
  onWashEnd,
}) => {
  const dateLabel = shot.date;
  const timeLabel = shot.time || "—";

  // The row's content, wrapped below either in a plain <div> or in a <button>.
  // Extracted rather than duplicated so the two paths cannot drift — the whole
  // point is that a teaser row and a History row show the same thing.
  const content = (
    <>
      <header className="shot-list-item__header">
        <div>
          <div className="shot-list-item__date">{dateLabel}</div>
          <div className="shot-list-item__time">{timeLabel}</div>
        </div>
        {typeof shot.painScore === "number" && (
          <div className="shot-list-item__pill">Pain: {shot.painScore}/10</div>
        )}
      </header>

      <div className="shot-list-item__meta">
        {shot.doseMg !== undefined && <span> Dose: {shot.doseMg} mg</span>}
        {shot.injectionSite && <span> • Site: {shot.injectionSite}</span>}
        {shot.injectionSitePosition && (
          <span> • Position: {shot.injectionSitePosition}</span>
        )}
        {shot.testosteroneEster && <span> • Type: {shot.testosteroneEster}</span>}
        {shot.carrierOil && <span> • Oil: {shot.carrierOil}</span>}
        {shot.mood && <span> • Mood: {shot.mood}</span>}
      </div>

      {shot.notes && <p className="shot-list-item__notes">{shot.notes}</p>}
    </>
  );

  return (
    // tabIndex -1 makes the row a programmatic focus target only (never in the
    // tab order): "Load more" sends focus to the first newly revealed row, since
    // the button it was on may have just unmounted itself.
    <li
      className={`shot-list-item${justLogged ? " shot-list-item--washing" : ""}`}
      tabIndex={-1}
      // `animationName`, not just "an animation ended": React's onAnimationEnd
      // bubbles, so any future animation on a descendant would otherwise retire
      // the wash early. One value, one meaning.
      onAnimationEnd={(e) => {
        if (e.animationName === WASH_ANIMATION) onWashEnd?.();
      }}
    >
      {onOpen ? (
        // A real <button>, not a click handler on the <li>. The row is a
        // control now, so it has to be reachable by Tab, activate on Enter and
        // Space, and announce itself as something you can press — none of which
        // a div with onClick does, and all of which come free here.
        //
        // The accessible name is the row's own text, which reads as
        // "2026-08-12, 08:30, Dose: 50 mg… button". Verbose, but it is the
        // information the row is FOR; a terser aria-label would hide the very
        // details you are choosing between.
        <button
          type="button"
          className="shot-list-item__open"
          onClick={() => onOpen(shot)}
        >
          {content}
        </button>
      ) : (
        content
      )}

      {/* Only when there is something to put in it. The Home teaser passes
          neither handler, where an unconditional wrapper is an empty flex row
          still carrying its top margin — 8px per row, 24px of nothing on the one
          screen whose whole point is fitting greeting, button and teaser above
          the fold. */}
      {(onEdit || onDelete) && (
        <div className="shot-list-item__actions">
          {onEdit && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => onEdit(shot)}
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="secondary-button secondary-button--danger"
              onClick={() => onDelete(shot.id)}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </li>
  );
};
