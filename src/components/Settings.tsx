// src/components/Settings.tsx
import React from "react";
import type { ShotEntry } from "../types/shot";
import type { TextField } from "../utils/suggestions";
import { ManageValues } from "./ManageValues";
import { DataManagement } from "./DataManagement";

interface SettingsProps {
  shots: ShotEntry[];
  onRenameValue: (field: TextField, from: string, to: string) => void;
  onClearValue: (field: TextField, value: string) => void;
  onReplaceAll: (next: ShotEntry[]) => void;
  onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  shots,
  onRenameValue,
  onClearValue,
  onReplaceAll,
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

    <div className="settings-section">
      <h3 className="settings-section__title">Your data</h3>
      <p className="settings-section__desc">
        Export a backup to move or restore your entries, or a CSV to share with a
        provider. Importing a backup replaces what&apos;s on this device.
      </p>
      <DataManagement shots={shots} onReplaceAll={onReplaceAll} />
    </div>
  </section>
);
