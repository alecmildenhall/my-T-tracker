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

interface ShotFormProps {
  onAddShot: (shot: ShotEntry) => void;
  onUpdateShot?: (shot: ShotEntry) => void;
  editingShot?: ShotEntry | null;
  onCancelEdit?: () => void;
  /** Past shots, used to suggest previously-entered values for reuse. */
  shots?: ShotEntry[];
  /** id for the form's heading, so a containing dialog can point
   *  `aria-labelledby` at it instead of repeating the title. */
  headingId?: string;
}

export const ShotForm: React.FC<ShotFormProps> = ({
  onAddShot,
  onUpdateShot,
  editingShot,
  onCancelEdit,
  shots = [],
  headingId,
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

  const [date, setDate] = useState<string>(todayLocalISO());
  const [dateError, setDateError] = useState<string | null>(null);
  const [time, setTime] = useState<string>("");
  const [doseMg, setDoseMg] = useState<string>(() => carried.doseMg);
  const [injectionSite, setInjectionSite] = useState<string>("");
  const [injectionSitePosition, setInjectionSitePosition] = useState<string>("");
  const [testosteroneEster, setTestosteroneEster] = useState<string>(
    () => carried.testosteroneEster
  );
  const [carrierOil, setCarrierOil] = useState<string>(() => carried.carrierOil);
  const [painScore, setPainScore] = useState<string>("");
  const [mood, setMood] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

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

  // Keep the form in sync with the shot being edited. Populate its fields while
  // editing; clear back to a fresh "Log a Shot" form when editing ends — which
  // includes the shot vanishing out from under us (deleted from the list, or
  // wiped by a backup import, so the parent drops it to null). Without the reset
  // the deleted shot's values would linger in what is now the new-shot form, and
  // saving would silently recreate the entry the user just removed.
  useEffect(() => {
    if (editingShot) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setDate(editingShot.date);
      setTime(editingShot.time || "");
      setDoseMg(editingShot.doseMg?.toString() || "");
      setInjectionSite(editingShot.injectionSite || "");
      setInjectionSitePosition(editingShot.injectionSitePosition || "");
      setTestosteroneEster(editingShot.testosteroneEster || "");
      setCarrierOil(editingShot.carrierOil || "");
      setPainScore(editingShot.painScore?.toString() ?? "");
      setMood(editingShot.mood || "");
      setNotes(editingShot.notes || "");
      /* eslint-enable react-hooks/set-state-in-effect */
    } else {
      resetForm();
    }
  }, [editingShot, resetForm]);

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

  const handleCancel = () => {
    onCancelEdit?.();
    // The editing-sync effect also resets once onCancelEdit clears editingShot;
    // resetting here too keeps ShotForm self-contained if a parent's onCancelEdit
    // doesn't drop the edit.
    resetForm();
  };

  return (
    <form className="shot-form" onSubmit={handleSubmit}>
      <h2 id={headingId}>{editingShot ? "Edit shot" : "Log a shot"}</h2>

      <div className="form-row">
        <label>
          Date
          <input
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

      <button type="submit" className="primary-button">
        {editingShot ? "Update shot" : "Save shot"}
      </button>
      {editingShot && onCancelEdit && (
        <button
          type="button"
          className="secondary-button"
          onClick={handleCancel}
        >
          Cancel
        </button>
      )}
    </form>
  );
};
