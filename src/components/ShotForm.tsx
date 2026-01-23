// src/components/ShotForm.tsx
import React, { useState, useEffect } from "react";
import type { ShotEntry } from "../types/shot";

interface ShotFormProps {
  onAddShot: (shot: ShotEntry) => void;
  onUpdateShot?: (shot: ShotEntry) => void;
  editingShot?: ShotEntry | null;
  onCancelEdit?: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export const ShotForm: React.FC<ShotFormProps> = ({
  onAddShot,
  onUpdateShot,
  editingShot,
  onCancelEdit,
}) => {
  const [date, setDate] = useState<string>(todayISO());
  const [time, setTime] = useState<string>("");
  const [doseMg, setDoseMg] = useState<string>("");
  const [injectionSite, setInjectionSite] = useState<string>("");
  const [painScore, setPainScore] = useState<string>("5");
  const [mood, setMood] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Populate form when editing
  useEffect(() => {
    if (editingShot) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setDate(editingShot.date);
      setTime(editingShot.time || "");
      setDoseMg(editingShot.doseMg?.toString() || "");
      setInjectionSite(editingShot.injectionSite || "");
      setPainScore(editingShot.painScore?.toString() || "5");
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
      painScore: painScore ? Number(painScore) : undefined,
      mood: mood || undefined,
      notes: notes || undefined,
    };

    if (editingShot && onUpdateShot) {
      onUpdateShot(newShot);
    } else {
      onAddShot(newShot);
    }

    // reset (keep date so you can log multiple shots for same day easily)
    if (!editingShot) {
      setTime("");
      setDoseMg("");
      setInjectionSite("");
      setPainScore("5");
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
    setPainScore("5");
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

        <label>
          Time
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
      </div>

      <div className="form-row">
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

        <label>
          Injection site
          <input
            type="text"
            value={injectionSite}
            onChange={(e) => setInjectionSite(e.target.value)}
            placeholder="e.g. thigh, glute, stomach"
          />
        </label>
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
