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
import React from "react";
import { useProfileContext } from "../context/ProfileContext";
import { WEEKDAYS, isWeekday, weekdayLabel } from "../utils/weekday";
import { isWeeklyMultiple } from "../utils/schedule";
import {
  isValidIntervalDays,
  MIN_INTERVAL_DAYS,
  MAX_INTERVAL_DAYS,
} from "../types/profile";

interface FirstShotCardProps {
  /** Takes them to Settings → Your data, where the import lives. */
  onGoToSettings: () => void;
}

export const FirstShotCard: React.FC<FirstShotCardProps> = ({
  onGoToSettings,
}) => {
  const { profile, setShotDay, setIntervalDays } = useProfileContext();

  // No local draft here, unlike Settings: these are chips and a select, so every
  // change is a complete value. There is no half-typed state to protect.
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
          {[7, 14].map((days) => (
            <button
              key={days}
              type="button"
              className={`chip${profile.intervalDays === days ? " chip--active" : ""}`}
              aria-current={profile.intervalDays === days ? true : undefined}
              onClick={() =>
                setIntervalDays(
                  profile.intervalDays === days ? undefined : days,
                )
              }
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
              value={
                profile.intervalDays !== undefined &&
                profile.intervalDays !== 7 &&
                profile.intervalDays !== 14
                  ? String(profile.intervalDays)
                  : ""
              }
              onChange={(e) => {
                const parsed = Number(e.target.value.trim());
                setIntervalDays(
                  e.target.value.trim() !== "" && isValidIntervalDays(parsed)
                    ? parsed
                    : undefined,
                );
              }}
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
