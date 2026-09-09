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
// It goes on its own the moment there is a shot to show, which is the very thing
// it is asking you to prepare for — so an IMPORT clears it for free, since
// restoring a backup creates shots.
//
// That used to be the ONLY way out, on derive-don't-store reasoning: nothing to
// dismiss, no flag to keep. The argument was sound and the situation it
// described was not. Someone who does not want to set a cadence has no shot to
// create either, so the card sat on Home indefinitely with no way to say "not
// for me" — a screen you cannot dismiss is not a skippable pointer. `Done`
// therefore stores `firstRunDone` (see `types/profile.ts` for why that flag is
// not derivable from anything else), and the shot-exists rule survives beside
// it as a second route rather than the only one.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useProfileContext } from "../context/ProfileContext";
import { WEEKDAYS, isWeekday, weekdayLabel } from "../utils/weekday";
import { isWeeklyMultiple } from "../utils/schedule";
import { handOffFocus } from "../utils/focus";
import { CONFIRM_MS } from "../utils/timing";
import { SHEET_EXIT_MS } from "./Modal";
import { isRealDate } from "../utils/civilDate";
import { commitDateDraft } from "../utils/dateDraft";
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
  /** Dismiss the card for good. The parent stores the flag AND hands focus on,
   *  because this removes the section the button lives in — see App. */
  /** @param heldFocus whether the card was holding focus as it went. */
  onDone: (heldFocus: boolean) => void;
}

