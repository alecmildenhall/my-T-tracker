// src/components/ShotListItem.tsx
import React from "react";
import type { ShotEntry } from "../types/shot";
import { WASH_ANIMATION } from "../utils/wash";
import { formatTimeForDisplay } from "../utils/datetime";
import { daysFromPlanned } from "../utils/schedule";
import { painLabel } from "../utils/painLabel";
import { offDaysLabel } from "../utils/offDaysLabel";
import { settledSummary } from "../utils/soreness";
import { isOffDaysPattern, isPainLevel, isSorenessDuration } from "../types/shot";

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

  /**
   * The optional details, as a list joined by a separator — NOT as fragments
   * that each carry their own leading " • ".
   *
   * They did, and the separator then had nothing to separate from whenever the
   * first field was absent: a shot logged with an off-days answer and no dose
   * rendered "• Off days: Right after the previous shot", bullet first. Found by
   * using the app rather than reading it, and the fast path makes it the common
   * case rather than a rare one — off days is a single tap where dose and site
   * are typing.
   *
   * The bug predates this field (`mood` had the identical shape), which is the
   * argument for fixing the structure rather than this one call site: a
   * separator belongs BETWEEN items, so the next optional field added here
   * cannot reintroduce it.
   *
   * `isOffDaysPattern` is a guard, not a presence check — storage is lenient, so
   * an unrecognised value reaches here and an unchecked lookup would render
   * "Off days: " with nothing after it, exactly as pain once did.
   */
  const details: string[] = [];
  if (shot.doseMg !== undefined) details.push(`Dose: ${shot.doseMg} mg`);
  if (shot.injectionSite) details.push(`Site: ${shot.injectionSite}`);
  if (shot.injectionSitePosition) {
    details.push(`Position: ${shot.injectionSitePosition}`);
  }
  if (shot.testosteroneEster) details.push(`Type: ${shot.testosteroneEster}`);
  if (shot.carrierOil) details.push(`Oil: ${shot.carrierOil}`);
  if (isOffDaysPattern(shot.offDays)) {
    details.push(`Off days: ${offDaysLabel(shot.offDays)}`);
  }

  /**
   * How the site settled gets its OWN line, not a `details` entry.
   *
   * Everything in `details` is a fact recorded when the shot was logged; this
   * one was answered days later, about how the shot turned out. Reading it in
   * the same bullet run as "Dose: 100 mg" flattens that difference, and it is
   * the line someone scanning for a bad site is actually looking for.
   */
  const settled = settledSummary(
    isSorenessDuration(shot.afterSoreness) ? shot.afterSoreness : undefined,
    typeof shot.afterLump === "boolean" ? shot.afterLump : undefined,
  );

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
        {/* A GUARD, not a presence check — which is what the `typeof
            shot.painScore === "number"` this replaced actually was. Storage is
            deliberately lenient (`sanitizeShots` vets only id and date), so an
            unrecognised level reaches here and `painLabel` looked it up
            unchecked: the row rendered a pill reading "Pain: " with nothing
            after it. Measured before this. */}
        {isPainLevel(shot.pain) && (
          <div className="shot-list-item__pill">
            Pain: {painLabel(shot.pain)}
          </div>
        )}
      </header>

      {details.length > 0 && (
        <div className="shot-list-item__meta">{details.join(" • ")}</div>
      )}

      {settled && <p className="shot-list-item__settled">{settled}</p>}

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
