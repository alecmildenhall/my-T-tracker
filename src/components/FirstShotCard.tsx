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
import React, { useEffect, useRef, useState } from "react";
import { useProfileContext } from "../context/ProfileContext";
import { WEEKDAYS, isWeekday, weekdayLabel } from "../utils/weekday";
import { isWeeklyMultiple } from "../utils/schedule";
import { handOffFocus } from "../utils/focus";
import { isRealDate } from "../utils/civilDate";
import {
  isValidIntervalDays,
  MIN_INTERVAL_DAYS,
  MAX_INTERVAL_DAYS,
} from "../types/profile";

/**
 * The cadences worth a shortcut, labelled by their span rather than by a name.
 *
 * "Fortnightly" is British and lands blankly on a lot of readers; "biweekly" is
 * worse, because it genuinely means both "every two weeks" and "twice a week"
 * and the dictionaries record both. Numbers are unambiguous in every dialect,
 * and reading "1 week / 2 weeks / 12 weeks" as a set makes the axis obvious at
 * a glance in a way "Weekly / Fortnightly" does not.
 *
 * All three are on evidence:
 *   - 7 — weekly, the most common, especially subcutaneous.
 *   - 14 — every other week. UCSF's masculinising guidance and the clinics
 *     describe testosterone as "every week or every other week", with
 *     intramuscular routinely 100–200mg every 1–2 weeks and "200mg once every
 *     two weeks" a common primary-care default.
 *   - 84 — testosterone undecanoate (Nebido, Aveed). Nebido is 12-weekly after
 *     loading; the measured optimal interval in hypogonadal and transgender men
 *     has a median of 12.0 weeks. Someone on this injects four or five times a
 *     year, so typing 84 is a thing they would otherwise do rarely and get
 *     wrong.
 *
 * Every one is a multiple of 7, so all three keep the weekday grid working.
 * Twice-weekly is the notable absence and cannot be expressed at all — it is
 * every 3.5 days, and the interval is whole days. See the roadmap.
 */
