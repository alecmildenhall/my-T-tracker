// src/components/ShotForm.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { ShotEntry } from "../types/shot";
import { suggestionsFor } from "../utils/suggestions";
import { todayLocalISO, nowHHMM } from "../utils/datetime";
import { toCivilDate } from "../utils/civilDate";
import { newId } from "../utils/id";
import { SuggestionChips } from "./SuggestionChips";
import { handOffFocus } from "../utils/focus";

/**
 * The fields worth pre-filling on a new shot: dose, type of T, and carrier oil
 * rarely change between shots, so re-entering them every time is pure friction.
 * Everything else (time, site, position, pain, mood, notes) is genuinely
 * per-shot — site especially, since rotating it is the point.
 *
 * Sourced from the most recent shot rather than remembered in state, so it holds
 * across the sheet closing, a tab switch, or an app reload.
 */
function carryForward(shots: ShotEntry[]): {
  doseMg: string;
  testosteroneEster: string;
  carrierOil: string;
} {
  // Compared on date+time ONLY, deliberately not via compareShotsChrono: that
  // comparator breaks ties on `id`, a random UUID. Time is optional, so two
  // shots logged the same day with no time are indistinguishable to it and the
  // "latest" would be a coin flip — and whatever it picked would be pre-filled
  // and then saved into the new entry. `>=` keeps the last tying element: the
  // most recently added, which is the one the user just logged.
  const stamp = (s: ShotEntry) => `${s.date}T${s.time ?? "00:00"}`;
  const latest = shots.reduce<ShotEntry | undefined>(
    (best, shot) =>
      best === undefined || stamp(shot) >= stamp(best) ? shot : best,
    undefined
  );
  return {
    doseMg: latest?.doseMg !== undefined ? String(latest.doseMg) : "",
    testosteroneEster: latest?.testosteroneEster ?? "",
    carrierOil: latest?.carrierOil ?? "",
  };
}

/**
 * The raw field values of an in-progress new shot, kept verbatim (strings, as
 * typed) so restoring is byte-identical to what the user left behind — including
 * a half-typed number that isn't a valid entry yet.
 */
export interface ShotDraft {
  /**
   * The date exactly as the field held it — a snapshot, like every other value
   * here. Never re-derived on restore.
   *
   * This used to follow today: parked on Monday, reopened Wednesday, logged
   * Wednesday. That optimised for the wrong case. A draft only exists once the
   * user has typed something (see `hasUnsavedInput`), so every draft is
   * deliberate work about a *particular shot* — and you log a shot after taking
   * it, so the day the draft was started is the better guess at the day it
   * happened. Someone finishing yesterday's half-filled entry got today's date
   * slipped underneath them, and today looks plausible enough that nothing
   * catches the eye.
   *
   * Freezing prefers the visible failure: a stale date sits in the field where
   * it can be seen and corrected, rather than a wrong one that looks right.
   * Snapshot-and-restore is also the ordinary draft contract everywhere else
   * (mail, notes, docs) — nothing silently rewrites a field you left alone.
   */
  date: string;
  /**
   * The date this form was seeded with — the value the field would still hold if
   * the user never touched it. The date counts as unsaved input exactly when it
   * differs from this.
   *
   * The reference itself is stored, rather than a boolean answer derived from it,
   * because every derived form drifted. A flag is computed against some baseline
   * at the moment it is set and then read much later, against a baseline that may
   * have moved — the sheet outlives a day, or "Clear form" reseeds the field —
   * and the two silently disagree. Keeping the reference means there is only one,
   * it travels with the draft, and whoever asks gets the same answer.
   *
   * For a new shot this is the day the form opened; for an edit, the shot's own
   * stored date; after "Clear form", the day it was cleared.
   */
  dateBaseline: string;
  time: string;
  doseMg: string;
  injectionSite: string;
  injectionSitePosition: string;
  testosteroneEster: string;
  carrierOil: string;
  painScore: string;
  mood: string;
  notes: string;
}

/** A brand-new form: today's date, everything else empty. Carried-forward values
 *  are layered on top by the caller. */
