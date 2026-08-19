// src/components/ShotListItem.tsx
import React from "react";
import type { ShotEntry } from "../types/shot";
import { formatTimeForDisplay } from "../utils/datetime";

/** Name of the wash keyframes, shared with styles.css. */
const WASH_ANIMATION = "shot-wash";

interface ShotListItemProps {
  shot: ShotEntry;
  onDelete?: (id: string) => void;
  onEdit?: (shot: ShotEntry) => void;
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
  justLogged = false,
  onWashEnd,
}) => {
  const dateLabel = shot.date;
  // Shown the way this device writes times; stored as 24-hour HH:MM either way.
  const timeLabel = shot.time ? formatTimeForDisplay(shot.time) : "—";

  // The row is NOT itself a control, deliberately. Making the whole card
  // activate put a card-sized tap target a thumb's width from the button you
  // press most, and what it opened was a modal editor rather than a detail
  // view — tapping a row to reach a destination is ordinary, tapping one to
  // start editing by accident is not. It also announced the row's entire text
  // as the control's name, where "Edit" names the action. Both lists pass both
  // handlers now — see the note in RecentShots for why Delete stopped being
  // History-only.
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
      {content}

      {/* Only when there is something to put in it. Both current callers pass
          both handlers, so this guard has no live caller — it is kept because an
          unconditional wrapper is an empty flex row still carrying its top
          margin, and the next read-only list (a print or doctor-facing summary
          is the obvious one) would otherwise pay 8px a row for nothing. */}
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
