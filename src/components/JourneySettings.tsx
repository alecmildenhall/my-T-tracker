// src/components/JourneySettings.tsx
// Settings → "Your journey": the optional T start date and preferred name that
// power milestone messages. Both are opt-in, local-only, and clearing a field
// removes it entirely.
import React, { useState } from "react";
import { useProfileContext } from "../context/ProfileContext";
import { WEEKDAYS, isWeekday, weekdayLabel } from "../utils/weekday";
import { isRealDate } from "../utils/civilDate";

export const JourneySettings: React.FC = () => {
  const { profile, setStartDate, setPreferredName, setShotDay } =
    useProfileContext();

  // What the date field is SHOWING, which is not the same as what is saved.
  //
  // The two must be separate, and binding them straight together made the field
  // unusable by keyboard. A date input reports a value only when all three
  // segments are filled, and Chromium auto-fills the ones you have not typed —
  // so typing the year of 2021 walks through 0002, 0020, 0202 before it arrives.
  // Committing every keystroke meant the first digit of a partial date wrote
  // `undefined`, the controlled `value` snapped back to "", and the whole field
  // blanked — taking an already-saved date with it. Measured in a browser: the
  // first digit of the MONTH cleared a stored 2020-01-01, and the year could not
  // be typed at all.
  //
  // So the draft is local and the profile is written only on a complete, real
  // date (or a cleared field). Same shape as ShotForm, which holds a raw string
  // and validates at submit.
  const [dateDraft, setDateDraft] = useState(profile.startDate ?? "");
  // Follow the profile when it changes from OUTSIDE this field — a backup import
  // replaces the whole profile — without clobbering what is being typed.
  // Adjusted during render, React's documented pattern for state that follows
  // changing props; the same shape HistoryView uses for its search reset.
  const [lastSaved, setLastSaved] = useState(profile.startDate);
  if (profile.startDate !== lastSaved) {
    setLastSaved(profile.startDate);
    setDateDraft(profile.startDate ?? "");
  }

  return (
    <div className="journey-settings">
      <label className="form-column">
        Testosterone start date
        <input
          type="date"
          value={dateDraft}
          // Deliberately UNBOUNDED, unlike the log sheet's date. Any real
          // calendar date is accepted: a start date is a fact about someone's
          // life that they are reporting, and we have no standing to tell them
          // it is too long ago or too far ahead. Future dates are an explicitly
          // supported case (planning to start later; milestones just don't begin
          // until the date arrives), and a wrong one announces itself in the
          // greeting immediately rather than hiding in a list — which is why the
          // shot date's typo argument does not carry over.
          onChange={(e) => {
            const next = e.target.value;
            setDateDraft(next);
            // Only a complete, real date is saved. Anything else is a value in
            // transit and leaves what is stored alone.
            //
            // NOTHING here deletes a start date, and neither does onBlur. An
            // empty date input carries two meanings it cannot separate — "I
            // cleared this" and "I am retyping and the segments are incomplete"
            // — and both report "". An earlier version resolved that by waiting
            // for blur, which does not separate the meanings at all; it just
            // picks one, and picks destructively.
            //
            // Measured in Chromium, the ambiguity happens to resolve itself:
            // typing one digit of the month fires input with "", then the
            // browser restores the last complete value before blur ever runs.
            // That is a reason it does not happen, not a reason it cannot —
            // Firefox leaves the value empty — and the cost of being wrong is a
            // silently deleted start date with no undo.
            //
            // So removing is its own action, with its own control, below.
            if (isRealDate(next)) setStartDate(next);
          }}
          // Whatever is left half-typed goes back to what is actually stored,
          // rather than leaving the field showing a value nothing holds.
          onBlur={() => {
            if (!isRealDate(dateDraft)) setDateDraft(profile.startDate ?? "");
          }}
        />
      </label>
      {profile.startDate && (
        <button
          type="button"
          className="link-button"
          // The field empties itself: the profile changes, so the sync above
          // pulls the draft to "". Setting it here as well was redundant, and a
          // mutation check caught that no test could tell the difference.
          onClick={() => setStartDate(undefined)}
        >
          Remove start date
        </button>
      )}
      <p className="field-hint">
        Used to celebrate milestones, like your first year on T. If you started
        before installing the app, enter that date — it still counts. Planning to
        start later? A future date works too.
      </p>

      <label className="form-column">
        Shot day
        <select
          value={profile.shotDay ?? ""}
          onChange={(e) =>
            setShotDay(isWeekday(e.target.value) ? e.target.value : undefined)
          }
        >
          <option value="">No shot day</option>
          {WEEKDAYS.map((day) => (
            <option key={day} value={day}>
              {weekdayLabel(day)}
            </option>
          ))}
        </select>
      </label>
      <p className="field-hint">
        Pick the day you usually take your shot for a little "Happy shot day!"
        greeting. Leave it on "No shot day" to skip.
      </p>

      <label className="form-column">
        Preferred name
        <input
          type="text"
          value={profile.preferredName ?? ""}
          onChange={(e) => setPreferredName(e.target.value || undefined)}
          placeholder="e.g. Lou"
          autoComplete="off"
        />
      </label>
      <p className="field-hint">
        Only used to personalize milestone messages, and only ever stored on this
        device. Leave blank to skip.
      </p>
    </div>
  );
};
