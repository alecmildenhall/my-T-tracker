// src/components/JourneySettings.tsx
// Settings → "Your journey": the optional T start date and preferred name that
// power milestone messages. Both are opt-in, local-only, and clearing a field
// removes it entirely.
import React from "react";
import { useProfileContext } from "../context/ProfileContext";
import { todayLocalISO } from "../utils/datetime";

export const JourneySettings: React.FC = () => {
  const { profile, setStartDate, setPreferredName } = useProfileContext();

  return (
    <div className="journey-settings">
      <label className="form-column">
        Testosterone start date
        <input
          type="date"
          value={profile.startDate ?? ""}
          // No future start dates — you can't have started T tomorrow.
          max={todayLocalISO()}
          onChange={(e) => setStartDate(e.target.value || undefined)}
        />
      </label>
      <p className="field-hint">
        Used to celebrate milestones, like your first year on T. If you started
        before installing the app, enter that date — it still counts.
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
