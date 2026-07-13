// src/components/Settings.tsx
import React from "react";
import type { ShotEntry } from "../types/shot";
import type { TextField } from "../utils/suggestions";
import { ManageValues } from "./ManageValues";

interface SettingsProps {
  shots: ShotEntry[];
  onRenameValue: (field: TextField, from: string, to: string) => void;
  onClearValue: (field: TextField, value: string) => void;
  onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  shots,
  onRenameValue,
  onClearValue,
  onBack,
}) => (
  <section className="settings">
    <div className="settings-header">
      <button type="button" className="secondary-button" onClick={onBack}>
        ← Back
      </button>
      <h2>Settings</h2>
    </div>

    <div className="settings-section">
      <h3 className="settings-section__title">Saved values</h3>
      <p className="settings-section__desc">
        Rename or remove the values suggested while logging. Changes update your
        past entries too.
      </p>
      <ManageValues
        shots={shots}
        onRenameValue={onRenameValue}
        onClearValue={onClearValue}
      />
    </div>
  </section>
);
