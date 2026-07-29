// src/App.tsx
import React, { useRef, useState } from "react";
import { ShotForm } from "./components/ShotForm";
import { Settings } from "./components/Settings";
import { Greeting } from "./components/Greeting";
import { TabBar } from "./components/TabBar";
import { RecentShots } from "./components/RecentShots";
import { HistoryView } from "./components/HistoryView";
import { emptyHistoryQuery, type HistoryQuery } from "./utils/historyQuery";
import { Modal } from "./components/Modal";
import { useBackToClose } from "./hooks/useBackToClose";
import { useShotsContext } from "./context/ShotsContext";
import type { ShotEntry } from "./types/shot";
import type { View } from "./types/view";

const SHEET_HEADING_ID = "shot-sheet-title";

const VIEW_TITLES: Record<View, string> = {
  home: "T-Shot Tracker",
  history: "History",
  settings: "Settings",
};

const App: React.FC = () => {
  const { shots, addShot, updateShot, deleteShot } = useShotsContext();
  const [editingShot, setEditingShot] = useState<ShotEntry | null>(null);
  // The log form is a sheet rather than an always-open panel on Home, so the
  // greeting, the primary action, and the recent teaser all fit above the fold.
  const [loggingNew, setLoggingNew] = useState(false);
  // Always starts on Home — never "last tab used". Logging is the primary
  // action, and reopening the app never lands on a data view in public.
  const [view, setView] = useState<View>("home");
  // Lifted so a trip to Home and back keeps the filter you were using. Session
  // only: deliberately not persisted, so a fresh launch is never pre-filtered.
  const [historyQuery, setHistoryQuery] =
    useState<HistoryQuery>(emptyHistoryQuery);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Only edit a shot that still exists. If the one being edited disappears —
  // deleted from the list, or wiped by a backup import — editing ends on its own
  // instead of a later Save silently no-op'ing against a missing id.
  //
  // The dropped edit is *released*, not merely masked: leaving it in state would
  // mean that if the id ever came back (importing a backup containing it again)
  // the sheet would spring open unprompted over whatever tab is showing,
  // pre-filled with pre-import values, and saving would overwrite the restored
  // entry. Adjusted during render — React's documented pattern for state that
  // needs to follow changing data — so the stale value is never committed and
  // there's no flash of a sheet that is about to close.
  const editedShotExists =
    editingShot !== null && shots.some((s) => s.id === editingShot.id);
  if (editingShot !== null && !editedShotExists) {
    setEditingShot(null);
  }
  const activeEditingShot = editedShotExists ? editingShot : null;

  const sheetOpen = loggingNew || activeEditingShot !== null;

  const closeSheet = () => {
    setLoggingNew(false);
    setEditingShot(null);
  };

  // On Android, Back with the sheet open would otherwise leave the app and take
  // the half-filled form with it. Sheet only — Back from a tab still exits, since
  // tabs (not history) are how you move between destinations here.
  useBackToClose(sheetOpen, closeSheet);

  const handleAddShot = (shot: ShotEntry) => {
    addShot(shot);
    closeSheet();
  };

  const handleUpdateShot = (shot: ShotEntry) => {
    updateShot(shot.id, shot);
    closeSheet();
  };

  return (
    <div className="app-root">
      <header className="app-header">
        {/* Focusable only as a programmatic target: where focus lands if the
            sheet closes because its shot vanished, so the opener no longer
            exists to restore to (WAI-ARIA APG — never drop focus to <body>). */}
        <h1 className="app-title" ref={titleRef} tabIndex={-1}>
          {VIEW_TITLES[view]}
        </h1>
      </header>

      {view === "home" && (
        <main className="app-main">
          <Greeting />
          <button
            type="button"
            className="primary-button log-cta"
            onClick={() => setLoggingNew(true)}
          >
            + Log a shot
          </button>
          <RecentShots shots={shots} onSeeAll={() => setView("history")} />
        </main>
      )}

      {view === "history" && (
        <main className="app-main">
          <HistoryView
            shots={shots}
            query={historyQuery}
            onQueryChange={setHistoryQuery}
            onEditShot={setEditingShot}
            onDeleteShot={deleteShot}
          />
        </main>
      )}

      {/* Same <main> wrapper as the other destinations, so every tab exposes a
          main landmark for landmark navigation. */}
      {view === "settings" && (
        <main className="app-main">
          <Settings />
        </main>
      )}

      {sheetOpen && (
        <Modal
          labelledBy={SHEET_HEADING_ID}
          onClose={closeSheet}
          variant="sheet"
          fallbackFocusRef={titleRef}
        >
          <ShotForm
            headingId={SHEET_HEADING_ID}
            onAddShot={handleAddShot}
            onUpdateShot={handleUpdateShot}
            editingShot={activeEditingShot}
            onCancelEdit={closeSheet}
            shots={shots}
          />
          {/* A new-shot sheet has no Cancel of its own (ShotForm only renders one
              while editing), so it needs an explicit way out besides Escape. */}
          {!activeEditingShot && (
            <button
              type="button"
              className="secondary-button sheet-close"
              onClick={closeSheet}
            >
              Cancel
            </button>
          )}
        </Modal>
      )}

      <footer className="app-footer">
        <small>
          Stored only in this browser — no accounts, no analytics, no servers.
          Built with trans safety and privacy in mind.
        </small>
      </footer>

      <TabBar view={view} onNavigate={setView} />
    </div>
  );
};

export default App;
