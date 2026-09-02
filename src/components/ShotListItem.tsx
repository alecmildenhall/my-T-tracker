// src/components/ShotListItem.tsx
import React from "react";
import type { ShotEntry } from "../types/shot";
import { WASH_ANIMATION } from "../utils/wash";
import { formatTimeForDisplay } from "../utils/datetime";
import { daysFromPlanned } from "../utils/schedule";
import { painLabel } from "../utils/painLabel";

/** Name of the wash keyframes, shared with styles.css. */

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

  /**
   * "Planned for 2026-08-26 · 2 days later", or nothing. The date is the stored
   * ISO string, matching `dateLabel` above rather than inventing a second
   * format on the same row.
   *
   * A measurement, never a verdict — and the grammar is doing that work, not a
   * euphemism. English separates the adjective from the comparative: "2 days
   * late" is a STATUS against an obligation you failed, while "2 days later" is
   * a DISTANCE from a reference. The second is what the app actually knows.
   *
   * This follows the #LanguageMatters practice — the Diabetes Australia, NHS
   * England and English Advisory Group position statements — whose finding is
   * that language which blames and shames does more harm than it does
   * motivating, and which is why that whole field moved from "compliance" to
   * "adherence" and is now questioning "adherence" too. It matters more than
   * usual here because people judge their own timing far more harshly than
   * their clinicians do: in one study 55% of patients counted a six-hour delay
   * as a missed dose, against a single physician who agreed. The app does not
   * need to supply the judgement.
   *
   * An earlier version said "taken 2 days after", avoiding "early" as well as
   * "late". That was over-applied: "early" carries no fault, and those same
   * position statements ask for language that is *clear* as well as
   * non-judgemental — "after" needs the line above it to mean anything, where
   * "later" stands on its own.
   */
  const plannedLabel = (() => {
    if (!shot.plannedFor) return null;
    const delta = daysFromPlanned(shot);
    const on = `Planned for ${shot.plannedFor}`;
    if (delta === null) return on;
    if (delta === 0) return `${on} · taken that day`;
    const days = Math.abs(delta) === 1 ? "1 day" : `${Math.abs(delta)} days`;
    return `${on} · ${days} ${delta > 0 ? "later" : "earlier"}`;
  })();
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
        {shot.pain !== undefined && (
          <div className="shot-list-item__pill">
            Pain: {painLabel(shot.pain)}
          </div>
        )}
      </header>

      <div className="shot-list-item__meta">
        {shot.doseMg !== undefined && <span> Dose: {shot.doseMg} mg</span>}
        {shot.injectionSite && <span> • Site: {shot.injectionSite}</span>}
        {shot.injectionSitePosition && (
          <span> • Position: {shot.injectionSitePosition}</span>
        )}
        {shot.testosteroneEster && (
          <span> • Type: {shot.testosteroneEster}</span>
        )}
        {shot.carrierOil && <span> • Oil: {shot.carrierOil}</span>}
        {shot.mood && <span> • Mood: {shot.mood}</span>}
      </div>

      {plannedLabel && (
        <p className="shot-list-item__planned">{plannedLabel}</p>
      )}

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
