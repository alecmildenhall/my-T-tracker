// src/components/ShotForm.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { ShotEntry } from "../types/shot";
import { suggestionsFor } from "../utils/suggestions";
import { todayLocalISO, nowHHMM } from "../utils/datetime";
import { toCivilDate } from "../utils/civilDate";
import { newId } from "../utils/id";
import { SuggestionChips } from "./SuggestionChips";

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
  date: string;
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

interface ShotFormProps {
  onAddShot: (shot: ShotEntry) => void;
  onUpdateShot?: (shot: ShotEntry) => void;
  editingShot?: ShotEntry | null;
  /** Close the sheet. For a new shot this KEEPS the draft (reopening restores
   *  it); while editing it abandons the unsaved changes. Renders the ✕ in the
   *  top bar — omit it and the bar shows just the title. */
  onDismiss?: () => void;
  /** Past shots, used to suggest previously-entered values for reuse. */
  shots?: ShotEntry[];
  /** id for the form's heading, so a containing dialog can point
   *  `aria-labelledby` at it instead of repeating the title. */
  headingId?: string;
  /** A previously interrupted new-shot entry to restore. Ignored while editing. */
  draft?: ShotDraft | null;
  /** Kept pointed at the in-progress values (or null when there is nothing worth
   *  keeping), so the parent can read them at the moment it decides whether a
   *  dismissal keeps or discards. A ref rather than a change callback: the parent
   *  asks, instead of being told and having to remember why. */
  liveDraftRef?: React.RefObject<ShotDraft | null>;
  /** Attached to the first field, so a containing dialog can put initial focus
   *  on data entry rather than on its own Close button. */
  firstFieldRef?: React.Ref<HTMLInputElement>;
}

export const ShotForm: React.FC<ShotFormProps> = ({
  onAddShot,
  onUpdateShot,
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
  const start: ShotDraft = useMemo(
    () =>
      initial
        ? {
            date: initial.date,
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
        : draft ?? { ...freshDraft(), ...carried },
    // Mount-time seed only; later changes flow through the sync effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [date, setDate] = useState<string>(start.date);
  const [dateError, setDateError] = useState<string | null>(null);
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
    setDateError(null);
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
  }, []);

  // NOTE: there is deliberately no "sync the form to editingShot" effect. The
  // state above is seeded once at mount, and the parent gives this component a
  // key that changes with the shot being edited, so switching shots remounts it
  // with a fresh seed. An effect doing the same job re-ran under StrictMode's
  // development double-invoke and wiped a restored draft; remounting is both
  // simpler and immune to that.

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // Parse the date at the entry boundary. A native date picker only ever emits
    // a valid YYYY-MM-DD (or empty, caught by `required`), so this rarely fires —
    // but a text-field fallback (older browsers) or a paste could produce an
    // impossible date. Surface it inline rather than silently accepting or
    // dropping it, and block the save.
    const parsedDate = toCivilDate(date);
    if (!parsedDate) {
      setDateError("Please enter a real calendar date (YYYY-MM-DD).");
      return;
    }
    setDateError(null);

    const newShot: ShotEntry = {
      id: editingShot ? editingShot.id : newId(),
      // Store the parsed CivilDate, not the raw input, so the value written to
      // storage is the one the boundary validated — the parser's result is the
      // trust boundary, not just a yes/no gate.
      date: parsedDate,
      time: time || undefined,
      doseMg: doseMg ? Number(doseMg) : undefined,
      injectionSite: injectionSite || undefined,
      injectionSitePosition: injectionSitePosition || undefined,
      testosteroneEster: testosteroneEster || undefined,
      carrierOil: carrierOil || undefined,
      painScore: painScore ? Number(painScore) : undefined,
      mood: mood || undefined,
      notes: notes || undefined,
    };

    if (editingShot && onUpdateShot) {
      onUpdateShot(newShot);
    } else {
      onAddShot(newShot);
    }

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

  // Whether anything has been typed beyond the values the form opened with.
  // Drives both the low-key "Clear form" escape hatch below and what the parent
  // sees as a restorable draft — one definition, so they can't disagree. An
  // untouched form is not a draft, so carried-forward values alone never
  // resurrect a sheet.
  const baseline: ShotDraft = { ...freshDraft(), ...carried };
  const dirty =
    !editingShot &&
    (Object.keys(current) as (keyof ShotDraft)[]).some(
      (k) => current[k] !== baseline[k]
    );

  // Publish the live values for the parent to read on dismissal. In an effect
  // rather than during render so the render stays pure; effects run after every
  // render, so the ref is current well before any click or keypress.
  useEffect(() => {
    if (liveDraftRef) liveDraftRef.current = dirty ? current : null;
  });

  return (
    // Three regions: a pinned bar, the scrolling fields, and a pinned action.
    // Save must stay reachable without scrolling past ten fields, and Close sits
    // top-left — away from the thumb, so it isn't hit by accident.
    <form className="shot-form" onSubmit={handleSubmit}>
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
        <h2 id={headingId} className="shot-form__title">
          {editingShot ? "Edit shot" : "Log a shot"}
        </h2>
      </div>

      <div className="shot-form__scroll">

      <div className="form-row">
        <label>
          Date
          <input
            ref={firstFieldRef}
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              if (dateError) setDateError(null);
            }}
            required
            aria-invalid={dateError ? true : undefined}
            aria-describedby={dateError ? "date-error" : undefined}
          />
          {dateError && (
            <span id="date-error" className="field-error" role="alert">
              {dateError}
            </span>
          )}
        </label>

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
              step={1}
              inputMode="decimal"
              value={doseMg}
              onChange={(e) => setDoseMg(e.target.value)}
              placeholder="e.g. 50"
            />
          </label>
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
          />
        </label>

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
            Save. Only offered once there is something to clear. */}
        {dirty && (
          <button type="button" className="link-button" onClick={resetForm}>
            Clear form
          </button>
        )}
      </div>

      <div className="shot-form__bar shot-form__bar--bottom">
        <button type="submit" className="primary-button shot-form__save">
          {editingShot ? "Update shot" : "Save shot"}
        </button>
      </div>
    </form>
  );
};
