// src/components/Settings.tsx
import React, { useEffect, useRef } from "react";
import { handOffFocus } from "../utils/focus";
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
/** A section Settings can be asked to land on, rather than at its own top. */
export type SettingsLanding = "data";

interface SettingsProps {
  /** Set when the caller navigated here to reach a particular section — today
   *  only the first-run card's "Restore it in Settings", which otherwise
   *  arrived at the top of the page with the import control two panels below
   *  the fold and no sign of where to go next. */
  landOn?: SettingsLanding | null;
  /** Fired once the landing has happened, so the caller can retire the request.
   *  It is a ONE-SHOT: left set, every later return to Settings would yank the
   *  page down to Your data for someone who came here to change their name. */
  onLanded?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ landOn, onLanded }) => {
  // Sourced from context rather than drilled through App, which passed these
  // four props purely to reach the panels below.
  const { shots, renameValue, clearValue, replaceAll } = useShotsContext();
  const { profile, replaceProfile } = useProfileContext();
  /** Where JourneySettings sends focus when its "Remove start date" control
   *  removes itself. A heading, not the date field — see JourneySettings. */
  const journeyHeadingRef = useRef<HTMLHeadingElement>(null);
  const dataHeadingRef = useRef<HTMLHeadingElement>(null);

  // Focus the section's HEADING rather than scrolling to it. Scrolling alone
  // moves the page for a sighted user and tells a screen-reader user nothing —
  // they would still be at the top of the document with the next Tab starting
  // from the beginning. Focusing the heading does both: it names the region
  // that was asked for, and the browser brings it into view. This is the same
  // move JourneySettings makes when "Remove start date" removes itself, and the
  // WAI-ARIA APG pattern for sending someone to a section.
  //
  // `handOffFocus`, never a bare `.focus()` — it verifies the element actually
  // took focus instead of assuming, which is how focus reached <body> from
  // three different controls in slice B.
  useEffect(() => {
    if (landOn !== "data") return;
    // Then position it. Focus alone scrolls the MINIMUM distance needed, which
    // parks a heading at the very bottom edge of the viewport with its own
    // section still below the fold — arriving at the name of the thing you
    // wanted rather than at the thing. `block: "start"` puts it at the top with
    // the export and import controls beneath it.
    handOffFocus(dataHeadingRef)?.scrollIntoView({ block: "start" });
    onLanded?.();
    // `onLanded` is deliberately not a dependency: it is a fresh closure every
    // render, and including it would re-run this on every parent render — which
    // is exactly the "yanks you back to Your data" behaviour the one-shot
    // exists to prevent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landOn]);

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
        {/* Says "optional" ONCE, for the panel — it used to say it twice here
            and again under two of the four fields below. */}
        <p className="settings-section__desc">
          Your name, when you started T, and how often you take it. All
          optional, and all stored only on this device.
        </p>
        <JourneySettings headingRef={journeyHeadingRef} />
      </div>

      <div className="settings-section">
        <h2 className="settings-section__title">Saved values</h2>
        <p className="settings-section__desc">
          Rename or remove the values suggested while logging. Changes update
          your past entries too.
        </p>
        <ManageValues
          shots={shots}
          onRenameValue={renameValue}
          onClearValue={clearValue}
        />
      </div>

      <div className="settings-section">
        {/* tabIndex={-1} so it can take focus programmatically without joining
            the tab order — a heading is not a control. */}
        <h2
          className="settings-section__title"
          ref={dataHeadingRef}
          tabIndex={-1}
        >
          Your data
        </h2>
        <p className="settings-section__desc">
          Export a backup to move or restore your entries, or a CSV to share
          with a provider. Importing a backup replaces what&apos;s on this
          device.
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
