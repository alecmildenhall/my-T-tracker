// src/components/JourneySettings.tsx
// Settings → "Your journey": the optional T start date and preferred name that
// power milestone messages. Both are opt-in, local-only, and clearing a field
// removes it entirely.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useProfileContext } from "../context/ProfileContext";
import { WEEKDAYS, isWeekday, weekdayLabel } from "../utils/weekday";
import { isRealDate } from "../utils/civilDate";
import { commitDateDraft } from "../utils/dateDraft";
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

  const commitInterval = (badInput = false) => {
    const trimmed = intervalDraft.trim();
    // `badInput` distinguishes the two things an empty `value` means, which
    // is otherwise unanswerable: a number input reports "" both when it is
    // genuinely empty AND when it holds something unparseable, because the
    // HTML value-sanitization algorithm discards text that is not a valid
    // floating-point number. Measured: "1e", "-" and "1.2.3" all read as "".
    // Treating that as a deliberate clear meant a fumbled keystroke plus a
    // blur deleted the cadence. `validity.badInput` is the real question —
    // false for empty, true for garbage — rather than a proxy for it.
    if (badInput) {
      setIntervalDraft(
        profile.intervalDays !== undefined ? String(profile.intervalDays) : "",
      );
      return;
    }
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
  /**
   * The same disable-under-focus hazard FirstShotCard guards, which this panel
   * was assumed to escape "by accident, because three chips sit between its
   * input and its select". That holds for Tab and not for a pointer: with a
   * non-weekly value uncommitted in the interval box, tapping the shot-day
   * select fires the input's blur FIRST, the commit disables the select, and
   * the tap can no longer land focus on it — leaving focus on <body> inside
   * Settings. Same class as the nine hand-off defects in slice B, and invisible
   * to jsdom, which is how "three chips away" read as safety.
   */
  const intervalFieldRef = useRef<HTMLInputElement>(null);
  const shotDaySelectRef = useRef<HTMLSelectElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  /** See FirstShotCard: a whole-week cadence with no shot day plans nothing,
   *  and said nothing, while the non-weekly case explains itself. */
  const shotDayNeeded =
    isValidIntervalDays(profile.intervalDays) &&
    isWeeklyMultiple(profile.intervalDays) &&
    !profile.shotDay;

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
  /** What is actually stored, so the hatch can skip a write that changes nothing. */
  const savedRef = useRef(profile.startDate);
  useEffect(() => {
    draftRef.current = dateDraft;
    commitRef.current = setStartDate;
    savedRef.current = profile.startDate;
  });

  // A LAYOUT effect, so its cleanup runs while the input is still attached and
  // can be asked directly. Measured: on unmount a passive cleanup sees a null
  // ref and a layout cleanup sees the element.
  useLayoutEffect(() => {
    // The same decision blur makes, from the same source: the LIVE element.
    //
    // This used to be `if (isRealDate(draftRef.current)) commit(...)`, which
    // could only express SET. Once an emptied field started meaning "clear",
    // that made the hatch disagree with blur — measured: emptying the field and
    // backgrounding (or switching tab, which unmounts this panel) put the old
    // date straight back, and the field showed it again on return.
    //
    // Reading the element rather than the draft matters twice over here. On iOS
    // the picker's Reset fires no change event, so the draft still holds the
    // date the user just removed — committing THAT on backgrounding is the
    // deletion silently undoing itself, which is the failure class this app
    // treats as severe.
    //
    // "restore" does nothing: it only ever affected what the field displays,
    // and there is nothing to display on the way out.
    const commitFromField = () => {
      // The element on BOTH exits, which is the point of the layout effect
      // above. This comment used to say the opposite — that unmount detaches the
      // ref first, so the draft carries that path — and it was true of the
      // PASSIVE effect this used to be. Converting it made the claim stale, and
      // a stale comment here is dangerous rather than untidy: believing it, you
      // would conclude the layout effect is pointless and revert it, which
      // silently turns "an emptied field clears on tab change" back into
      // "restores". Measured, and guarded — swapping `useLayoutEffect` back to
      // `useEffect` turns two tests red.
      //
      // Reading the control matters most on BACKGROUNDING, where it is the only
      // source that survives iOS's picker Reset firing no change event and
      // leaving the draft holding the date the user just removed.
      //
      // The draft fallback is now unreachable defence rather than a path: kept
      // because `focus()`-style assumptions about refs are exactly what this
      // file keeps getting wrong, and it fails toward "restore".
      const el = dateFieldRef.current;
      const value = el ? el.value : draftRef.current;
      // Read from the control itself, never from a remembered answer. A
      // `<input type="date">` fires `input` ONLY when its `value` changes, and
      // once the value is `""` it stays `""` while further segments are typed
      // or deleted -- so `badInput` flips with no event, no render, and any
      // sampled copy goes stale in BOTH directions: stale `true` resurrects a
      // date the user removed, stale `false` deletes one they were retyping.
      // This cleanup is a LAYOUT one precisely so the node is still attached
      // here; measured, a passive cleanup sees `null` and a layout cleanup sees
      // the element.
      //
      // If it is ever null anyway, "cleared on purpose" is not something we can
      // claim, so say mid-edit and let it restore -- the recoverable failure.
      const badInput = el ? el.validity.badInput : true;
      const commit = commitDateDraft(value, badInput);
      // Guarded like the clear branch below, and like FirstShotCard's copy: this
      // runs from an effect cleanup, so an unconditional write re-wrote the
      // profile on every exit from Settings. `updateProfile` always returns a
      // fresh object, so every ProfileContext consumer re-rendered for an edit
      // nobody made -- masked by useLocalStorage's serialized-equal skip, which
      // is the reasoning the comment below already rejects as insufficient.
      if (commit.action === "set" && commit.date !== savedRef.current) {
        commitRef.current(commit.date);
      }
      // Only on a real change, which is the guard `FirstShotCard` and
      // `commitInterval` both already carry and this one was missing. It runs
      // from an effect cleanup, and with no start date set the field is empty
      // and well-formed -- so "clear" fired on EVERY exit from Settings. That
      // is invisible while storage works, because `useLocalStorage` skips a
      // serialized-equal write, and stops being invisible on a full device,
      // where touching storage at all can raise the banner for an edit nobody
      // made.
      else if (commit.action === "clear" && savedRef.current !== undefined) {
        commitRef.current(undefined);
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") commitFromField();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      // Unmount too: changing tab destroys this panel, and on a phone that is a
      // likelier exit than blurring the field.
      commitFromField();
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
  const commitIntervalRef = useRef<(badInput?: boolean) => void>(() => {});
  useEffect(() => {
    commitIntervalRef.current = commitInterval;
  });
  // Layout, so the cleanup can still read the input -- the same reason the date
  // hatch above is one. A passive cleanup sees a detached ref.
  useLayoutEffect(() => {
    // Ask the control, never a default. `badInput` false meant "deliberately
    // emptied", and a number input reports "" for garbage as well, so a fumbled
    // keystroke plus a background cleared the cadence and its anchor.
    const commitIfUsable = () =>
      commitIntervalRef.current(
        intervalFieldRef.current?.validity.badInput ?? true,
      );
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

  // Only on the false -> true EDGE, never on mount: on mount
  // `document.activeElement` is <body> by definition, so an unguarded version
  // would yank focus the instant the panel painted for anyone who already has a
  // non-weekly interval saved.
  const wasUnavailable = useRef(shotDayUnavailable);
  useEffect(() => {
    const justDisabled = shotDayUnavailable && !wasUnavailable.current;
    wasUnavailable.current = shotDayUnavailable;
    if (!justDisabled) return;
    const active = document.activeElement;
    if (active === document.body || active === shotDaySelectRef.current) {
      // The notice first, for the reason FirstShotCard's copy of this explains
      // at length: <body> cannot distinguish "the select we just disabled had
      // focus" from "focus was nowhere", so the target is chosen to be harmless
      // when the guess is wrong. A paragraph is silent; the interval box would
      // raise a numeric keyboard nobody asked for.
      handOffFocus(noticeRef, intervalFieldRef);
    }
  }, [shotDayUnavailable]);

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
        />
      </label>

      {/* htmlFor, not a wrapping label: the hint sits between the question and
          the control, and text inside a <label> joins the field's accessible
          name. See the same field in FirstShotCard. */}
      <label htmlFor="journey-start">Testosterone start date</label>
      <p className="field-hint" id="journey-start-hint">
        Marks milestones, like your first year on T.
      </p>
      <div className="form-column">
        <input
          id="journey-start"
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
          // Leaving the field is the commit, and an emptied field now CLEARS.
          //
          // It used to restore instead, on the reasoning that an empty date
          // input cannot separate "I cleared this" from "I am retyping and the
          // segments are incomplete" — both report "". The ambiguity is real;
          // the conclusion that nothing could resolve it was not. `badInput` is
          // false for a field emptied outright and true for one mid-edit, which
          // `commitDateDraft` measures and this field now trusts, exactly as the
          // interval box beside it already trusts it for a number.
          //
          // What that fixes is a native control appearing to do nothing: the
          // iOS picker's own "Reset" empties the field, and blur used to put the
          // value straight back.
          // The LIVE element value, not the draft. On iOS the picker's own
          // Reset either fires NO change event (WebKit, time inputs) or fires
          // one carrying the PREVIOUS value (WebKit, date inputs) — both
          // documented React issues — so the draft is stale by exactly the
          // amount that matters and the old value round-trips straight back.
          // By blur the picker has closed and the element itself is correct,
          // which is the workaround those reports land on: read the input, not
          // the event.
          onBlur={(e) => {
            const live = e.target.value;
            const commit = commitDateDraft(live, e.target.validity.badInput);
            if (commit.action === "set") {
              setDateDraft(commit.date);
              setStartDate(commit.date);
            } else if (commit.action === "clear") {
              setDateDraft("");
              setStartDate(undefined);
            } else setDateDraft(profile.startDate ?? "");
          }}
        />
      </div>
      {/* On the DRAFT, not the committed profile. Keyed to the profile it only
          appeared after blur, so entering a date and looking at it showed
          nothing until you tapped away — a visible lag on the one control that
          undoes what you just did. The pain and off-days Clears next door
          already key to their drafts and appear on the tap; this now matches
          them. `isRealDate`, not `!== ""`, so a half-typed date does not flash
          it on and off between segments. */}
      {isRealDate(dateDraft) && (
        <button
          type="button"
          className="link-button field-clear"
          // Keep the press from destroying its own target. This control
          // now renders while the date field still has focus, so tapping it
          // blurs the field first — that commits, re-renders, and the mouseup
          // lands on a different node, so the click never fires. Measured: the
          // event sequence was ["blur"] alone and the date survived.
          //
          // `preventDefault` on mousedown stops focus moving at all, so there
          // is no blur, no re-render, and the click lands. Keyboard is
          // untouched — Enter and Space fire click without a mousedown — and
          // the handler moves focus deliberately anyway.
          onMouseDown={(e) => e.preventDefault()}
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
            setStartDate(undefined);
            // And the draft explicitly. This USED to be redundant — the profile
            // changed, and the sync above pulled the draft to "" — but the
            // control now renders on the draft, and the draft can hold a date
            // the profile never got (typed, not yet blurred). In that case the
            // profile does not change, so nothing syncs, and without this the
            // date would sit in the field with no way left to remove it.
            setDateDraft("");
          }}
        >
          Remove start date
        </button>
      )}
      {/* The pair's hint, under the FIRST of the two questions it describes,
          because it says what answering them buys you and has to arrive before
          you meet them.

          It names NEITHER field on purpose. Earlier drafts said "fill both in",
          which is wrong whenever the interval is not a whole number of weeks —
          no weekday can describe a 10-day cadence, so the app disables the
          shot-day select and times from the previous shot instead, and the hint
          was telling that user to do the thing the app had just stopped them
          doing. Stating only the payoff is true in both modes. */}
      {/* The unit is in the LABEL, not only beside the box. A suffix is
          `aria-hidden` by convention and this one is too, so the label is the
          only place a screen reader can learn the unit — the guidance that
          recommends unit adornments says so explicitly ("Height, in inches"
          beside an "in." suffix). */}
      <label htmlFor="journey-interval">
        How many days between your shots?
      </label>
      <p className="field-hint" id="interval-hint">
        Track how on time your shots are.
      </p>
      {/* The unit sat only in the PLACEHOLDER, which disappears the moment
          there is a value — and the most common action here, tapping "2 weeks",
          is exactly what puts one there. So the last unit you read said WEEKS
          while the box quietly held 14. Placeholders are the documented wrong
          home for essential information for precisely this reason.

          The box is sized to its content rather than the column, and "days"
          sits immediately after it. A full-width field with the unit pinned
          right — which is how this was first drawn — puts them 580px apart on
          desktop, where they stop reading as one phrase, and drops the unit
          straight onto the number spinner Chromium paints there on hover.
          Measured both. */}
      <div className="form-column">
        <div className="interval-field">
          <input
            id="journey-interval"
            className="interval-field__input"
            ref={intervalFieldRef}
            type="number"
            min={MIN_INTERVAL_DAYS}
            max={MAX_INTERVAL_DAYS}
            step={1}
            inputMode="numeric"
            value={intervalDraft}
            onChange={(e) => setIntervalDraft(e.target.value)}
            onBlur={(e) => commitInterval(e.target.validity.badInput)}
            aria-describedby="interval-hint"
          />
          <span className="interval-field__unit" aria-hidden="true">
            days
          </span>
        </div>
      </div>
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
      {shotDayNeeded && (
        <p className="field-hint field-hint--notice" id="shot-day-needed">
          Pick a day too — a weekly rhythm needs one before your shots can have
          a planned date.
        </p>
      )}

      {/* tabIndex={-1} so it can take focus when the select below it disables —
          not a control, never in the tab order. */}
      {shotDayUnavailable && (
        <p
          className="field-hint field-hint--notice"
          id="shot-day-notice"
          ref={noticeRef}
          tabIndex={-1}
        >
          No shot day with a non-weekly interval — a weekday can’t describe
          every {profile.intervalDays} days. Your gaps are still tracked.
        </p>
      )}

      <label className="form-column">
        Which day do you usually take it?
        <select
          ref={shotDaySelectRef}
          value={profile.shotDay ?? ""}
          disabled={shotDayUnavailable}
          // See FirstShotCard: the reason it is disabled has to reach assistive
          // tech too, not just the notice a sighted user can read above it.
          aria-describedby={
            shotDayUnavailable
              ? "interval-hint shot-day-notice"
              : shotDayNeeded
                ? "interval-hint shot-day-needed"
                : "interval-hint"
          }
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
  );
};