const QUICK_PICKS = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "12 weeks", days: 84 },
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
      // Guarded like the branch below: setIntervalDays also clears the schedule
      // anchor, and this commit runs from an effect cleanup — so every
      // navigation away wrote the profile, and on a quota-exhausted device
      // raised the storage-failure banner for something nobody edited.
      if (profile.intervalDays !== undefined) setIntervalDays(undefined);
      return;
    }
    const parsed = Number(trimmed);
    if (isValidIntervalDays(parsed)) {
      // Only on a real change — see JourneySettings: setIntervalDays clears the
      // schedule anchor, so an idle blur would discard it.
      if (parsed !== profile.intervalDays) setIntervalDays(parsed);
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

  // Both drafts here need the same escape hatches the Settings date field has:
  // blur must not be the only commit, because on a phone you can type a value
  // and switch apps without ever blurring, and silent loss is the failure this
  // app treats as severe.
  const commitAllRef = useRef(() => {});
  useEffect(() => {
    commitAllRef.current = () => {
      commitInterval();
      if (startDraft.trim() !== "" && isRealDate(startDraft)) {
        setStartDate(startDraft);
      }
    };
  });
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") commitAllRef.current();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      commitAllRef.current();
    };
  }, []);

  /**
   * Where focus goes when the shot-day select disables under it.
   *
   * The interval box sits immediately before the select in tab order, and its
   * blur commit is what can disable that select — so tabbing out of the box
   * after typing a non-weekly interval moves focus INTO the select, which the
   * re-render then disables, and the browser blurs a disabled element onto
   * <body>. Same class as the nine hand-off defects in slice B, and invisible
   * to jsdom. Settings escapes it only by accident, because three chips sit
   * between its input and its select.
   */
  const intervalRef = useRef<HTMLInputElement>(null);
  const shotDaySelectRef = useRef<HTMLSelectElement>(null);

  const shotDayUnavailable =
    isValidIntervalDays(profile.intervalDays) &&
    !isWeeklyMultiple(profile.intervalDays);

  // Only on the false -> true EDGE. Without the ref this also ran on MOUNT,
  // where `document.activeElement` is `<body>` by definition — so anyone with a
  // non-weekly interval already saved and no shots yet had focus yanked into
  // the number box the instant Home painted, scrolling the page and raising a
  // numeric keyboard nobody asked for.
  const wasUnavailable = useRef(shotDayUnavailable);
  useEffect(() => {
    const justDisabled = shotDayUnavailable && !wasUnavailable.current;
    wasUnavailable.current = shotDayUnavailable;
    if (!justDisabled) return;
    const active = document.activeElement;
    if (active === document.body || active === shotDaySelectRef.current) {
      handOffFocus(intervalRef);
    }
  }, [shotDayUnavailable]);

  return (
    <section className="first-shot-card">
      <h2 className="first-shot-card__title">Before your first shot</h2>
      {/* The "it's all optional" line leads, rather than closing the card.
          Marking every field individually is what you do when SOME are
          required — here none are, so one sentence at the top says it once for
          all four, and there is nothing left for a footer to repeat. It also
          has to be read BEFORE the questions to do its job: a reassurance
          underneath four fields arrives after the moment someone decides
          whether they are obliged to answer them. */}
      <p className="first-shot-card__intro">
        All optional — revisit anytime in Settings.
      </p>

      <div className="first-shot-card__field">
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
      </div>

      <div className="first-shot-card__field">
        {/* `htmlFor` rather than a wrapping <label>, so the hint can sit between
            the question and the control without joining the field's accessible
            name — text inside a <label> becomes part of it, which would rename
            this field to "When did you start T? Marks milestones along the
            way…". The log sheet's Date field already carries this restructure,
            for the same reason. */}
        <label htmlFor="first-shot-start">When did you start T?</label>
        <p className="field-hint" id="first-shot-start-hint">
          Marks milestones, like your first year on T.
        </p>
        <div className="form-column">
          {/* Deliberately UNBOUNDED, and validated with `isRealDate` rather than
              `toShotDate` — matching the same field in Settings. This is a fact
              about someone's life, not a shot: civilDate.ts's own header says the
              shot range must not be applied here, and the README supports setting
              a future date to plan ahead. Bounding it here meant one field with
              two boundaries, where a start date more than a year out was silently
              reverted in this card and accepted in Settings. */}
          <input
            id="first-shot-start"
            type="date"
            value={startDraft}
            aria-describedby="first-shot-start-hint"
            onChange={(e) => setStartDraft(e.target.value)}
            onBlur={() => {
              if (startDraft.trim() === "") {
                setStartDate(undefined);
              } else if (isRealDate(startDraft)) {
                setStartDate(startDraft);
              } else {
                setStartDraft(profile.startDate ?? "");
              }
            }}
          />
        </div>
      </div>

      <div className="first-shot-card__field">
        <span className="first-shot-card__label">
          How often do you take it?
        </span>
        {/* The pair's hint, under the FIRST of the two questions it describes
            rather than trailing the second — it says why you would answer
            either, so it has to arrive before you meet them. */}
        <p className="field-hint" id="first-shot-cadence-hint">
          Fill these in and you can track how on time your shots are, and see
          how that lines up with how you’ve been feeling.
        </p>
        <div
          className="suggestion-chips suggestion-chips--tight"
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
                if (days !== profile.intervalDays) setIntervalDays(days);
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
              ref={intervalRef}
              value={intervalDraft}
              onChange={(e) => setIntervalDraft(e.target.value)}
              onBlur={commitInterval}
              aria-describedby="first-shot-cadence-hint"
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

      <div className="first-shot-card__field">
        <label className="form-column">
          Which day do you usually take it?
          <select
            ref={shotDaySelectRef}
            value={profile.shotDay ?? ""}
            disabled={shotDayUnavailable}
            aria-describedby="first-shot-cadence-hint"
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
      </div>

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
