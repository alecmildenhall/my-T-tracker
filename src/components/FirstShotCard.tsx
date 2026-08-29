// src/components/FirstShotCard.tsx
// The empty state above "Log a shot": the four optional things worth having
// before there is any history, and a way out for someone who came back to
// restore a backup.
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
import { toShotDate, shotDateRange } from "../utils/civilDate";
import {
  isValidIntervalDays,
  MIN_INTERVAL_DAYS,
  MAX_INTERVAL_DAYS,
} from "../types/profile";

/**
 * The cadences worth a shortcut.
 *
 * Fortnightly is here on evidence rather than taste. UCSF's masculinising
 * therapy guidance and the gender-affirming clinics describe testosterone as
 * taken "every week or every other week", with intramuscular routinely 100–200mg
 * every 1–2 weeks and "200mg once every two weeks" named as a common primary-care
 * default. Weekly is more common, especially subcutaneous, but every-other-week
 * is a mainstream protocol rather than an edge case — dropping it would cost a
 * chunk of users two taps for no gain.
 */
const QUICK_PICKS = [
  { label: "Weekly", days: 7 },
  { label: "Fortnightly", days: 14 },
];

interface FirstShotCardProps {
  /** Takes them to Settings, where all of this lives permanently. */
  onGoToSettings: () => void;
}

export const FirstShotCard: React.FC<FirstShotCardProps> = ({
  onGoToSettings,
}) => {
  const {
    profile,
    setShotDay,
    setIntervalDays,
    setPreferredName,
    setStartDate,
  } = useProfileContext();
  const dateRange = shotDateRange();

  /**
   * ONE draft for the interval, which both the chips and the box write to.
   *
   * They used to be separate — the box kept its own draft and blanked itself
   * whenever a chip's value was stored — and the two then disagreed in both
   * directions: tapping Weekly left the box empty instead of showing 7, and
   * typing 10 left Weekly still lit, because the chip read the saved profile
   * while the box had not committed yet. One value, one meaning: the chips fill
   * the box, and what is in the box decides which chip is lit.
   */
  const [intervalDraft, setIntervalDraft] = useState(
    profile.intervalDays !== undefined ? String(profile.intervalDays) : "",
  );

  const commitInterval = () => {
    const trimmed = intervalDraft.trim();
    if (trimmed === "") {
      setIntervalDays(undefined);
      return;
    }
    const parsed = Number(trimmed);
    if (isValidIntervalDays(parsed)) {
      setIntervalDays(parsed);
    } else {
      // Put the box back to what is actually saved, so the screen and the
      // profile never disagree.
      setIntervalDraft(
        profile.intervalDays !== undefined ? String(profile.intervalDays) : "",
      );
    }
  };

  /** Committed on blur, like the same field in Settings: a date input reports a
   *  value only once all three segments are filled, and Chromium auto-fills the
   *  ones you have not typed — so committing per keystroke walks a year through
   *  0002, 0020, 0202 before it arrives. */
  const [startDraft, setStartDraft] = useState(profile.startDate ?? "");

  const shotDayUnavailable =
    isValidIntervalDays(profile.intervalDays) &&
    !isWeeklyMultiple(profile.intervalDays);

  return (
    <section className="first-shot-card">
      <h2 className="first-shot-card__title">Before your first shot</h2>

      <label className="form-column">
        What should the app call you?
        <input
          type="text"
          value={profile.preferredName ?? ""}
          onChange={(e) => setPreferredName(e.target.value || undefined)}
          placeholder="Your name, or anything you like"
          autoComplete="off"
        />
      </label>

      <label className="form-column">
        When did you start T?
        <input
          type="date"
          value={startDraft}
          min={dateRange.min}
          max={dateRange.max}
          onChange={(e) => setStartDraft(e.target.value)}
          onBlur={() => {
            if (startDraft.trim() === "") {
              setStartDate(undefined);
            } else if (toShotDate(startDraft)) {
              setStartDate(startDraft);
            } else {
              setStartDraft(profile.startDate ?? "");
            }
          }}
        />
      </label>

      <div className="form-column">
        <span className="first-shot-card__label">
          How often do you take it?
        </span>
        <div
          className="suggestion-chips"
          role="group"
          aria-label="How often you take your shot"
        >
          {QUICK_PICKS.map(({ label, days }) => (
            <button
              key={days}
              type="button"
              className={`chip${intervalDraft === String(days) ? " chip--active" : ""}`}
              aria-current={intervalDraft === String(days) ? true : undefined}
              onClick={() => {
                setIntervalDraft(String(days));
                setIntervalDays(days);
              }}
            >
              {label}
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
              value={intervalDraft}
              onChange={(e) => setIntervalDraft(e.target.value)}
              onBlur={commitInterval}
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
        All optional, and all editable any time in Settings. Fill in how often
        and which day, and you can track how on time your shots are.
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