function freshDraft(): ShotDraft {
  return {
    date: todayLocalISO(),
    dateBaseline: todayLocalISO(),
    time: "",
    doseMg: "",
    injectionSite: "",
    injectionSitePosition: "",
    testosteroneEster: "",
    carrierOil: "",
    painScore: "",
    mood: "",
    notes: "",
  };
}

/**
 * What a save attempt actually did.
 *
 * Three outcomes, three values — deliberately not a boolean. A boolean forced
 * "storage refused this" and "I ignored you, the sheet is already closing" to
 * share `false`, and the form can only read that one way: it announced
 * "Couldn't save this shot" over a shot that had just saved perfectly, purely
 * because the second tap of a double-tap landed during the exit animation.
 * See CLAUDE.md — one value, one meaning. `undefined` still reads as `saved`,
 * so a caller that doesn't care (the form renders fine on its own) is unchanged.
 */
export type SaveOutcome =
  /** It reached storage. Clear the form. */
  | "saved"
  /** Storage refused the write. Keep every field and say so. */
  | "refused"
  /** Nothing was attempted. Change nothing on screen — least of all claim a failure. */
  | "ignored";

interface ShotFormProps {
  /** Returns what the save did; see {@link SaveOutcome}. `"refused"` keeps every
   *  field, so a failed write does not also erase what was typed. */
  onAddShot: (shot: ShotEntry) => void | SaveOutcome;
  onUpdateShot?: (shot: ShotEntry) => void | SaveOutcome;
  /**
   * Download a backup. Offered inside the sheet when a save fails, because from
   * there Settings is unreachable. Returns whether the download actually
   * started, so a browser that blocks it doesn't leave the button looking dead.
   * Optional only so the form stays renderable on its own in tests; App always
   * supplies it, and an App test proves it.
   */
  onExportBackup?: () => boolean;
  editingShot?: ShotEntry | null;
  /** Close the sheet. Never destructive: the parent keeps whatever was entered
   *  and restores it next time this same form is opened, for a new shot or an
   *  edit alike. Renders the ✕ in the top bar — omit it and the bar shows just
   *  the title. */
  onDismiss?: () => void;
  /** Past shots, used to suggest previously-entered values for reuse. */
  shots?: ShotEntry[];
  /** id for the form's heading, so a containing dialog can point
   *  `aria-labelledby` at it instead of repeating the title. */
  headingId?: string;
  /** An interrupted entry to restore, in either mode — the parent keeps new-shot
   *  and per-shot edit drafts separately and hands over whichever applies. Takes
   *  precedence over `editingShot`'s stored values, and every field of it —
   *  the date included — is restored exactly as it was left. */
  draft?: ShotDraft | null;
  /** Kept pointed at the in-progress values (or null when there is nothing worth
   *  keeping), so the parent can read them at the moment it decides whether a
   *  dismissal keeps or discards. A ref rather than a change callback: the parent
   *  asks, instead of being told and having to remember why. */
  liveDraftRef?: React.RefObject<ShotDraft | null>;
  /** Attached to the first field, so a containing dialog can put initial focus
   *  on data entry rather than on its own Close button. */
  firstFieldRef?: React.RefObject<HTMLInputElement | null>;
}

