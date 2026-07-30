// src/App.tsx
import React, { useEffect, useRef, useState } from "react";
import { ShotForm, type ShotDraft } from "./components/ShotForm";
import { Settings } from "./components/Settings";
import { Greeting } from "./components/Greeting";
import { TabBar } from "./components/TabBar";
import { RecentShots } from "./components/RecentShots";
import { HistoryView } from "./components/HistoryView";
import { emptyHistoryQuery, type HistoryQuery } from "./utils/historyQuery";
import { Modal, SHEET_EXIT_MS } from "./components/Modal";
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
  // Initial focus goes to the first field, not the sheet's own Close button —
  // landing on Close means a stray Enter dismisses the form you just opened.
  const dateFieldRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<ShotDraft | null>(null);

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

  // Dismissing plays the sheet's exit animation before unmounting: React would
  // otherwise remove the element instantly, leaving nothing on screen to animate
  // out. The sheet stays mounted (and marked `closing`) for exactly the
  // transition's length, then goes.
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeSheet = () => {
    if (closing) return; // already on the way out
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setClosing(false);
      setLoggingNew(false);
      setEditingShot(null);
    }, SHEET_EXIT_MS);
  };

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  // Dismissing the sheet (Escape, the Android Back gesture, ✕) keeps whatever was
  // typed and restores it next time — chosen over a "discard?" confirm so an
  // accidental edge-swipe costs nothing and there is no extra decision to
  // dismiss. Saving is the deliberate act that clears it.
  //
  // Each path states its own intent by setting `draft` directly, reading the live
  // values from the form when it wants to keep them. The alternative — having the
  // form report on unmount and a boolean ref tell this component why it closed —
  // put the intent in one-shot mutable state that a missed or repeated report
  // would leave pointing the wrong way.
  const liveDraft = useRef<ShotDraft | null>(null);

  const dismissSheet = () => {
    setDraft(liveDraft.current);
    closeSheet();
  };

  const handleAddShot = (shot: ShotEntry) => {
    addShot(shot);
    setDraft(null);
    closeSheet();
  };

  const handleUpdateShot = (shot: ShotEntry) => {
    updateShot(shot.id, shot);
    closeSheet();
  };

  return (
    <div className="app-root">
      {/* The tab bar is visually at the bottom, so it is last in DOM order too
          (as it should be) — but that leaves a keyboard user tabbing through a
          whole page of History rows to reach Settings. A skip link jumps
          straight there without disturbing the visual order. */}
      <a className="skip-link" href="#main-nav">
        Skip to navigation
      </a>

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
          onClose={dismissSheet}
          variant="sheet"
          closing={closing}
          initialFocusRef={dateFieldRef}
          fallbackFocusRef={titleRef}
        >
          <ShotForm
            // Remount on a change of subject, so the form re-seeds from the new
            // shot (or from a fresh/draft state) rather than needing an effect
            // to sync it — see the note in ShotForm.
            key={activeEditingShot?.id ?? "new"}
            headingId={SHEET_HEADING_ID}
            onAddShot={handleAddShot}
            onUpdateShot={handleUpdateShot}
            editingShot={activeEditingShot}
            onDismiss={dismissSheet}
            shots={shots}
            draft={draft}
            liveDraftRef={liveDraft}
            firstFieldRef={dateFieldRef}
          />
        </Modal>
      )}

      <footer className="app-footer">
        <small>
          Stored only in this browser — no accounts, no analytics, no servers.
          Built with trans safety and privacy in mind.
        </small>
      </footer>

      <TabBar
        view={view}
        onNavigate={(next) => {
          setView(next);
          // Each tab is a separate destination, so it starts at its own top.
          // Without this you land mid-page in the new view — scrolled deep into
          // History, tapping Settings drops you into the middle of a panel with
          // no heading in sight.
          window.scrollTo({ top: 0 });
        }}
      />
    </div>
  );
};

export default App;
