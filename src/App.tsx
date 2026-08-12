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
import { StorageBanner } from "./components/StorageBanner";
import { useBackupExport } from "./hooks/useBackupExport";
import { handOffFocus } from "./utils/focus";
import { useShotsContext } from "./context/ShotsContext";
import type { ShotEntry } from "./types/shot";
import type { SaveOutcome } from "./components/ShotForm";
import type { View } from "./types/view";

const SHEET_HEADING_ID = "shot-sheet-title";

/**
 * How long the ✓ shows before the sheet starts leaving.
 *
 * Inside the 100–300ms band that reads as an answer to what you just did rather
 * than a pause. Save to sheet-gone is therefore CONFIRM_MS + SHEET_EXIT_MS,
 * which is the point: the sheet used to vanish before the press had registered.
 */
export const CONFIRM_MS = 200;

const VIEW_TITLES: Record<View, string> = {
  home: "T-Shot Tracker",
  history: "History",
  settings: "Settings",
};

const App: React.FC = () => {
  const { shots, addShot, updateShot, deleteShot } = useShotsContext();
  const exportBackup = useBackupExport();
  const [editingShot, setEditingShot] = useState<ShotEntry | null>(null);
  // The log form is a sheet rather than an always-open panel on Home, so the
  // greeting, the primary action, and the recent teaser all fit above the fold.
  const [loggingNew, setLoggingNew] = useState(false);
  // Always starts on Home — never "last tab used". Logging is the primary
  // action, and reopening the app never lands on a data view in public.
  const [view, setView] = useState<View>("home");
  // Every route to a new destination goes through here, so none of them can
  // forget the scroll reset — "See all" used to, and opened History at whatever
  // offset Home was scrolled to.
  const navigate = (next: View) => {
    // Leaving Home is a deliberate action, so the acknowledgement has done its
    // job: the greeting or milestone comes back. This also retires the wash,
    // which matters because Home UNMOUNTS when you leave it — a wash still armed
    // would replay from the start on every return, the same nuisance the
    // milestone celebration avoids by firing once on the crossing.
    setAcknowledgedId(null);
    setWashId(null);
    setView(next);
    // Each tab is a separate destination, so it starts at its own top. Without
    // this you land mid-page in the new view — scrolled deep into History,
    // tapping Settings drops you into the middle of a panel with no heading in
    // sight.
    window.scrollTo({ top: 0 });
  };
  // Lifted so a trip to Home and back keeps the filter you were using. Session
  // only: deliberately not persisted, so a fresh launch is never pre-filtered.
  const [historyQuery, setHistoryQuery] =
    useState<HistoryQuery>(emptyHistoryQuery);

  // The post-log acknowledgement, in two pieces because they have two lifetimes.
  //
  // `acknowledgedId` drives the line in the greeting slot and waits for the next
  // deliberate action. `washId` drives the row's colour wash and retires when the
  // animation itself ends — the 2.2s lives in CSS only, so there is no duration
  // to keep in sync. Both are in-memory: reopening the app is one of the things
  // that should bring the greeting back.
  //
  // Ids rather than booleans: the wash has to know WHICH row, and the same value
  // then tells the line that a save has just happened.
  const [acknowledgedId, setAcknowledgedId] = useState<string | null>(null);
  const [washId, setWashId] = useState<string | null>(null);
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
  // Each entry remembers the exact shot object it was parked against, not just
  // the id. An id alone is not enough: importing a backup exported from this same
  // device brings the same ids back with different contents, and a draft keyed
  // only by id would then re-seed the sheet with pre-import values and overwrite
  // the entry that was just restored. Object identity catches every way the
  // record can change — update, delete, wholesale replace, cross-tab sync — because
  // useShots only ever replaces the objects it actually touches.
  const [editDrafts, setEditDrafts] = useState<
    Record<string, { draft: ShotDraft; parkedAgainst: ShotEntry }>
  >({});

  /** The parked draft for a shot, or null if the shot has changed underneath it. */
  const draftForShot = (shot: ShotEntry): ShotDraft | null => {
    const parked = editDrafts[shot.id];
    return parked && parked.parkedAgainst === shot ? parked.draft : null;
  };

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
  // True for the ✓ beat between a successful save and the sheet leaving.
  const [confirming, setConfirming] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The same fact as `closing`, held in a ref because the guards below need it
  // SYNCHRONOUSLY. State updates are async, so a rapid double-tap fires both
  // handlers before React re-renders and every one of them reads `closing` as
  // false — which is exactly how a double-tap on Save wrote the shot twice.
  // (`pointer-events: none` on the closing sheet has the same problem: the class
  // only lands on the next render.)
  const closingRef = useRef(false);

  /**
   * Close the sheet, optionally confirming first.
   *
   * `confirm` holds the sheet in place for {@link CONFIRM_MS} showing a ✓ before
   * the exit begins — the moment of "yes, that landed" that a sheet vanishing
   * instantly does not give you. Only the save path passes it; ✕, Escape and
   * Back have nothing to confirm.
   *
   * Both phases reuse ONE timer ref, so at most one is ever pending and the
   * existing cleanup covers both. A second timer alongside this one is exactly
   * the shape that once left a stale exit timer to tear down the next sheet.
   */
  const closeSheet = (options?: { confirm?: boolean; thenWash?: string }) => {
    if (closingRef.current) return; // already on the way out
    // Set synchronously, before any wait: a second Save during the ✓ window is
    // dropped by the guard that already exists rather than by a new one.
    closingRef.current = true;

    const beginExit = () => {
      setConfirming(false);
      setClosing(true);
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
        closingRef.current = false;
        setLoggingNew(false);
        setEditingShot(null);
        setClosing(false);
        // The wash starts when the row becomes VISIBLE, not when the shot was
        // saved. Measured in a browser: the sheet covers the screen for the ✓
        // plus the slide, which is ~440ms — almost exactly the 20% the wash
        // spends holding at full tint. Armed at save time, the entire hold
        // happened behind the sheet and what you actually saw was a tint already
        // fading, which is the thing the hold exists to prevent.
        if (options?.thenWash) setWashId(options.thenWash);
      }, SHEET_EXIT_MS);
    };

    if (!options?.confirm) {
      beginExit();
      return;
    }
    setConfirming(true);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      beginExit();
    }, CONFIRM_MS);
  };

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  // Every route to an open sheet goes through here, so none of them can inherit a
  // half-finished exit.
  //
  // The sheet can vanish WITHOUT its timer: if the shot being edited disappears
  // mid-exit-animation (a cross-tab delete or a backup import — the storage
  // listener fires for either), the render-phase release above unmounts it at
  // once and leaves the timer pending with `closing` still true. The next sheet
  // would then mount already marked closing — off-screen, transparent and
  // pointer-events: none — so tapping "Log a shot" appears to do nothing, and the
  // stale timer tears the ghost down a moment later. Retiring the exit state at
  // the point of opening keeps it in an event handler, where clearing a timer and
  // setting state both belong.
  const openSheet = (shot?: ShotEntry) => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    closingRef.current = false;
    setClosing(false);
    // Going to log again is the moment the line has done its job. The wash is
    // left alone: it retires on its own animation end, and opening the sheet
    // does not cover the row.
    setAcknowledgedId(null);
    if (shot) setEditingShot(shot);
    else setLoggingNew(true);
  };

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
      const shot = activeEditingShot;
      setEditDrafts((prev) => {
        const next = { ...prev };
        if (live) next[shot.id] = { draft: live, parkedAgainst: shot };
        else delete next[shot.id];
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
  // A failed save must not ALSO lose what was typed. The sheet closes on save
  // and the draft is cleared, so without this a write that throws left the user
  // with nothing on screen and nothing in storage — the worst of both.
  //
  // `addShot` reports what the write actually did rather than what a probe
  // predicted it would do, and it commits nothing when the write is refused. So
  // the sheet holding open is not just a courtesy: the form is now the only copy
  // of that entry, and pressing Save again retries it instead of appending a
  // second one.
  const handleAddShot = (shot: ShotEntry): SaveOutcome => {
    // "ignored", not "refused": the sheet is on its way out and this submit is
    // being dropped, which is not the same event as storage rejecting a write.
    // Collapsing the two into `false` made a double-tapped Save announce
    // "Couldn't save this shot" over a shot that had just saved perfectly.
    if (closingRef.current) return "ignored";
    if (!addShot(shot)) return "refused"; // sheet stays put, fields kept, and it says why
    clearDraft();
    // Only a shot that actually reached storage is acknowledged. A refused save
    // has nothing to affirm, and a retry that succeeds is an ordinary success —
    // it gets the full acknowledgement, not a quieter one, which falls out of
    // hanging this off the "saved" outcome rather than off "no error happened".
    setAcknowledgedId(shot.id);
    closeSheet({ confirm: true, thenWash: shot.id });
    return "saved";
  };

  const handleUpdateShot = (shot: ShotEntry): SaveOutcome => {
    if (closingRef.current) return "ignored"; // see handleAddShot
    if (!updateShot(shot.id, shot)) return "refused"; // sheet holds; see handleAddShot
    // Saved, so there is nothing in progress left to restore for this shot.
    liveDraft.current = null;
    setEditDrafts((prev) => {
      const next = { ...prev };
      delete next[shot.id];
      return next;
    });
    closeSheet();
    // Symmetric with handleAddShot: the premise of this whole path is that a
    // caller can ask what the save did, so the success case has to answer too.
    return "saved";
  };

  return (
    <div className="app-root">
      {/* The tab bar is visually at the bottom, so it is last in DOM order too
          (as it should be) — but that leaves a keyboard user tabbing through a
          whole page of History rows to reach Settings. A skip link jumps
          straight there without disturbing the visual order. */}
      {/* The href stays, so this still works if the handler never runs, but the
          click moves focus itself rather than letting the browser resolve the
          fragment. Following it for real leaves "#main-nav" in the URL, and every
          dialog then restores focus to the WRONG place for the rest of the
          session: a Modal pushes a throwaway history entry, and closing it pops
          back to a URL that still carries the fragment, so the browser re-applies
          it and focus lands on the nav instead of the control that opened the
          dialog. That penalty falls precisely on keyboard and screen-reader
          users — the people who use skip links, and the people focus restoration
          exists for. Moving focus directly is also the better behaviour on its
          own terms: no stray fragment in the address bar, and no history entry
          for what is an in-page focus move. */}
      <a
        className="skip-link"
        href="#main-nav"
        onClick={(e) => {
          const nav = document.getElementById("main-nav");
          if (!nav) return; // let the browser do its default thing
          e.preventDefault();
          handOffFocus(nav, titleRef);
        }}
      >
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

      {/* Above every view, not inside the log sheet: writes fail from logging,
          editing, deleting and Settings alike, and an in-sheet message would
          leave three of those silent. */}
      <StorageBanner returnFocusRef={titleRef} />

      {view === "home" && (
        <main className="app-main">
          <Greeting acknowledged={acknowledgedId !== null} />
          <button
            type="button"
            className="primary-button log-cta"
            onClick={() => openSheet()}
          >
            + Log a shot
          </button>
          <RecentShots
            shots={shots}
            onSeeAll={() => navigate("history")}
            justLoggedId={washId}
            onWashEnd={() => setWashId(null)}
          />
        </main>
      )}

      {view === "history" && (
        <main className="app-main">
          <HistoryView
            shots={shots}
            query={historyQuery}
            onQueryChange={setHistoryQuery}
            onEditShot={openSheet}
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
            onExportBackup={exportBackup}
            confirming={confirming}
            editingShot={activeEditingShot}
            onDismiss={dismissSheet}
            shots={shots}
            draft={
              activeEditingShot ? draftForShot(activeEditingShot) : draft
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

      <TabBar view={view} onNavigate={navigate} />
    </div>
  );
};

export default App;