export const FirstShotCard: React.FC<FirstShotCardProps> = ({
  onGoToSettings,
  onDone,
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

  // Follow the profile when it changes underneath this card, the way the same
  // two fields in JourneySettings already do. `useLocalStorage` subscribes to
  // cross-tab `storage` events, so `profile` can change at any moment: another
  // tab setting a cadence in Settings, or an import replacing the whole thing.
  //
  // Without this the drafts stay at their mount-time values and then WIN, because
  // every exit from this card commits them — navigating away, backgrounding, and
  // notably logging the first shot, which unmounts the card. A draft still empty
  // from mount would call setIntervalDays(undefined) and delete both the cadence
  // and the schedule anchor that another tab had just set. Adjusted during
  // render, React's documented pattern for state that follows changing props.
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

  // The start date follows the profile too, and for the same reason: the commit
  // on unmount would otherwise write a stale draft over a date set elsewhere.
  const [lastSavedStart, setLastSavedStart] = useState(profile.startDate);
  if (lastSavedStart !== profile.startDate) {
    setLastSavedStart(profile.startDate);
    setStartDraft(profile.startDate ?? "");
  }

  // Both drafts here need the same escape hatches the Settings date field has:
  // blur must not be the only commit, because on a phone you can type a value
  // and switch apps without ever blurring, and silent loss is the failure this
  // app treats as severe.
  const commitAllRef = useRef(() => {});
  useEffect(() => {
    commitAllRef.current = () => {
      commitInterval();
      // Only on a real change, for the reason `commitInterval` above documents:
      // this runs from an effect cleanup, so every navigation away wrote the
      // profile — and `updateProfile` always returns a fresh object, so the
      // write is real. The card unmounts the moment the first shot is logged,
      // which on a quota-exhausted device raised the storage-failure banner on
      // top of "Logged for you." for an edit nobody made.
      if (
        startDraft.trim() !== "" &&
        isRealDate(startDraft) &&
        startDraft !== profile.startDate
      ) {
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
  const noticeRef = useRef<HTMLParagraphElement>(null);
  /** Where "Remove start date" hands focus when it removes itself. */
  const titleRef = useRef<HTMLHeadingElement>(null);

  /**
   * Done's three beats: idle, the ✓, then the card leaving.
   *
   * The same shape saving a shot uses — confirm in place for CONFIRM_MS, then
   * let the surface go over its own exit — and for the same stated reason: a
   * surface that vanishes on the frame you pressed it "reads as dropped rather
   * than dismissed". This card had no beat at all, so the one moment where
   * someone has just typed their name and their start date ended with the card
   * simply not being there.
   *
   * Borrowing the beat and NOT the words is deliberate. "Logged for you." is
   * reserved for taking a shot, and the roadmap's argument for it is that a
   * constant phrase is what makes it read as the app's voice rather than
   * decoration — spending it on a setup card is how it stops meaning anything.
   */
  const [dismissal, setDismissal] = useState<"idle" | "confirming" | "leaving">(
    "idle",
  );

  /**
   * Held in a ref so the beat below never restarts. `onDone` is an inline arrow
   * in App, so a plain dependency re-arms the timer at its FULL duration on any
   * parent render — and this card writes the profile on blur, which App
   * consumes. Repeated renders inside the window would leave the ✓ up
   * indefinitely. Same reason `useFocusTrap` holds `onEscape` this way.
   */
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  /**
   * Pressing Done is the DECISION; the ✓ and the slide are how it is
   * acknowledged. Those need separate lifetimes, because the decision must not
   * depend on the acknowledgement being allowed to finish.
   *
   * It did. `firstRunDone` was only written when the second timer fired, 440ms
   * after the press, and Home unmounts when you leave it — so tapping a tab or
   * swiping back inside that window cleared the timer and the dismissal was
   * simply lost. Measured: the card was fully back on returning to Home, after
   * the ✓ had already been shown. 440ms is a long time for a deliberate second
   * tap, and nothing else was hiding the card, so the app looked like it forgot.
   *
   * Committing on the way out is what fixes it: the beat now owns only what the
   * card LOOKS like, never whether the press counted.
   */
  const dismissing = useRef(false);

  /*
   * Whether the card was the thing HOLDING focus, captured as a fact rather
   * than inferred afterwards.
   *
   * App needs this to decide whether to hand focus on, and the obvious test —
   * "is `document.activeElement` the <body>?" — makes one value carry two
   * meanings, which is the rule this codebase has paid for most. `<body>` means
   * BOTH "focus was inside the card and the card has been removed" AND "focus
   * was never anywhere", and the second is not an edge case: Safari does not
   * focus a <button> on tap (`focus.ts` says so), so on the app's primary
   * platform every tab tap leaves focus on <body> and the card would take it
   * back — silently for sighted users, but moving a VoiceOver cursor to the
   * page title after you tapped a tab.
   *
   * A LAYOUT cleanup runs before React detaches the node — measured: it sees
   * `isConnected` true and still `contains()` the focused element, where the
   * passive cleanup that commits the dismissal only ever sees <body>. So the
   * question is asked at the last moment it is still itself, and stored.
   */
  const rootRef = useRef<HTMLElement>(null);
  const heldFocus = () => !!rootRef.current?.contains(document.activeElement);
  const heldFocusAtUnmount = useRef(false);
  useLayoutEffect(
    () => () => {
      heldFocusAtUnmount.current = heldFocus();
    },
    [],
  );

  useEffect(
    () => () => {
      if (dismissing.current) onDoneRef.current(heldFocusAtUnmount.current);
    },
    [],
  );

  useEffect(() => {
    if (dismissal === "idle") return;
    const wait = dismissal === "confirming" ? CONFIRM_MS : SHEET_EXIT_MS;
    const t = window.setTimeout(() => {
      if (dismissal === "confirming") setDismissal("leaving");
      else {
        // Disarmed first: the unmount this call triggers must not commit twice.
        dismissing.current = false;
        onDoneRef.current(heldFocus());
      }
    }, wait);
    return () => window.clearTimeout(t);
  }, [dismissal]);

  /**
   * A whole-week cadence with no shot day tracks NOTHING, silently.
   *
   * `scheduleMode` returns "none" for it — a weekly grid has no idea which
   * week-day its slots fall on — so no shot gets a planned date. The card
   * invites exactly this: it asks how often under a hint promising you can
   * "track how on time your shots are", and the day is a separate control that
   * starts on "No shot day". Tap "1 week", move on, and nothing is measured.
   *
   * The asymmetry is what makes it a defect rather than a limitation: the
   * NON-weekly case says so out loud ("a weekday can't describe every 10 days.
   * Your gaps are still tracked."), while this one — the commoner of the two —
   * says nothing at all. And because a planned date is frozen at save time,
   * every shot logged during the silence stays unmeasurable even after the day
   * is set later.
   */
  const shotDayNeeded =
    isValidIntervalDays(profile.intervalDays) &&
    isWeeklyMultiple(profile.intervalDays) &&
    !profile.shotDay;

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
      // The NOTICE first, not the number input. `<body>` here is a proxy for
      // two different situations and cannot tell them apart: focus was on the
      // select we just disabled (the case this exists for), or the user tapped
      // blank card background to dismiss the keyboard and focus was simply
      // nowhere. Both look identical by the time a passive effect runs, because
      // disabling a focused element blurs it.
      //
      // So the target is chosen to be harmless under the false positive rather
      // than the check being sharpened past what it can know. Landing in the
      // number input re-raised the numeric keyboard the user had just
      // dismissed; landing on the notice is silent, and it is the sentence
      // explaining why the control below it went away — which is what a screen
      // reader should hear at that moment anyway. Same reasoning as
      // JourneySettings' "Remove start date", which avoids the date field
      // precisely because focusing one summons a picker.
      //
      // The `<body>` case stays, deliberately: a false positive now costs a
      // silent focus move, where a false negative strands focus on <body>
      // inside the page, which is the failure this project treats as severe.
      handOffFocus(noticeRef, intervalRef);
    }
  }, [shotDayUnavailable]);

  return (
    <section
      ref={rootRef}
      className={`first-shot-card${
        dismissal === "leaving" ? " first-shot-card--leaving" : ""
      }`}
    >
      {/* `tabIndex={-1}` so "Remove start date" can hand focus here when it
          takes itself away. It never joins the tab order. */}
      <h2 className="first-shot-card__title" ref={titleRef} tabIndex={-1}>
        Before your first shot
      </h2>
      {/* The "it's all optional" line leads, rather than closing the card.
          Marking every field individually is what you do when SOME are
          required — here none are, so one sentence at the top says it once for
          all four, and there is nothing left for a footer to repeat. It also
          has to be read BEFORE the questions to do its job: a reassurance
          underneath four fields arrives after the moment someone decides
          whether they are obliged to answer them. */}
      <p className="first-shot-card__intro">
        {/* <strong>, not <em>: bold over italics is the accessibility call,
            since slanted shapes slow word recognition and are worst for the
            readers most likely to need the reassurance — and <strong> is the
            element screen readers convey as importance, where <b> is styling
            only. Emphasis carried by weight AND contrast, the same pair the
            label hierarchy on this card already uses, because at 0.8rem a
            weight change alone is easy to miss.

            One word, not two. Emphasis works by contrast, so bolding a third of
            a six-word sentence spends it — and "All" still scopes the claim
            perfectly well unbolded, sitting right beside the word that carries
            it. */}
        All <strong>optional</strong> — revisit anytime in Settings.
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
            // An emptied field CLEARS, and this card and Settings agree on
            // that — they have drifted apart on this exact question before,
            // which is worse than either answer alone. `commitDateDraft` holds
            // the reasoning and the measurements: `badInput` separates a field
            // emptied outright from one part-way through being retyped, so
            // "Reset" in the native picker finally does what it says.
            //
            // It matters more here than in Settings. This card has no "Remove
            // start date" control, so before this an answer given on it could
            // not be taken back at all — name and interval both cleared, and the
            // date alone was permanent, on the one screen someone meets before
            // they know Settings exists.
            // The LIVE element value, not the draft. On iOS the picker's
            // own Reset either fires NO change event (WebKit, time inputs) or
            // fires one carrying the PREVIOUS value (WebKit, date inputs) —
            // both documented React issues — so the draft is stale by exactly
            // the amount that matters, and the old value round-trips straight
            // back. By blur the picker has closed and the element itself is
            // correct, which is the workaround those reports land on: read the
            // input, not the event.
            onBlur={(e) => {
              const live = e.target.value;
              const commit = commitDateDraft(live, e.target.validity.badInput);
              if (commit.action === "set") {
                setStartDraft(commit.date);
                setStartDate(commit.date);
              } else if (commit.action === "clear") {
                setStartDraft("");
                setStartDate(undefined);
              } else setStartDraft(profile.startDate ?? "");
            }}
          />
        </div>
        {/* The control that does NOT depend on the platform reporting a Reset.
            iOS's picker offers its own Reset, and WebKit either fires no change
            event for it or fires one carrying the previous value — so the blur
            handler above is a best effort that cannot be verified from here.
            This is the guaranteed path, and it is the same control Settings
            has: without it, an answer given on this card could not be taken
            back at all, on the one screen someone meets before they know
            Settings exists. */}
        {profile.startDate && (
          <button
            type="button"
            className="link-button field-clear"
            // Removes ITSELF — it renders only while a start date is set — so
            // it hands focus on first. To the card's HEADING, never back to the
            // date field: focusing an `input[type=date]` from a click handler
            // is what makes iOS throw the picker up again, which is absurd
            // immediately after an action whose whole point was to have no
            // date. Same reasoning JourneySettings' Remove already records.
            onClick={() => {
              handOffFocus(titleRef, noticeRef);
              setStartDate(undefined);
              setStartDraft("");
            }}
          >
            Remove start date
          </button>
        )}
      </div>

      <div className="first-shot-card__field">
        <span className="first-shot-card__label">
          How often do you take it?
        </span>
        {/* The pair's hint, under the FIRST of the two questions it describes
            rather than trailing the second — it says why you would answer
            either, so it has to arrive before you meet them. */}
        <p className="field-hint" id="first-shot-cadence-hint">
          Track how on time your shots are.
        </p>
        {/* The box ABOVE the chips, and both drawn exactly as Settings draws
            them — same classes, so there is one style for one control rather
            than two that drift. This card used to put the chips first and hang
            the input inside their flex row as a stretchy pill, which made the
            same question look like two different questions depending on where
            you met it. The wording still differs, deliberately: this heading
            covers the chips too, so it stays unit-neutral. */}
        <div className="interval-field">
          <label className="visually-hidden" htmlFor="first-shot-interval">
            How many days between your shots?
          </label>
          <input
            id="first-shot-interval"
            className="interval-field__input"
            type="number"
            min={MIN_INTERVAL_DAYS}
            max={MAX_INTERVAL_DAYS}
            step={1}
            inputMode="numeric"
            ref={intervalRef}
            value={intervalDraft}
            onChange={(e) => setIntervalDraft(e.target.value)}
            onBlur={(e) => commitInterval(e.target.validity.badInput)}
            aria-describedby="first-shot-cadence-hint"
          />
          <span className="interval-field__unit" aria-hidden="true">
            days
          </span>
        </div>
        <div
          className="suggestion-chips suggestion-chips--tight"
          role="group"
          aria-label="Common intervals"
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
        </div>
      </div>

      {shotDayNeeded && (
        <p className="field-hint field-hint--notice" id="first-shot-day-needed">
          Pick a day too — a weekly rhythm needs one before your shots can have
          a planned date.
        </p>
      )}

      {/* tabIndex={-1} so it can receive focus when the select under it
          disables — it is not a control and never joins the tab order. */}
      {shotDayUnavailable && (
        <p
          className="field-hint field-hint--notice"
          id="first-shot-day-notice"
          ref={noticeRef}
          tabIndex={-1}
        >
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
            // The notice explaining WHY this is disabled, when it is. Without
            // it a screen reader announces "disabled" and no reason — the one
            // piece of the sentence a sighted user gets for free.
            aria-describedby={
              shotDayUnavailable
                ? "first-shot-cadence-hint first-shot-day-notice"
                : shotDayNeeded
                  ? "first-shot-cadence-hint first-shot-day-needed"
                  : "first-shot-cadence-hint"
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

      {/* An explicit end to the card.
          It had none: the only way to make it go was to log a shot, which is
          not obviously connected to filling this in, so there was no moment
          where the setup felt finished. Everything here already saves as you
          type, so the button says Done rather than Save — it dismisses, it does
          not commit, and calling it Save would promise work that already
          happened. */}
      <div className="first-shot-card__done">
        <button
          type="button"
          className={`secondary-button first-shot-card__done-button${
            dismissal === "idle"
              ? ""
              : " first-shot-card__done-button--confirmed"
          }`}
          // `aria-disabled`, never `disabled` — disabling the focused button
          // blurs it, and the browser drops focus to <body> for the whole beat
          // with nothing handing it on. The guard in the handler does the
          // actual blocking. Same rule the sheet's Save button records.
          aria-disabled={dismissal !== "idle"}
          onClick={() => {
            if (dismissal !== "idle") return;
            dismissing.current = true;
            setDismissal("confirming");
          }}
        >
          {dismissal === "idle" ? (
            "Done"
          ) : (
            <>
              {/* aria-hidden so the glyph stays out of the accessible name —
                  unwrapped it announces as "check mark Done". The word carries
                  the meaning; the tick is the beat. */}
              <span aria-hidden="true">✓</span> Done
            </>
          )}
        </button>
        {/* No caption under the button. It said the card hides for good and
            that the fields live in Settings — the second half repeats the line
            at the top of the card, and the first is what a button labelled Done
            on a card you just filled in already means. */}
      </div>

      {/* A returning user and a new one land on the same empty screen needing
          opposite things, and this one is protective rather than convenient:
          import REPLACES rather than merges, so logging a shot first and
          importing afterwards throws that shot away.
          (Moved back down to the paragraph it describes — the Done block was
          inserted between the two, leaving it reading as documentation for a
          button about something else.) */}
      <p className="first-shot-card__restore">
        Returning with a backup?{" "}
        <button type="button" className="link-button" onClick={onGoToSettings}>
          Restore it in Settings →
        </button>
      </p>
    </section>
  );
};