export const ShotForm: React.FC<ShotFormProps> = ({
  onAddShot,
  onUpdateShot,
  onExportBackup,
  editingShot,
  onDismiss,
  shots = [],
  headingId,
  draft,
  liveDraftRef,
  firstFieldRef,
}) => {
  // Values that genuinely stay the same shot-to-shot start pre-filled from the
  // last shot, so their field is already filled and their chip already selected.
  // Reading them from history (rather than holding them in component state
  // between saves) means they also survive closing the form, switching tabs, and
  // reloading the app — the form is now a sheet that unmounts on every save, so
  // in-component stickiness would silently do nothing.
  const carried = useMemo(() => carryForward(shots), [shots]);
  // Held in a ref so resetForm can stay identity-stable: if it changed whenever
  // `shots` changed, the editing-sync effect below would re-run and wipe fields
  // mid-typing.
  const carriedRef = useRef(carried);
  useEffect(() => {
    carriedRef.current = carried;
  });

  // Seeded from `editingShot` when there is one. The form mounts fresh each time
  // the sheet opens, so initialising to today + carried values and letting the
  // sync effect below correct them would paint one frame of the wrong shot —
  // today's date and the last shot's dose, flashing before the real values.
  // Precedence: the shot being edited, then a restored draft, then a fresh form
  // (today + carried-forward values). A draft only ever applies to a new shot.
  const initial = editingShot;
  // What the form would show with no draft: the shot being edited, or a fresh
  // form. Kept separately from `start` so "has unsaved input" always compares
  // against the underlying record, even when a draft was restored on top — which
  // is what lets a restored draft re-publish itself instead of reading as clean.
  const opened: ShotDraft = useMemo(
    () =>
      initial
        ? {
            date: initial.date,
            dateBaseline: initial.date,
            time: initial.time ?? "",
            doseMg: initial.doseMg?.toString() ?? "",
            injectionSite: initial.injectionSite ?? "",
            injectionSitePosition: initial.injectionSitePosition ?? "",
            testosteroneEster: initial.testosteroneEster ?? "",
            carrierOil: initial.carrierOil ?? "",
            painScore: initial.painScore?.toString() ?? "",
            mood: initial.mood ?? "",
            notes: initial.notes ?? "",
          }
        : { ...freshDraft(), ...carried },
    // Mount-time seed only; the component is remounted (via `key`) when the shot
    // being edited changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // A restored draft wins over both, and is restored as-is — no field is
  // re-derived, the date included. See ShotDraft.date.
  const start: ShotDraft = useMemo(
    () => draft ?? opened,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [date, setDate] = useState<string>(start.date);
  const [dateBaseline, setDateBaseline] = useState<string>(start.dateBaseline);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const [doseError, setDoseError] = useState<string | null>(null);
  const [painError, setPainError] = useState<string | null>(null);
  const [time, setTime] = useState<string>(start.time);
  const [doseMg, setDoseMg] = useState<string>(start.doseMg);
  const [injectionSite, setInjectionSite] = useState<string>(start.injectionSite);
  const [injectionSitePosition, setInjectionSitePosition] = useState<string>(
    start.injectionSitePosition
  );
  const [testosteroneEster, setTestosteroneEster] = useState<string>(
    start.testosteroneEster
  );
  const [carrierOil, setCarrierOil] = useState<string>(start.carrierOil);
  const [painScore, setPainScore] = useState<string>(start.painScore);
  const [mood, setMood] = useState<string>(start.mood);
  const [notes, setNotes] = useState<string>(start.notes);

  // Suggestions derived from past entries — one tap to reuse a value you've
  // logged before. Shot history is the single source; nothing extra is stored.
  const suggestions = useMemo(
    () => ({
      dose: suggestionsFor(shots, "doseMg").slice(0, 6),
      site: suggestionsFor(shots, "injectionSite").slice(0, 6),
      position: suggestionsFor(shots, "injectionSitePosition").slice(0, 6),
      ester: suggestionsFor(shots, "testosteroneEster").slice(0, 6),
      oil: suggestionsFor(shots, "carrierOil").slice(0, 6),
    }),
    [shots]
  );

  // A fresh, empty "Log a Shot" form. The single source of truth for what the
  // default form looks like, so the editing-sync effect and Cancel can't drift.
  // Stable (setters are stable), so it's safe in the effect's dependency list.
  const resetForm = useCallback(() => {
    setDate(todayLocalISO());
    // Reseeded, so the baseline moves with it. Leaving the baseline behind is
    // what let a form cleared after midnight treat a genuine backdate as no
    // change at all, and discard it on dismissal.
    setDateBaseline(todayLocalISO());
    setDateError(null);
    setDoseError(null);
    setPainError(null);
    // Clearing is starting over, so the failed-save state goes with the values it
    // referred to — including the button's label.
    setSaveFailed(false);
    setExportFailed(false);
    setTime("");
    setInjectionSite("");
    setInjectionSitePosition("");
    setPainScore("");
    setMood("");
    setNotes("");
    // Carried-forward fields reset to the last shot's values, not to empty.
    const { doseMg, testosteroneEster, carrierOil } = carriedRef.current;
    setDoseMg(doseMg);
    setTestosteroneEster(testosteroneEster);
    setCarrierOil(carrierOil);
    // "Clear form" is the only caller, and clearing makes it vanish (there is
    // nothing left to clear), so without this focus drops to <body> — inside an
    // OPEN dialog, where the Tab trap then cannot re-engage because it only wraps
    // from the first or last focusable.
    //
    // The heading, NOT the first field: that field is <input type="date">, and
    // focusing it from inside a click handler is exactly what makes iOS Safari and
    // Android Chrome throw up the date wheel — so a quiet "Clear form" link at the
    // bottom of the sheet would cover half the screen with a picker nobody asked
    // for. The heading summons no keyboard and no picker, names the region that
    // just changed for a screen reader, and keeps focus inside the trap.
    handOffFocus(headingRef);
  }, []);

  // NOTE: there is deliberately no "sync the form to editingShot" effect. The
  // state above is seeded once at mount, and the parent gives this component a
  // key that changes with the shot being edited, so switching shots remounts it
  // with a fresh seed. An effect doing the same job re-ran under StrictMode's
  // development double-invoke and wiped a restored draft; remounting is both
  // simpler and immune to that.

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // Every field is validated here, and the form carries `noValidate`, so the
    // browser never silently refuses to submit. It used to: a decimal dose or
    // pain score (or a pain score above 10) failed the native `step`/`max`
    // constraints, which cancels the submit event outright — the button appeared
    // to do nothing at all, with no message and nothing saved. Whatever we reject
    // now, we say why, next to the field.
    const parsedDate = toCivilDate(date);
    const parsedDose = doseMg === "" ? undefined : Number(doseMg);
    const parsedPain = painScore === "" ? undefined : Number(painScore);

    // Blank and malformed are different mistakes and get different words. A
    // blank date is almost always "meant to fill this in and forgot" — telling
    // that person their date is not a real calendar date is answering a question
    // they did not ask. The date is required precisely because a shot always
    // happened on some day, so the fix is to ask for it, not to let it through.
    const nextDateError = parsedDate
      ? null
      : date.trim() === ""
        ? "Add the date this shot was taken."
        : "Please enter a real calendar date (YYYY-MM-DD).";
    // Mirrors the storage schema: a finite, non-negative number. Fractional doses
    // are fine (62.5mg while titrating is ordinary).
    const nextDoseError =
      parsedDose !== undefined && (!Number.isFinite(parsedDose) || parsedDose < 0)
        ? "Dose must be a positive number."
        : null;
    // INTERIM — retires with the numeric pain input in slice B½, which replaces
    // it with None/Mild/Moderate/Severe chips (see the roadmap). It exists only
    // because the native step/max constraints were cancelling the submit event
    // silently, leaving a dead Save button. Don't build on it.
    //
    // Mirrors the schema, which stores pain as a whole number 0–10 — so a decimal
    // must be refused rather than saved, or the entry would fail to re-import
    // from its own backup.
    const nextPainError =
      parsedPain !== undefined &&
      (!Number.isInteger(parsedPain) || parsedPain < 0 || parsedPain > 10)
        ? "Pain must be a whole number from 0 to 10."
        : null;

    setDateError(nextDateError);
    setDoseError(nextDoseError);
    setPainError(nextPainError);
    // `!parsedDate` is implied by nextDateError, but stating it narrows the type
    // so the branded CivilDate below can't be null.
    if (nextDateError || nextDoseError || nextPainError || !parsedDate) return;

    const newShot: ShotEntry = {
      id: editingShot ? editingShot.id : newId(),
      // Store the parsed CivilDate, not the raw input, so the value written to
      // storage is the one the boundary validated — the parser's result is the
      // trust boundary, not just a yes/no gate.
      date: parsedDate,
      time: time || undefined,
      doseMg: parsedDose,
      injectionSite: injectionSite || undefined,
      injectionSitePosition: injectionSitePosition || undefined,
      testosteroneEster: testosteroneEster || undefined,
      carrierOil: carrierOil || undefined,
      painScore: parsedPain,
      mood: mood || undefined,
      notes: notes || undefined,
    };

    const outcome =
      editingShot && onUpdateShot ? onUpdateShot(newShot) : onAddShot(newShot);

    // The sheet is already leaving and this submit was dropped. Say nothing: the
    // shot the user is actually thinking about was saved by the press before
    // this one, and an assertive alert claiming otherwise sends them to log it
    // again — a duplicate, with no undo until slice C.
    if (outcome === "ignored") return;

    // A save that did not reach storage must leave the form exactly as it is.
    // Otherwise the sheet stays open (the parent holds it) showing empty fields,
    // which is worse than closing: the entry is neither on screen nor stored.
    //
    // It must also SAY so, here, inside the sheet. The storage banner is the
    // app's single surface for failed writes, but it lives in `#root`, which the
    // sheet marks `inert` and covers completely on a phone — so for the one
    // failure the user is actually watching for, the banner is unreadable,
    // unannounced, and its buttons unclickable until the sheet is gone. Without
    // this line the whole flow is: tap Save, nothing happens, no explanation.
    if (outcome === "refused") {
      setSaveFailed(true);
      return;
    }
    setSaveFailed(false);

    // Clear the per-shot fields. The carried-forward ones (dose, type of T,
    // carrier oil) are deliberately left alone: they re-derive from the shot just
    // saved via carryForward the next time the form mounts. Normally the parent
    // closes the sheet right after a save and this reset is moot, but it keeps
    // the form correct for any caller that keeps it mounted.
    if (!editingShot) {
      setTime("");
      setInjectionSite("");
      setInjectionSitePosition("");
      setPainScore("");
      setMood("");
      setNotes("");
    }
  };

  const current: ShotDraft = {
    date,
    dateBaseline,
    time,
    doseMg,
    injectionSite,
    injectionSitePosition,
    testosteroneEster,
    carrierOil,
    painScore,
    mood,
    notes,
  };

  // Anything the user has entered that isn't in the underlying record yet —
  // measured against `opened` (the shot being edited, or a fresh form), never
  // against a restored draft, so restoring and re-parking doesn't read as clean.
  // Applies in both modes: editing an existing shot has unsaved input too.
  //
  // The date is compared against its own baseline rather than against `opened`,
  // because a required, always-populated field has no "empty" to mean "nothing
  // entered". Every other field can use that test directly.
  const hasUnsavedInput =
    date !== dateBaseline ||
    (Object.keys(current) as (keyof ShotDraft)[])
      .filter((k) => k !== "date" && k !== "dateBaseline")
      .some((k) => current[k] !== opened[k]);

  // Whether the form currently shows exactly what a brand-new one would, right
  // now — today's date and nothing beyond the carried-forward values.
  const looksFresh =
    date === todayLocalISO() &&
    (Object.keys(current) as (keyof ShotDraft)[])
      .filter((k) => k !== "date" && k !== "dateBaseline")
      .every((k) => current[k] === opened[k]);

  // Publish the live values for the parent to read on dismissal. In an effect
  // rather than during render so the render stays pure; effects run after every
  // render, so the ref is current well before any click or keypress.
  useEffect(() => {
    if (!liveDraftRef) return;
    // Published verbatim — no field is special-cased on the way out, so there is
    // no encoding here for the reader above to get wrong.
    liveDraftRef.current = hasUnsavedInput ? current : null;
  });

  return (
    // Three regions: a pinned bar, the scrolling fields, and a pinned action.
    // Save must stay reachable without scrolling past ten fields, and Close sits
    // top-left — away from the thumb, so it isn't hit by accident.
    <form className="shot-form" onSubmit={handleSubmit} noValidate>
      <div className="shot-form__bar shot-form__bar--top">
        {onDismiss && (
          <button
            type="button"
            className="shot-form__close"
            onClick={onDismiss}
            aria-label={editingShot ? "Cancel editing" : "Close"}
          >
            ✕
          </button>
        )}
        {/* Focusable only as the target "Clear form" hands to — see resetForm. */}
        <h2
          id={headingId}
          className="shot-form__title"
          ref={headingRef}
          tabIndex={-1}
        >
          {editingShot ? "Edit shot" : "Log a shot"}
        </h2>
      </div>

      <div className="shot-form__scroll">

      <div className="form-row">
        {/* The error is a SIBLING of the label, never inside it: text inside a
            <label> becomes part of the field's accessible name, so an error
            message there would rename the field to "Date <the whole error>".
            aria-describedby is how it reaches assistive tech. */}
        <div className="field-cell">
          <label>
            Date
            <input
              ref={firstFieldRef}
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
// Nothing to record here: the baseline already says what
                // "untouched" means, so the comparison below answers it.
                if (dateError) setDateError(null);
              }}
              required
              aria-invalid={dateError ? true : undefined}
              aria-describedby={dateError ? "date-error" : undefined}
            />
          </label>
          {dateError && (
            <span id="date-error" className="field-error" role="alert">
              {dateError}
            </span>
          )}
        </div>

        <div className="field-cell">
          <label>
            Time
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <div className="suggestion-chips">
            <button
              type="button"
              className="chip"
              onClick={() => setTime(nowHHMM())}
            >
              Now
            </button>
          </div>
        </div>
      </div>

      <div className="form-row">
        <div className="field-cell">
          <label>
            Dose (mg)
            <input
              type="number"
              min={0}
              // "any", not 1: fractional doses are ordinary (62.5mg, 12.5mg when
              // titrating), doseMg is a float in the model, and the field already
              // declares inputMode="decimal". With step=1 the browser silently
              // refused to submit a decimal dose — constraint validation blocks
              // the submit event, so the form just appeared to do nothing.
              step="any"
              inputMode="decimal"
              value={doseMg}
              onChange={(e) => setDoseMg(e.target.value)}
              placeholder="e.g. 50"
              aria-invalid={doseError ? true : undefined}
              aria-describedby={doseError ? "dose-error" : undefined}
            />
          </label>
          {doseError && (
            <span id="dose-error" className="field-error" role="alert">
              {doseError}
            </span>
          )}
          <SuggestionChips
            label="dose"
            suggestions={suggestions.dose}
            value={doseMg}
            onSelect={setDoseMg}
          />
        </div>

        <div className="field-cell">
          <label>
            Injection site
            <input
              type="text"
              value={injectionSite}
              onChange={(e) => setInjectionSite(e.target.value)}
              placeholder="e.g. thigh, glute, stomach"
            />
          </label>
          <SuggestionChips
            label="injection site"
            suggestions={suggestions.site}
            value={injectionSite}
            onSelect={setInjectionSite}
          />
        </div>

        <div className="field-cell">
          <label>
            Position
            <input
              type="text"
              value={injectionSitePosition}
              onChange={(e) => setInjectionSitePosition(e.target.value)}
              placeholder="e.g. left, right, upper left"
            />
          </label>
          <SuggestionChips
            label="position"
            suggestions={suggestions.position}
            value={injectionSitePosition}
            onSelect={setInjectionSitePosition}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="field-cell">
          <label>
            Type of T
            <input
              type="text"
              value={testosteroneEster}
              onChange={(e) => setTestosteroneEster(e.target.value)}
              placeholder="e.g. cypionate, enanthate, undecanoate"
            />
          </label>
          <SuggestionChips
            label="testosterone type"
            suggestions={suggestions.ester}
            value={testosteroneEster}
            onSelect={setTestosteroneEster}
          />
        </div>

        <div className="field-cell">
          <label>
            Carrier oil
            <input
              type="text"
              value={carrierOil}
              onChange={(e) => setCarrierOil(e.target.value)}
              placeholder="e.g. cottonseed, sesame"
            />
          </label>
          <SuggestionChips
            label="carrier oil"
            suggestions={suggestions.oil}
            value={carrierOil}
            onSelect={setCarrierOil}
          />
        </div>
      </div>

      <div className="form-row">
        {/* Wrapped like the date and dose fields: .form-row is a flex row, so an
            unwrapped error span becomes a third flex item and squeezes a text
            column in between Pain and Mood. */}
        <div className="field-cell">
          <label>
            Pain (0–10)
          <input
            type="number"
            min={0}
            max={10}
            step={1}
            inputMode="numeric"
            value={painScore}
            onChange={(e) => setPainScore(e.target.value)}
            placeholder="e.g. 3"
            aria-invalid={painError ? true : undefined}
            aria-describedby={painError ? "pain-error" : undefined}
          />
          </label>
          {painError && (
            <span id="pain-error" className="field-error" role="alert">
              {painError}
            </span>
          )}
        </div>

        <label>
          Mood
          <input
            type="text"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder="e.g. low, okay, good"
          />
        </label>
      </div>

      <label className="form-column">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Pain, mood, anything you want to remember for later..."
        />
      </label>

        {/* Closing keeps what you typed, so discarding needs its own control —
            but a quiet one, at the end of the fields rather than competing with
            Save. Only offered once there is something to clear.
            `looksFresh` covers the case where the form reports unsaved input but
            shows nothing a fresh form wouldn't: a date chosen yesterday can be
            today by the time the draft is reopened. Offering "Clear form" there
            invites a tap that visibly does nothing. This decides only what is
            RENDERED — never what is parked or saved — so unlike the dirtiness
            rules it is safe to judge against the live clock. */}
        {hasUnsavedInput && !editingShot && !looksFresh && (
          <button type="button" className="link-button" onClick={resetForm}>
            Clear form
          </button>
        )}
      </div>

      <div className="shot-form__bar shot-form__bar--bottom">
        {/* Above the button, so it is between what you pressed and where you
            pressed it, and inside the dialog so the focus trap can reach it and
            a screen reader announces it. */}
        {saveFailed && (
          <div className="shot-form__save-error" role="alert">
            <p className="shot-form__save-error-text">
              <strong>Couldn’t save this shot.</strong> Storage may be full, or
              private browsing may be blocking it. Nothing you typed has been
              lost.
            </p>
            {/* The button is HERE rather than a sentence pointing at Settings.
                Retrying is the only other move, and on a genuinely full device
                it will keep failing — so telling someone to go and export, from
                a sheet that covers Settings and cannot be left without closing
                the form, is advice they cannot take at the moment they need it. */}
            <button
              type="button"
              className="shot-form__save-error-export"
              // `?? false` so an unwired handler counts as a failure rather than
              // a success. `=== false` read `undefined` as fine, which made the
              // button silently dead — the exact thing this panel exists to stop.
              onClick={() => setExportFailed(!(onExportBackup?.() ?? false))}
            >
              Export a backup
            </button>
            {/* Said plainly, because the reassuring reading is the wrong one: the
                file is built from what has been saved, and this shot deliberately
                has not been. It protects the history, not the entry on screen —
                that is what holding the form open is for. */}
            <p className="shot-form__save-error-fine">
              {exportFailed
                ? "The download didn’t start — the browser may be blocking it, or there may be no space left."
                : "Saves your logged shots to a file. This one isn’t in it yet — it stays on screen until it saves."}
            </p>
          </div>
        )}
        {/* Relabels after a refused write, and stays relabelled until the save
            lands: "Save shot" would be naming an outcome the previous press did
            not produce. This button IS the retry — the form deliberately has no
            second one, since two controls submitting the same form only make you
            choose between them.

            "Save again" rather than the banner's "Try again", which was the first
            attempt. A button label's one job is to say what pressing it does, and
            a bare "Try again" drops the verb: read on its own — which is exactly
            how a screen reader offers it in a list of buttons — it could be
            retrying anything. Both halves are built from the same verb here so
            they cannot drift into naming different actions.

            The label reverts on its own everywhere the form starts over:
            `saveFailed` is component state, and App keys this form by the shot
            being edited inside a sheet that unmounts on close — so a new entry, a
            different shot, "Clear form" and a reload each get a fresh one. There
            is nothing to persist and nothing to time out. */}
        <button type="submit" className="primary-button shot-form__save">
          {`${editingShot ? "Update" : "Save"} ${saveFailed ? "again" : "shot"}`}
        </button>
      </div>
    </form>
  );
};
