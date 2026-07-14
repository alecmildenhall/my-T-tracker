// src/App.tsx
import React, { useState } from "react";
import { ShotForm } from "./components/ShotForm";
import { ShotList } from "./components/ShotList";
import { Settings } from "./components/Settings";
import { useShots } from "./hooks/useShots";
import type { ShotEntry } from "./types/shot";

const App: React.FC = () => {
  const {
    shots,
    addShot,
    updateShot,
    deleteShot,
    renameValue,
    clearValue,
    replaceAll,
  } = useShots();
  const [editingShot, setEditingShot] = useState<ShotEntry | null>(null);
  const [view, setView] = useState<"log" | "settings">("log");

  const handleEditShot = (shot: ShotEntry) => {
    setEditingShot(shot);
    // Scroll to top so the form is visible
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleUpdateShot = (shot: ShotEntry) => {
    updateShot(shot.id, shot);
    setEditingShot(null);
  };

  const handleCancelEdit = () => {
    setEditingShot(null);
  };

  const handleReplaceAll = (next: ShotEntry[]) => {
    // Restoring a backup swaps the whole list, so any in-progress edit points at
    // a shot that may no longer exist. Drop it so a later Save can't silently
    // no-op against a missing id.
    setEditingShot(null);
    replaceAll(next);
  };

  return (
    <div className="app-root">
      <header className="app-header">
        {view === "log" && (
          <button
            type="button"
            className="settings-button"
            aria-label="Settings"
            onClick={() => setView("settings")}
          >
            ⚙
          </button>
        )}
        <h1>T-Shot Tracker</h1>
        <p className="app-tagline">
          Log testosterone (HRT) shots and how they feel — privately, on your
          device.
        </p>
        <p className="app-privacy-note">
          This MVP stores data only in your browser&apos;s local storage. No
          accounts, no analytics, no servers.
        </p>
      </header>

      {view === "log" ? (
        <main className="app-main">
          <ShotForm
            onAddShot={addShot}
            onUpdateShot={handleUpdateShot}
            editingShot={editingShot}
            onCancelEdit={handleCancelEdit}
            shots={shots}
          />
          <ShotList
            shots={shots}
            onDeleteShot={deleteShot}
            onEditShot={handleEditShot}
          />
        </main>
      ) : (
        <Settings
          shots={shots}
          onRenameValue={renameValue}
          onClearValue={clearValue}
          onReplaceAll={handleReplaceAll}
          onBack={() => setView("log")}
        />
      )}

      <footer className="app-footer">
        <small>
          Built with trans safety and privacy in mind. See LICENSE and
          CODE_OF_CONDUCT for details.
        </small>
      </footer>
    </div>
  );
};

export default App;
