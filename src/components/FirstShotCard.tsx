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
import { handOffFocus } from "../utils/focus";
import { CadencePicker } from "./CadencePicker";
import { effectiveScheduleMode } from "../utils/schedule";
import { CONFIRM_MS } from "../utils/timing";
import { SHEET_EXIT_MS } from "./Modal";
import { isRealDate } from "../utils/civilDate";
import { commitDateDraft } from "../utils/dateDraft";


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
    setSchedule,
    setPreferredName,
    setStartDate,
  } = useProfileContext();

  /**
   * Nothing left to ask? Then this card has nothing to offer.
   *
   * Someone who opens Settings first and fills it in came back to Home and met
   * a "Before your first shot" card with every field already populated — a
   * setup prompt for setup they had just finished.
   *
   * EVERY field, not merely one, and the difference is a regression avoided
   * rather than a nicety. `hasProfileData` was the obvious check and is wrong
   * here: type a name into this card, wander to History, come back, and the
   * card you were half way through would be gone, with the rest of it reachable
   * only from Settings. The card is useless exactly when it can ask nothing new.
   *
   * SNAPSHOT at mount, never live — typing into the card writes to the profile
   * immediately, so a live check would make the card vanish under the person
   * using it, mid-keystroke. Home unmounts when you leave it, so this re-arms on
   * every return, which is exactly when the answer can have changed.
   */
  const [alreadySetUp] = useState(
    () =>
      profile.preferredName !== undefined &&
      profile.startDate !== undefined &&
      // ANSWERED, not merely started. `pickMode` stores `scheduleMode` the
      // instant a rhythm is tapped, before the days or the weeks exist — so
      // "a mode string is present" was true of a cadence that plans nothing.
      // Tap "On certain days", leave, and the card hid itself forever over an
      // answer it had only half received, taking with it the very line that
      // would have said so ("Add how many weeks to plan your shot dates") and
      // leaving Settings as the only way back.
      //
      // "I'd rather not track this" is a complete answer with no fields to
      // fill, which is why it is named rather than inferred from the values.
      (profile.scheduleMode === "none" ||
        effectiveScheduleMode(profile) !== "none"),
  );


  // Follow the profile when it changes underneath this card, the way the same
  // field in JourneySettings does. `useLocalStorage` subscribes to cross-tab
  // `storage` events, so `profile` can change at any moment: another tab
  // editing Settings, or an import replacing the whole thing.
  //
  // Without this the draft stays at its mount-time value and then WINS, because
  // every exit from this card commits it — navigating away, backgrounding, and
  // notably logging the first shot, which unmounts the card. A draft still
  // holding a stale date would write it over one another tab had just set.
  // Adjusted during render, React's documented pattern for state that follows
  // changing props.
  //
  // The START DATE only. This used to describe the cadence too — naming
  // `setIntervalDays`, a setter that no longer exists — and that machinery now
  // lives in `CadencePicker`, which follows the profile itself. Left as it was
  // it read as documentation for the draft below while describing something
  // deleted, which is the failure JourneySettings warns about in the same
  // words: a stale comment here is dangerous rather than untidy.
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
      // The cadence is no longer committed here: `CadencePicker` owns that
      // field and carries its own hatch, so this one is down to the start date.
      // Only on a real change, for the reason that hatch documents:
      // this runs from an effect cleanup, so every navigation away wrote the
      // profile — and `updateProfile` always returns a fresh object, so the
      // write is real. The card unmounts the moment the first shot is logged,
      // which on a quota-exhausted device raised the storage-failure banner on
      // top of "Logged for you." for an edit nobody made.
      // `commitDateDraft`, not an `isRealDate` guard, so this hatch can express
      // a CLEAR. It could only ever say "set" — so once an emptied field started
      // meaning "clear", emptying one and then backgrounding put the old date
      // straight back, and the two fields that are meant to agree on this
      // question agreed on blur and diverged here.
      //
      // The element on both exits — the cleanup is a LAYOUT one, so the input is
      // still attached when it runs. This said the reverse until the effect was
      // converted, and the reverse is what a passive cleanup sees; left as it
      // was, the next reader would revert the layout effect and quietly restore
      // a date the user had cleared. Reading the control matters most on
      // backgrounding, where it is the only source that survives iOS's picker
      // Reset firing no change event. The draft fallback is unreachable defence.
      const el = startFieldRef.current;
      const value = el ? el.value : startDraft;
      // Always the control, never a remembered answer: a date input fires no
      // event while `value` stays `""`, so `badInput` flips unobserved and a
      // sampled copy goes stale both ways. The cleanup below is a LAYOUT one so
      // the node is still attached to be asked. Mirrors `JourneySettings`
      // exactly -- these two diverging on this question is the whole reason
      // `commitDateDraft` is shared.
      const badInput = el ? el.validity.badInput : true;
      const commit = commitDateDraft(value, badInput);
      // Still only on a real CHANGE, for the reason `commitInterval` documents:
      // this runs from an effect cleanup, so writing unconditionally wrote the
      // profile on every navigation away.
      if (commit.action === "set" && commit.date !== profile.startDate) {
        setStartDate(commit.date);
      } else if (commit.action === "clear" && profile.startDate !== undefined) {
        setStartDate(undefined);
      }
    };
  });
  // A LAYOUT effect, so the cleanup runs while the date input is still attached
  // and can be asked for its own `validity`. Measured: on unmount a passive
  // cleanup sees a null ref, a layout cleanup sees the element.
  useLayoutEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") commitAllRef.current();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      commitAllRef.current();
    };
  }, []);

  /** The start-date input, read by the escape hatch while it is still mounted. */
  const startFieldRef = useRef<HTMLInputElement>(null);
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

  // After every hook, never before: bailing early would change the hook order
  // between renders, which React forbids outright.
  if (alreadySetUp) return null;

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
            ref={startFieldRef}
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
        {/* The DRAFT, matching Settings and the two chip Clears: keyed to the
            committed profile this appeared only after blur, a visible lag on
            the control that undoes what you just entered. */}
        {isRealDate(startDraft) && (
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
            // Removes ITSELF — it renders only while a start date is set — so
            // it hands focus on first. To the card's HEADING, never back to the
            // date field: focusing an `input[type=date]` from a click handler
            // is what makes iOS throw the picker up again, which is absurd
            // immediately after an action whose whole point was to have no
            // date. Same reasoning JourneySettings' Remove already records.
            onClick={() => {
              // One candidate, and that is stated rather than hidden: the
              // notice this used to fall back to went with the shot-day select,
              // so passing it left a permanently-null second candidate that
              // looked like the util's "always more than one" rule was being
              // followed when it was not. `titleRef` carries tabIndex={-1} and
              // handOffFocus verifies the result, so a failure is visible
              // rather than silent.
              handOffFocus(titleRef);
              setStartDate(undefined);
              setStartDraft("");
            }}
          >
            Remove start date
          </button>
        )}
      </div>

      <div className="first-shot-card__field">
        {/* The same control Settings uses, from one file. These two have
            already answered an identical question opposite ways once. */}
        <CadencePicker
          idPrefix="first-shot"
          profile={profile}
          onChange={setSchedule}
        />
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
