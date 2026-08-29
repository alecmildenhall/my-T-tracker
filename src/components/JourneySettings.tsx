// src/components/JourneySettings.tsx
// Settings → "Your journey": the optional T start date and preferred name that
// power milestone messages. Both are opt-in, local-only, and clearing a field
// removes it entirely.
import React, { useEffect, useRef, useState } from "react";
import { useProfileContext } from "../context/ProfileContext";
import { WEEKDAYS, isWeekday, weekdayLabel } from "../utils/weekday";
import { isRealDate } from "../utils/civilDate";
import { isWeeklyMultiple } from "../utils/schedule";
import {
  isValidIntervalDays,
  MIN_INTERVAL_DAYS,
  MAX_INTERVAL_DAYS,
} from "../types/profile";
import { handOffFocus } from "../utils/focus";

/** Kept in step with the first-run card, which carries the reasoning. */
const COMMON_INTERVALS = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "12 weeks", days: 84 },
] as const;

interface JourneySettingsProps {
  /** The section heading above this panel, focused when "Remove start date"
   *  removes itself. Optional so the panel still renders standalone in tests. */
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
}

export const JourneySettings: React.FC<JourneySettingsProps> = ({
  headingRef,
}) => {
  const {
    profile,
    setStartDate,
    setPreferredName,
    setShotDay,
    setIntervalDays,
  } = useProfileContext();

  /** Like the date field above: what the box SHOWS, which is not what is saved.
   *  Committed on blur so a half-typed "1" of "14" never writes an interval,
   *  and so a cleared box means "no interval" rather than zero. */
  const [intervalDraft, setIntervalDraft] = useState(
    profile.intervalDays !== undefined ? String(profile.intervalDays) : "",
  );
  // Follow the profile when it changes from OUTSIDE this field — a backup import
  // replaces the whole profile — without clobbering what is being typed.
  // Adjusted during render, React's documented pattern for state that follows
  // changing props, and the same shape the start-date field below uses.
  const [lastSavedInterval, setLastSavedInterval] = useState(
    profile.intervalDays,
  );
  if (lastSavedInterval !== profile.intervalDays) {
    setLastSavedInterval(profile.intervalDays);
    setIntervalDraft(
      profile.intervalDays !== undefined ? String(profile.intervalDays) : "",
    );
  }

  const commitInterval = () => {
    const trimmed = intervalDraft.trim();
    if (trimmed === "") {
      // Guarded like the branch below — see FirstShotCard: this also clears the
      // anchor and runs from an effect cleanup, so an unguarded call wrote the
      // profile on every navigation away from Settings.
      if (profile.intervalDays !== undefined) setIntervalDays(undefined);
      return;
    }
    const parsed = Number(trimmed);
    if (isValidIntervalDays(parsed)) {
      // Only when it actually CHANGED. setIntervalDays clears the schedule
      // anchor — deliberately, since changing your cadence re-declares the
      // schedule — so committing unconditionally meant a no-op focus/blur, or
      // tapping the chip already lit, silently threw the frozen anchor away.
      // The next save then re-derived it from the earliest shot, which may have
      // moved, shifting the grid phase by up to 7 days on a fortnightly
      // schedule. Measured: focus + blur with no edit removed the anchor.
      if (parsed !== profile.intervalDays) setIntervalDays(parsed);
    } else {
      // Refuse rather than store something the schedule cannot use, and put the
      // field back to what is actually saved so the two never disagree.
      setIntervalDraft(
        profile.intervalDays !== undefined ? String(profile.intervalDays) : "",
      );
    }
  };

  /** Shot day is inert while a weekday cannot describe the cadence — the grid
   *  would walk across the week. Disabled, never cleared, so switching back to
   *  a weekly interval brings the saved day straight back. */
  const shotDayUnavailable =
    isValidIntervalDays(profile.intervalDays) &&
    !isWeeklyMultiple(profile.intervalDays);

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
  /** Where focus lands when "Remove start date" removes itself. */
  const dateFieldRef = useRef<HTMLInputElement>(null);

  // Blur is the ordinary commit, but it must not be the ONLY one. On a phone you
  // can open the field, spin the wheel to your start date, and then switch apps
  // or close the tab without ever tapping elsewhere — no blur, and the date is
  // silently dropped while the field looked filled in the whole time. Silent loss
  // is the failure this app treats as severe, so leaving and backgrounding both
  // commit as well.
  //
  // The cost, stated: a draft caught mid-keystroke can be a real date that was
  // never meant (`0202-03-15` on the way to 2021 — see the onChange note), and
  // backgrounding at exactly that moment would store it. That is the better half
  // of the trade. A wrongly stored date is on screen in the field and one edit
  // from fixed; a wrongly discarded one leaves nothing behind to notice.
  // Kept in refs so the listener below can subscribe ONCE and still read the
  // current values: re-subscribing per keystroke would run the cleanup — and
  // therefore the commit — on every render. Written in an effect rather than
  // during render, which is a side effect in render and what `react-hooks/refs`
  // refuses.
  const draftRef = useRef(dateDraft);
  const commitRef = useRef(setStartDate);
  useEffect(() => {
    draftRef.current = dateDraft;
    commitRef.current = setStartDate;
  });

  useEffect(() => {
    const commitIfReal = () => {
      if (isRealDate(draftRef.current)) commitRef.current(draftRef.current);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") commitIfReal();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      // Unmount too: changing tab destroys this panel, and on a phone that is a
      // likelier exit than blurring the field.
      commitIfReal();
    };
  }, []);

  // The interval box needs the same escape hatches, for the same reason and in
  // the same words: blur "must not be the ONLY one", because on a phone you can
  // type 14 and switch apps without ever blurring the field, and silent loss is
  // the failure this app treats as severe. It had none — identical shape to the
  // date field above, none of its protection.
  // Only the callback is held. The date field above also keeps a draft ref
  // because its `commitIfReal` reads the raw string; `commitInterval` closes
  // over its own draft, so a second ref here was written every render, read by
  // nothing, and looked like protection it was not providing.
  const commitIntervalRef = useRef(() => {});
  useEffect(() => {
    commitIntervalRef.current = commitInterval;
  });
  useEffect(() => {
    const commitIfUsable = () => commitIntervalRef.current();
    const onHide = () => {
      if (document.visibilityState === "hidden") commitIfUsable();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      commitIfUsable();
    };
  }, []);
  if (profile.startDate !== lastSaved) {
    setLastSaved(profile.startDate);
    setDateDraft(profile.startDate ?? "");
  }

  return (
    <div className="journey-settings">
      <label className="form-column">
        Preferred name
        <input
          type="text"
          value={profile.preferredName ?? ""}
          onChange={(e) => setPreferredName(e.target.value || undefined)}
          placeholder="e.g. Lou"
          autoComplete="off"
          aria-describedby="journey-name-hint"
        />
      </label>
      <p className="field-hint" id="journey-name-hint">
        Only used to say hello, in greetings and milestone messages.
      </p>

      <label className="form-column">
        Testosterone start date
        <input
          ref={dateFieldRef}
          type="date"
          value={dateDraft}
          aria-describedby="journey-start-hint"
          // Deliberately UNBOUNDED, unlike the log sheet's date. Any real
          // calendar date is accepted: a start date is a fact about someone's
          // life that they are reporting, and we have no standing to tell them
          // it is too long ago or too far ahead. Future dates are an explicitly
          // supported case (planning to start later; milestones just don't begin
          // until the date arrives), and a wrong one announces itself in the
          // greeting immediately rather than hiding in a list — which is why the
          // shot date's typo argument does not carry over.
          // Typing only moves the DRAFT. Nothing is saved until you leave the
          // field, and that is the whole rule — one carrier, "I am done here".
          //
          // Saving each keystroke could not work, however it was guarded. The
          // walk Chromium produces while typing the year of 2021 is 0002 → 0020
          // → 0202 → 2021, and only the first two are rejected as unreal: years
          // 0–99 are remapped into the 1900s by `Date.UTC` and fail the
          // round-trip, but year 202 survives it. So `isRealDate` waved
          // `0202-03-15` straight into the profile mid-keystroke, and blur would
          // not undo it — the restore below only fires for a draft that is NOT a
          // real date. Stop anywhere near there and the greeting computes
          // milestones from the third century.
          //
          // It was in front of me in a browser trace (`stored="0202-03-15"`) and
          // I read past it because the final value was right.
          onChange={(e) => setDateDraft(e.target.value)}
          // Leaving the field is the commit.
          //
          // What it deliberately does NOT do is treat an empty field as "delete
          // this". An empty date input carries two meanings it cannot separate —
          // "I cleared this" and "I am retyping and the segments are incomplete"
          // — and both report "". An earlier version resolved that by waiting for
          // blur, which does not separate the meanings at all; it picks one, and
          // picks destructively. Measured in Chromium the ambiguity happens to
          // resolve itself, but that is a reason it does not happen rather than a
          // reason it cannot — Firefox leaves the value empty — and the cost of
          // being wrong is a silently deleted start date with no undo. So
          // removing is its own action, with its own control, below.
          onBlur={() => {
            if (isRealDate(dateDraft)) setStartDate(dateDraft);
            // Half-typed and abandoned: put back what is actually stored, rather
            // than leaving the field showing a value nothing holds.
            else setDateDraft(profile.startDate ?? "");
          }}
        />
      </label>
      {profile.startDate && (
        <button
          type="button"
          className="link-button"
          // This control removes ITSELF — it only renders while a start date is
          // set — so it has to hand focus on before it goes, or a keyboard or
          // screen-reader user is dropped to <body> with nothing announced and
          // the next Tab restarting from the top of the document.
          //
          // The section HEADING, not the date field, and for the reason
          // ShotForm's "Clear form" already documents: focusing an
          // `input[type=date]` from inside a click handler is what makes iOS
          // Safari and Android Chrome throw up the date wheel. Landing there
          // would cover half the phone with a picker immediately after an action
          // whose entire point was to not have a date. The heading summons
          // nothing and names the region that just changed.
          //
          // The date field stays as the fallback: on the standalone panel (tests,
          // or any caller that renders it without the heading) it is better than
          // <body>, and handOffFocus verifies each candidate rather than assuming.
          onClick={() => {
            handOffFocus(headingRef, dateFieldRef);
            // The field empties itself: the profile changes, so the sync above
            // pulls the draft to "". Setting it here as well was redundant, and
            // a mutation check caught that no test could tell the difference.
            setStartDate(undefined);
          }}
        >
          Remove start date
        </button>
      )}
      <p className="field-hint" id="journey-start-hint">
        Marks milestones along the way, like your first year on T. Dates before
        you installed the app count, and a future one works if you’re planning
        ahead.
      </p>

      <label className="form-column">
        How often do you take your shot?
        <input
          type="number"
          min={MIN_INTERVAL_DAYS}
          max={MAX_INTERVAL_DAYS}
          step={1}
          inputMode="numeric"
          value={intervalDraft}
          onChange={(e) => setIntervalDraft(e.target.value)}
          onBlur={commitInterval}
          placeholder="Every ___ days"
          aria-describedby="interval-hint"
        />
      </label>
      {/* The two cadences almost everyone is on, so most people never type a
          number. Same chip pattern as the log form's reuse values. */}
      <div
        className="suggestion-chips suggestion-chips--tight"
        role="group"
        aria-label="Common intervals"
      >
        {COMMON_INTERVALS.map(({ label, days }) => (
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
      </div>

      {/* Above the control it disables, so the reason is read before the thing
          that looks broken. */}
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
          aria-describedby="interval-hint"
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
      {/* No "both optional" here: the section description above says it once
          for the whole panel, and it was being said three times on one screen.
          No "weekly is 7, fortnightly is 14" either — the chips beside the box
          are labelled by span for exactly that reason, so the gloss now
          restates them in the one word we decided not to use. */}
      <p className="field-hint" id="interval-hint">
        Fill both in and you can track how on time your shots are, and see how
        that lines up with how you’ve been feeling.
      </p>
    </div>
  );
};
