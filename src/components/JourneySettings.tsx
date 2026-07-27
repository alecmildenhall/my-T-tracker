// src/components/JourneySettings.tsx
// Settings → "Your journey": the optional T start date and preferred name that
// power milestone messages. Both are opt-in, local-only, and clearing a field
// removes it entirely.
import React from "react";
import { useProfileContext } from "../context/ProfileContext";
import { WEEKDAYS, isWeekday, weekdayLabel } from "../utils/weekday";

export const JourneySettings: React.FC = () => {
  const { profile, setStartDate, setPreferredName, setShotDay } =
    useProfileContext();

  return (
    <div className="journey-settings">
      <label className="form-column">
        Testosterone start date
        <input
          type="date"
          value={profile.startDate ?? ""}
          // Future dates are allowed on purpose — you might be planning to start
          // T later. Milestones simply don't begin until the date arrives.
          onChange={(e) => setStartDate(e.target.value || undefined)}
        />
      </label>
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
