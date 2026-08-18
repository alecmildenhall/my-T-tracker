// src/components/Settings.tsx
import React, { useRef } from "react";
import { useShotsContext } from "../context/ShotsContext";
import { useProfileContext } from "../context/ProfileContext";
import { ManageValues } from "./ManageValues";
import { DataManagement } from "./DataManagement";
import { JourneySettings } from "./JourneySettings";

// No `onBack` prop, and no back button. It was kept "for any caller that opens
// Settings as a sub-screen", and in the year since the tab bar landed no such
// caller appeared — leaving a branch nobody rendered and a stylesheet block
// nothing used. There are two ways out of Settings already: tap another
// destination in the tab bar, or swipe right. A third, in chrome that only
// exists here, would be the odd one out on every screen.
export const Settings: React.FC = () => {
  // Sourced from context rather than drilled through App, which passed these
  // four props purely to reach the panels below.
  const { shots, renameValue, clearValue, replaceAll } = useShotsContext();
  const { profile, replaceProfile } = useProfileContext();
  /** Where JourneySettings sends focus when its "Remove start date" control
   *  removes itself. A heading, not the date field — see JourneySettings. */
  const journeyHeadingRef = useRef<HTMLHeadingElement>(null);

  return (
    <section className="settings">
      {/* No "Settings" heading of its own: the app header already titles the
          view, and repeating it would put two identical headings on the page. */}
      <div className="settings-section">
        <h2
          className="settings-section__title"
          ref={journeyHeadingRef}
          tabIndex={-1}
        >
          Your journey
        </h2>
        <p className="settings-section__desc">
          Optionally add when you started T and how you&apos;d like to be
          addressed, so the app can celebrate your milestones. Both are optional
          and stay on this device.
        </p>
        <JourneySettings headingRef={journeyHeadingRef} />
      </div>

      <div className="settings-section">
        <h2 className="settings-section__title">Saved values</h2>
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
        <h2 className="settings-section__title">Your data</h2>
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
