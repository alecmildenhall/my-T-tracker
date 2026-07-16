// src/App.tsx
import React, { useMemo, useState } from "react";
import { ShotForm } from "./components/ShotForm";
import { ShotList } from "./components/ShotList";
import { Settings } from "./components/Settings";
import { useShotsContext } from "./context/ShotsContext";
import type { ShotEntry } from "./types/shot";

const App: React.FC = () => {
  const { shots, addShot, updateShot, deleteShot } = useShotsContext();
  const [editingShot, setEditingShot] = useState<ShotEntry | null>(null);
  const [view, setView] = useState<"log" | "settings">("log");

  // Only edit a shot that still exists. If the one being edited disappears —
  // deleted from the list, or wiped by a backup import — editing ends on its own
  // instead of a later Save silently no-op'ing against a missing id. Declarative,
  // so it covers every way the list can change.
  const activeEditingShot = useMemo(
    () =>
      editingShot && shots.some((s) => s.id === editingShot.id)
        ? editingShot
        : null,
    [editingShot, shots]
  );

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
            editingShot={activeEditingShot}
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
        <Settings onBack={() => setView("log")} />
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
