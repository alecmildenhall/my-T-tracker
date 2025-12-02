// src/components/ShotForm.tsx
import React, { useState } from "react";
import type { ShotEntry } from "../types/shot";

interface ShotFormProps {
  onAddShot: (shot: ShotEntry) => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export const ShotForm: React.FC<ShotFormProps> = ({ onAddShot }) => {
  const [date, setDate] = useState<string>(todayISO());
  const [time, setTime] = useState<string>("");
  const [doseMg, setDoseMg] = useState<string>("");
  const [injectionSite, setInjectionSite] = useState<string>("");
  const [painScore, setPainScore] = useState<string>("5");
  const [mood, setMood] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const newShot: ShotEntry = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
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

    onAddShot(newShot);

    // reset (keep date so you can log multiple shots for same day easily)
    setTime("");
    setDoseMg("");
    setInjectionSite("");
    setPainScore("5");
    setMood("");
    setNotes("");
  };

  return (
    <form className="shot-form" onSubmit={handleSubmit}>
      <h2>Log a Shot</h2>

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
        Save shot
      </button>
    </form>
  );
};
