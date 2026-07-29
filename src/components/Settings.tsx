// src/components/Settings.tsx
import React from "react";
import { useShotsContext } from "../context/ShotsContext";
import { useProfileContext } from "../context/ProfileContext";
import { ManageValues } from "./ManageValues";
import { DataManagement } from "./DataManagement";
import { JourneySettings } from "./JourneySettings";

interface SettingsProps {
  /** Optional escape hatch. Unused once Settings is a bottom-nav destination —
   *  the tab bar is always on screen, so a back button would be redundant
   *  chrome — but kept for any caller that opens Settings as a sub-screen. */
  onBack?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  // Sourced from context rather than drilled through App, which passed these
  // four props purely to reach the panels below.
  const { shots, renameValue, clearValue, replaceAll } = useShotsContext();
  const { profile, replaceProfile } = useProfileContext();

  return (
    <section className="settings">
      {/* No "Settings" heading of its own: the app header already titles the
          view, and repeating it would put two identical headings on the page. */}
      {onBack && (
        <div className="settings-header">
          <button type="button" className="secondary-button" onClick={onBack}>
            ← Back
          </button>
        </div>
      )}

      <div className="settings-section">
        <h3 className="settings-section__title">Your journey</h3>
        <p className="settings-section__desc">
          Optionally add when you started T and how you&apos;d like to be
          addressed, so the app can celebrate your milestones. Both are optional
          and stay on this device.
        </p>
        <JourneySettings />
      </div>

      <div className="settings-section">
        <h3 className="settings-section__title">Saved values</h3>
        <p className="settings-section__desc">
          Rename or remove the values suggested while logging. Changes update your
          past entries too.
        </p>
        <ManageValues
          shots={shots}
          onRenameValue={renameValue}
          onClearValue={clearValue}
        />
      </div>

      <div className="settings-section">
        <h3 className="settings-section__title">Your data</h3>
        <p className="settings-section__desc">
          Export a backup to move or restore your entries, or a CSV to share with a
          provider. Importing a backup replaces what&apos;s on this device.
        </p>
        <DataManagement
          shots={shots}
          onReplaceAll={replaceAll}
          profile={profile}
          onReplaceProfile={replaceProfile}
        />
      </div>
    </section>
  );
};
