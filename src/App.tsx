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
  // In-progress edits, keyed by shot id. Closing an edit remembers the changes
  // and reopening that shot restores them, so dismissal never loses work in
  // either mode — the ✕ looks identical for a new shot and an edit, so it had
  // better behave the same. Session-only, like `draft`: a fresh launch starts
  // clean rather than resurrecting week-old half-edits.
  const [editDrafts, setEditDrafts] = useState<Record<string, ShotDraft>>({});

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
  // The same fact as `closing`, held in a ref because the guards below need it
  // SYNCHRONOUSLY. State updates are async, so a rapid double-tap fires both
  // handlers before React re-renders and every one of them reads `closing` as
  // false — which is exactly how a double-tap on Save wrote the shot twice.
  // (`pointer-events: none` on the closing sheet has the same problem: the class
  // only lands on the next render.)
  const closingRef = useRef(false);

  const closeSheet = () => {
    if (closingRef.current) return; // already on the way out
    closingRef.current = true;
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      closingRef.current = false;
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
    // Already on the way out: the sheet stays mounted through its exit animation
    // with the Escape and Back listeners still live, so a stray press in that
    // window must not re-decide the draft. Without this, pressing Back just after
    // saving a backdated shot restored the entry that was already saved (the
    // post-save reset keeps the date, so the form still reads as dirty),
    // inviting a duplicate.
    if (closingRef.current) return;
    const live = liveDraft.current;
    // Each mode keeps its own work. Writing an edit into `draft` would wipe an
    // unfinished NEW shot parked earlier, so edits go to their own per-shot slot.
    if (activeEditingShot) {
      const { id } = activeEditingShot;
      setEditDrafts((prev) => {
        const next = { ...prev };
        if (live) next[id] = live;
        else delete next[id];
        return next;
      });
    } else {
      setDraft(live);
    }
    closeSheet();
  };

  // Saving clears the draft *and* the live values behind it. The sheet stays
  // mounted through the exit animation with its Escape and Back listeners live,
  // and the post-save reset deliberately keeps the date — so on a backdated shot
  // the form still counts as dirty and would republish. An impatient Back press
  // in that window would then restore the entry that was just saved, inviting a
  // duplicate.
  const clearDraft = () => {
    liveDraft.current = null;
    setDraft(null);
  };

  // Both save paths bail once the sheet is closing, for the same reason
  // dismissSheet does: the sheet stays mounted through its 200ms exit animation
  // and only `#root` is inert, so its own Save button is still live. Without this
  // a double-tap inside that window wrote the shot twice — the second a blank
  // duplicate, since the post-save reset had already cleared the fields — and a
  // Save landing just after ✕/Escape saved a shot the user had just dismissed.
  // 200ms is precisely a double-tap, and there is no undo until slice C.
  const handleAddShot = (shot: ShotEntry) => {
    if (closingRef.current) return;
    addShot(shot);
    clearDraft();
    closeSheet();
  };

  const handleUpdateShot = (shot: ShotEntry) => {
    if (closingRef.current) return;
    updateShot(shot.id, shot);
    // Saved, so there is nothing in progress left to restore for this shot.
    liveDraft.current = null;
    setEditDrafts((prev) => {
      const next = { ...prev };
      delete next[shot.id];
      return next;
    });
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
            draft={
              activeEditingShot ? editDrafts[activeEditingShot.id] ?? null : draft
            }
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
