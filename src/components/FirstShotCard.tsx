// src/components/FirstShotCard.tsx
// The empty state above "Log a shot": two optional questions, and a way out for
// someone who came back to restore a backup.
//
// Not a setup wizard, deliberately. The roadmap's rule is a "short, skippable"
// pointer rather than a wall, and general onboarding advice — which mostly comes
// from growth teams optimising subscription conversion — does not transfer to a
// local-only tracker with nothing to convert to. Most people should be able to
// learn the interface by using it.
//
// It has no dismiss control, and that is the point: it is gone the moment there
// is a shot to show, which is the very thing it is asking you to prepare for.
// Nothing to dismiss, and no "dismissed" flag to store — the same derive-don't-
// store reasoning the soreness card uses. It also means an IMPORT clears it for
// free, since restoring a backup creates shots.
import React, { useState } from "react";
import { useProfileContext } from "../context/ProfileContext";
import { WEEKDAYS, isWeekday, weekdayLabel } from "../utils/weekday";
import { isWeeklyMultiple } from "../utils/schedule";
import {
  isValidIntervalDays,
  MIN_INTERVAL_DAYS,
  MAX_INTERVAL_DAYS,
} from "../types/profile";

/** The two cadences almost everyone is on. */
const QUICK_PICKS = [7, 14];

interface FirstShotCardProps {
  /** Takes them to Settings → Your data, where the import lives. */
  onGoToSettings: () => void;
}

export const FirstShotCard: React.FC<FirstShotCardProps> = ({
  onGoToSettings,
}) => {
  const { profile, setShotDay, setIntervalDays } = useProfileContext();

  /**
   * The free-entry box holds a draft and commits on blur, exactly as Settings
   * does — the chips beside it commit immediately because a chip IS a complete
   * value, but a typed number is not until you stop typing.
   *
   * Committing per keystroke made several intervals impossible to enter. Typing
   * "140" committed 14 on the second keystroke, at which point the box blanked
   * itself (its value was derived from the profile and hid the two quick-pick
   * numbers), so the third keystroke started from empty and produced "0" —
   * invalid, clearing the interval outright. Transiently-valid keystrokes were
   * worse than useless too: a lone "1" flipped the cadence to non-weekly, so
   * the shot-day select disabled and the notice flashed mid-word.
   */
  const [otherDraft, setOtherDraft] = useState(
    profile.intervalDays !== undefined &&
      !QUICK_PICKS.includes(profile.intervalDays)
      ? String(profile.intervalDays)
      : "",
  );
  const commitOther = () => {
    const trimmed = otherDraft.trim();
    if (trimmed === "") {
      // Only clear an interval this box owns — blanking it must not wipe a
      // choice made with the chips.
      if (
        profile.intervalDays !== undefined &&
        !QUICK_PICKS.includes(profile.intervalDays)
      ) {
        setIntervalDays(undefined);
      }
      return;
    }
    const parsed = Number(trimmed);
    if (isValidIntervalDays(parsed)) {
      setIntervalDays(parsed);
      return;
    }
    // Put the box back to what is actually saved, exactly as Settings does.
    // Blanking it instead left the card showing no interval while the profile
    // still held one — and planned dates kept being computed from the value the
    // screen said was gone.
    setOtherDraft(
      profile.intervalDays !== undefined &&
        !QUICK_PICKS.includes(profile.intervalDays)
        ? String(profile.intervalDays)
        : "",
    );
  };

  const pickQuick = (days: number) => {
    setOtherDraft("");
    setIntervalDays(profile.intervalDays === days ? undefined : days);
  };

  const shotDayUnavailable =
    isValidIntervalDays(profile.intervalDays) &&
    !isWeeklyMultiple(profile.intervalDays);

  return (
    <section className="first-shot-card">
      <h2 className="first-shot-card__title">Before your first shot</h2>

      <div className="form-column">
        <span className="first-shot-card__label">
          How often do you take it?
        </span>
        <div
          className="suggestion-chips"
          role="group"
          aria-label="How often you take your shot"
        >
          {QUICK_PICKS.map((days) => (
            <button
              key={days}
              type="button"
              className={`chip${profile.intervalDays === days ? " chip--active" : ""}`}
              aria-current={profile.intervalDays === days ? true : undefined}
              onClick={() => pickQuick(days)}
            >
              {days === 7 ? "Weekly" : "Fortnightly"}
            </button>
          ))}
          <label className="first-shot-card__other">
            <span className="visually-hidden">Or every how many days?</span>
            <input
              type="number"
              min={MIN_INTERVAL_DAYS}
              max={MAX_INTERVAL_DAYS}
              step={1}
              inputMode="numeric"
              placeholder="Every ___ days"
              value={otherDraft}
              onChange={(e) => setOtherDraft(e.target.value)}
              onBlur={commitOther}
            />
          </label>
        </div>
      </div>

      {shotDayUnavailable && (
        <p className="field-hint field-hint--notice">
          No shot day with a non-weekly interval — a weekday can’t describe
          every {profile.intervalDays} days. Your gaps are still tracked.
        </p>
      )}

      <label className="form-column">
        Which day do you usually take it?
        <select
          value={profile.shotDay ?? ""}
          disabled={shotDayUnavailable}
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
        Both optional — fill them in and you can track how on time your shots
        are. Change them any time in Settings.
      </p>

      {/* A returning user and a new one land on the same empty screen needing
          opposite things, and this one is protective rather than convenient:
          import REPLACES rather than merges, so logging a shot first and
          importing afterwards throws that shot away. */}
      <p className="first-shot-card__restore">
        Returning with a backup?{" "}
        <button type="button" className="link-button" onClick={onGoToSettings}>
          Restore it in Settings →
        </button>
      </p>
    </section>
  );
};
