// src/components/ShotForm.tsx
import React, { useState, useEffect, useMemo } from "react";
import type { ShotEntry } from "../types/shot";
import { suggestionsFor } from "../utils/suggestions";
import { SuggestionChips } from "./SuggestionChips";

interface ShotFormProps {
  onAddShot: (shot: ShotEntry) => void;
  onUpdateShot?: (shot: ShotEntry) => void;
  editingShot?: ShotEntry | null;
  onCancelEdit?: () => void;
  /** Past shots, used to suggest previously-entered values for reuse. */
  shots?: ShotEntry[];
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const nowHHMM = () => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

export const ShotForm: React.FC<ShotFormProps> = ({
  onAddShot,
  onUpdateShot,
  editingShot,
  onCancelEdit,
  shots = [],
}) => {
  const [date, setDate] = useState<string>(todayISO());
  const [time, setTime] = useState<string>("");
  const [doseMg, setDoseMg] = useState<string>("");
  const [injectionSite, setInjectionSite] = useState<string>("");
  const [injectionSitePosition, setInjectionSitePosition] = useState<string>("");
  const [testosteroneEster, setTestosteroneEster] = useState<string>("");
  const [carrierOil, setCarrierOil] = useState<string>("");
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

  // Populate form when editing
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
    }
  }, [editingShot]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const newShot: ShotEntry = {
      id: editingShot
        ? editingShot.id
        : typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `shot-${Date.now()}`,
      date,
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

    // Reset for the next shot. Keep only the values that genuinely stay the same
    // shot-to-shot — dose, type of T, carrier oil — so their field stays filled
    // and their chip stays selected, with no re-tapping. Everything else clears,
    // including injection site/position (commonly rotated). Within a single shot
    // nothing clears until save, so a value you just typed never needs
    // re-selecting on the shot you're on. Keep the date for quick same-day logs.
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
    if (onCancelEdit) {
      onCancelEdit();
    }
    // Reset form to default values
    setDate(todayISO());
    setTime("");
    setDoseMg("");
    setInjectionSite("");
    setInjectionSitePosition("");
    setTestosteroneEster("");
    setCarrierOil("");
    setPainScore("");
    setMood("");
    setNotes("");
  };

  return (
    <form className="shot-form" onSubmit={handleSubmit}>
      <h2>{editingShot ? "Edit Shot" : "Log a Shot"}</h2>

      <div className="form-row">
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
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
