// src/App.tsx
import React, { useState } from "react";
import { ShotForm } from "./components/ShotForm";
import { ShotList } from "./components/ShotList";
import { useShots } from "./hooks/useShots";
import type { ShotEntry } from "./types/shot";

const App: React.FC = () => {
  const { shots, addShot, updateShot, deleteShot } = useShots();
  const [editingShot, setEditingShot] = useState<ShotEntry | null>(null);

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
        <h1>HRT Shot Tracker</h1>
        <p className="app-tagline">
          Log testosterone (HRT) shots and how they feel — privately, on your
          device.
        </p>
        <p className="app-privacy-note">
          This MVP stores data only in your browser&apos;s local storage. No
          accounts, no analytics, no servers.
        </p>
      </header>

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
