import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, within, act, waitFor } from "@testing-library/react";
import App, { CONFIRM_MS } from "../App";
import { ShotsProvider } from "../context/ShotsContext";
import { ProfileProvider } from "../context/ProfileContext";
import { StorageHealthProvider } from "../context/StorageHealthContext";
import type { ShotEntry } from "../types/shot";
import { STORAGE_KEYS } from "../storageKeys";
import { SHEET_EXIT_MS } from "../components/Modal";
import { todayLocalISO, localISODate } from "../utils/datetime";
import * as dl from "../utils/download";
import {
  withFocusGuard,
  expectFocusSomewhereUseful,
  expectFocusSettled,
} from "../test/focus";
import { expectVisibleFocusRing } from "../test/focusRing";

// App reads both stores via context (Settings uses the profile store), so mount
// it under the same providers main.tsx does.
const renderApp = () =>
  render(
    <StorageHealthProvider>
      <ShotsProvider>
        <ProfileProvider>
          <App />
        </ProfileProvider>
      </ShotsProvider>
    </StorageHealthProvider>
  );

/**
 * A start date exactly N years before *local* today.
 *
 * Via `localISODate`, deliberately — these two tests used
 * `new Date().toISOString().slice(0, 10)`, which is the UTC date. The app reads
 * today with `todayLocalISO`, so anywhere west of UTC the two disagree for the
 * last hours of every local day: at 18:51 PDT the UTC slice is already tomorrow,
 * "one year ago" lands a day late, and the milestone is 364 days old and not yet
 * earned. The tests then failed every evening, on main, on a clock nobody
 * changed. `datetime.test.ts` already warns against "the naive UTC slice".
 */
const yearsAgoLocal = (years: number): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return localISODate(d);
};

const seedShots = (shots: ShotEntry[]) =>
  localStorage.setItem(STORAGE_KEYS.shots, JSON.stringify(shots));

const goTo = (tab: "Home" | "History" | "Settings") =>
  fireEvent.click(within(screen.getByRole("navigation")).getByRole("button", { name: tab }));

/** The sheet's removal is asynchronous: a save waits CONFIRM_MS (200ms) on the ✓
 *  and then SHEET_EXIT_MS (240ms) for the slide, so 440ms of real time passes
 *  before the dialog unmounts.
 *
 *  The timeout is explicit because that 440ms had eaten more than half of
 *  `waitFor`'s 1000ms default, on every test that saves — and this suite has a
 *  documented history of load-dependent flakes that read as unrelated. */
const sheetGone = () =>
  waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), {
    timeout: 3000,
  });

/** Background the app, or bring it back. jsdom reports "visible" and never
 *  changes it, so both halves have to be driven by hand. */
const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
};

/** Dismiss via the top-bar ✕ — which KEEPS the draft, like Escape and Back. */
const dismissSheet = (name: RegExp | string = "Close") =>
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name })
  );

beforeEach(() => localStorage.clear());

describe("App — navigation", () => {
  it("opens on Home, never on another tab", () => {
    seedShots([{ id: "a", date: "2026-06-01" }]);
    renderApp();

    expect(screen.getByRole("heading", { name: "T-Shot Tracker" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Log a shot/ })).toBeInTheDocument();
    // Home is a teaser, not the full list: no filter controls here.
    expect(screen.queryByPlaceholderText(/Search notes/)).not.toBeInTheDocument();
  });

  it("moves between the three tabs", () => {
    renderApp();

    goTo("History");
    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search notes/)).toBeInTheDocument();

    goTo("Settings");
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();

    goTo("Home");
    expect(screen.getByRole("button", { name: /Log a shot/ })).toBeInTheDocument();
  });

  it("marks the active tab for assistive tech, not by colour alone", () => {
    renderApp();
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("button", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    goTo("History");
    expect(within(nav).getByRole("button", { name: "History" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("'See all' on the Home teaser opens History", () => {
    seedShots([{ id: "a", date: "2026-06-01" }]);
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /See all/ }));
    expect(screen.getByPlaceholderText(/Search notes/)).toBeInTheDocument();
  });

  it("skip link moves focus without leaving a fragment in the URL", () => {
    // Following the fragment for real poisons focus restoration for the whole
    // session: a Modal pushes a throwaway history entry, and closing it pops back
    // to a URL still carrying "#main-nav", so the browser re-applies the fragment
    // and focus lands on the nav rather than the control that opened the dialog.
    renderApp();
    const before = window.location.hash;

    fireEvent.click(screen.getByRole("link", { name: /Skip to navigation/ }));

    expect(screen.getByRole("navigation")).toHaveFocus();
    expect(window.location.hash).toBe(before);
  });

  it("starts every destination at its own top, however you got there", () => {
    // The tabs reset scroll; "See all" is the other way into History and used to
    // skip it, opening the list at whatever offset Home was scrolled to.
    seedShots([{ id: "a", date: "2026-06-01" }]);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    try {
      renderApp();

      fireEvent.click(screen.getByRole("button", { name: /See all/ }));
      expect(scrollTo).toHaveBeenCalledWith({ top: 0 });

      scrollTo.mockClear();
      goTo("Settings");
      expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    } finally {
      scrollTo.mockRestore();
    }
  });
});

describe("App — logging via the sheet", () => {
  it("opens the form in a dialog and closes it after saving", async () => {
    renderApp();

    // The form is not inline on Home — it lives behind the primary action.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "Log a shot" })).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: "Save shot" }));

    // Saving dismisses the sheet and the shot lands in the teaser.
    await sheetGone();
    expect(screen.getByRole("button", { name: /See all/ })).toBeInTheDocument();
  });

  it("puts initial focus on the first field, not on Close", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));

    // Landing on Close would mean a stray Enter dismisses the form just opened;
    // a data-entry dialog should start on data entry.
    expect(
      within(screen.getByRole("dialog")).getByLabelText("Date")
    ).toHaveFocus();
  });

  it("the top-bar close dismisses without saving", async () => {
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    dismissSheet();

    await sheetGone();
    // Nothing was logged, so the teaser still shows its empty state.
    expect(screen.getByText(/No shots logged yet/)).toBeInTheDocument();
  });
});

describe("App — an interrupted entry is not lost", () => {
  const openSheet = () =>
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
  const notesField = () =>
    within(screen.getByRole("dialog")).getByPlaceholderText(/remember for later/i);

  it("restores what was typed when the sheet is dismissed with Escape", async () => {
    renderApp();
    openSheet();
    fireEvent.change(notesField(), { target: { value: "half-written" } });

    // Escape and the Android Back gesture are easy to fire by accident on a long
    // form, so they keep the entry rather than destroying it.
    fireEvent.keyDown(window, { key: "Escape" });
    await sheetGone();

    openSheet();
    expect(notesField()).toHaveValue("half-written");
  });

  it("'Clear form' empties it, so nothing is restored next time", async () => {
    renderApp();
    openSheet();
    fireEvent.change(notesField(), { target: { value: "not wanted" } });

    // Closing keeps a draft, so discarding needs its own control.
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Clear form" })
    );
    expect(notesField()).toHaveValue("");

    dismissSheet();
    await sheetGone();
    openSheet();
    expect(notesField()).toHaveValue("");
  });

  it("'Clear form' keeps focus inside the sheet after removing itself", () => {
    // Clearing makes the button vanish (nothing left to clear), and focus would
    // drop to <body> — inside an OPEN dialog, where the Tab trap cannot re-engage
    // because it only wraps from the first or last focusable. The form is now in
    // the state a freshly opened sheet is in, so focus goes where a fresh sheet
    // puts it.
    renderApp();
    openSheet();
    fireEvent.change(notesField(), { target: { value: "not wanted" } });

    const clear = within(screen.getByRole("dialog")).getByRole("button", {
      name: "Clear form",
    });
    clear.focus();
    fireEvent.click(clear);

    expect(
      within(screen.getByRole("dialog")).queryByRole("button", { name: "Clear form" })
    ).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    // The heading, not the Date field: focusing <input type="date"> from a click
    // handler makes mobile browsers throw up the native picker over the sheet.
    expect(
      within(screen.getByRole("dialog")).getByRole("heading", { name: "Log a shot" })
    ).toHaveFocus();
  });

  it("saving clears the draft", async () => {
    renderApp();
    openSheet();
    fireEvent.change(notesField(), { target: { value: "logged for real" } });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
    );
    await sheetGone();
    expect(screen.getByText("logged for real")).toBeInTheDocument();

    openSheet();
    expect(notesField()).toHaveValue("");
  });

  it("keeps a draft written straight after a save", async () => {
    // The sequence most likely to expose a leaked "discard" flag: save (which
    // clears the draft), then immediately start another entry and dismiss it.
    // Each path now states its own intent, so nothing carries over.
    renderApp();
    openSheet();
    fireEvent.change(notesField(), { target: { value: "shot one" } });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
    );
    await sheetGone();

    openSheet();
    fireEvent.change(notesField(), { target: { value: "shot two, unfinished" } });
    fireEvent.keyDown(window, { key: "Escape" });
    await sheetGone();

    openSheet();
    expect(notesField()).toHaveValue("shot two, unfinished");
  });

  it("does not treat an untouched form as a draft", async () => {
    seedShots([
      { id: "prev", date: "2026-06-01", doseMg: 60, testosteroneEster: "cypionate" },
    ]);
    renderApp();
    openSheet();
    // Only the carried-forward values are present — nothing the user typed.
    fireEvent.keyDown(window, { key: "Escape" });
    await sheetGone();

    openSheet();
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByLabelText("Dose (mg)")).toHaveValue(60);
    expect(within(sheet).getByLabelText("Date")).toHaveValue(todayLocalISO());
  });

  it("does not clobber a parked draft when an edit is abandoned", async () => {
    seedShots([{ id: "a", date: "2026-06-01", notes: "existing" }]);
    renderApp();

    // Park an unfinished new shot.
    openSheet();
    fireEvent.change(notesField(), { target: { value: "parked" } });
    fireEvent.keyDown(window, { key: "Escape" });
    await sheetGone();

    // Abandon an edit. Only a new-shot sheet owns the draft, so this must leave
    // it alone — saving an edit already does.
    goTo("History");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.keyDown(window, { key: "Escape" });
    await sheetGone();

    goTo("Home");
    openSheet();
    expect(notesField()).toHaveValue("parked");
  });

  it("does not re-date an edited shot when a parked edit outlives the day", async () => {
    // A draft's date is frozen, never re-derived. Park an edit of a shot dated
    // today, cross midnight with the session alive (a phone left open), reopen —
    // the date must still be the shot's own, not the new today, and saving must
    // not move a logged shot to a day it did not happen. This case is why the
    // date is frozen at all; it survives as a regression guard on the parent,
    // where the draft actually gets parked and handed back.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-13T23:55:00"));
      seedShots([{ id: "a", date: "2026-07-13", notes: "before" }]);
      renderApp();

      goTo("History");
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      fireEvent.change(notesField(), { target: { value: "after" } });
      fireEvent.keyDown(window, { key: "Escape" });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      // Midnight passes while the parked edit sits in memory.
      vi.setSystemTime(new Date("2026-07-14T00:10:00"));

      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      const sheet = screen.getByRole("dialog");
      expect(within(sheet).getByLabelText("Date")).toHaveValue("2026-07-13");
      expect(within(sheet).getByLabelText("Notes")).toHaveValue("after");

      fireEvent.click(within(sheet).getByRole("button", { name: "Update shot" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.shots)!);
      expect(stored).toHaveLength(1);
      expect(stored[0].date).toBe("2026-07-13");
      expect(stored[0].notes).toBe("after");
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens a usable sheet when the last one vanished mid-animation", async () => {
    // The exit timer is not the only way a sheet goes: if the shot being edited
    // disappears while it is animating out (a cross-tab delete, or an import
    // replacing the store) the render-phase release unmounts it at once and
    // leaves the timer pending with `closing` still true. The NEXT sheet then
    // mounts already marked closing — off-screen and pointer-events: none — so
    // "Log a shot" looks like it does nothing, and the stale timer removes the
    // ghost a moment later.
    seedShots([
      { id: "victim", date: "2026-07-20" },
      { id: "other", date: "2026-07-13" },
    ]);
    renderApp();

    goTo("History");
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Start the exit, then delete that shot from another tab before it finishes.
    fireEvent.keyDown(window, { key: "Escape" });
    act(() => {
      const next = JSON.stringify([{ id: "other", date: "2026-07-13" }]);
      localStorage.setItem(STORAGE_KEYS.shots, next);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEYS.shots,
          newValue: next,
          storageArea: localStorage,
        })
      );
    });
    await sheetGone();

    goTo("Home");
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));

    const sheet = screen.getByRole("dialog");
    // Not marked closing, so it is actually on screen and can be interacted with.
    expect(sheet.querySelector(".dialog--sheet")).not.toHaveClass("is-closing");
    // And it is still there once the old timer's window has passed.
    await act(async () => {
      await new Promise((r) => setTimeout(r, SHEET_EXIT_MS + 60));
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not re-date an edited shot whose date field was left empty", async () => {
    // The other half of the sentinel problem: "" means BOTH "untouched default"
    // and "the user emptied this field" (native date inputs are clearable). On an
    // edit the second reading is the real one, and expanding it to today moved a
    // shot logged in May to today — months out — the moment it was reopened.
    seedShots([{ id: "a", date: "2026-05-05", notes: "logged in May" }]);
    renderApp();

    goTo("History");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText("Date"), {
      target: { value: "" },
    });
    fireEvent.keyDown(window, { key: "Escape" });
    await sheetGone();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const sheet = screen.getByRole("dialog");
    // Restored as the user left it — empty — not silently filled with today.
    expect(within(sheet).getByLabelText("Date")).toHaveValue("");
    expect(within(sheet).getByLabelText("Notes")).toHaveValue("logged in May");

    // And it cannot be saved in that state, so nothing can be re-dated by accident.
    fireEvent.click(within(sheet).getByRole("button", { name: "Update shot" }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.shots)!)[0].date).toBe(
      "2026-05-05"
    );
  });

  it("cannot save twice by double-tapping through the exit animation", async () => {
    // The sheet stays mounted for its 200ms slide and is portaled outside the
    // inert app root, so Save is still live. 200ms is exactly a double-tap, and
    // the post-save reset means the second write would be a blank duplicate.
    renderApp();
    openSheet();
    fireEvent.change(notesField(), { target: { value: "only once" } });
    const save = within(screen.getByRole("dialog")).getByRole("button", {
      name: "Save shot",
    });
    // All three inside ONE act, so React batches them exactly as a real browser
    // does. Separate fireEvent calls each flush a render in between, which let
    // the state-based guard look like it worked while the browser saved three
    // times — the guard has to be a ref, read synchronously.
    act(() => {
      save.click();
      save.click();
      save.click();
    });
    await sheetGone();

    expect(screen.getAllByText("only once")).toHaveLength(1);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.shots)!);
    expect(stored).toHaveLength(1);
  });

  it("does not save a shot that was just dismissed", async () => {
    renderApp();
    openSheet();
    fireEvent.change(notesField(), { target: { value: "changed my mind" } });
    const sheet = screen.getByRole("dialog");
    // Dismiss, then a Save press lands inside the exit window.
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Save shot" }));
    await sheetGone();

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.shots) ?? "[]")).toHaveLength(0);
  });

  it("does not resurrect a just-saved shot when Back lands during the exit", async () => {
    renderApp();
    openSheet();
    // Backdate it: the post-save reset keeps the date, so the form still reads
    // as dirty afterwards and would republish itself as a draft.
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText("Date"), {
      target: { value: "2026-06-01" },
    });
    fireEvent.change(notesField(), { target: { value: "saved once" } });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
    );

    // Impatient Escape inside the exit-animation window, while the sheet is still
    // mounted and listening.
    fireEvent.keyDown(window, { key: "Escape" });
    await sheetGone();

    openSheet();
    // Assert the DATE, not the notes: the post-save reset clears notes but keeps
    // the date, so notes reads empty whether or not a draft was resurrected. The
    // backdate is the only field that gives it away — and a restored draft here
    // would invite logging the same shot twice.
    expect(within(screen.getByRole("dialog")).getByLabelText("Date")).toHaveValue(
      todayLocalISO()
    );
    expect(screen.getByText("saved once")).toBeInTheDocument();
  });

  it("remembers an abandoned edit and restores it when that shot is reopened", async () => {
    seedShots([
      { id: "a", date: "2026-06-01", notes: "first" },
      { id: "b", date: "2026-06-08", notes: "second" },
    ]);
    renderApp();
    goTo("History");

    // Start rewriting one shot, then close without saving.
    const row = screen.getByText("first").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));
    fireEvent.change(notesField(), { target: { value: "rewritten but unsaved" } });
    fireEvent.keyDown(window, { key: "Escape" });
    await sheetGone();

    // The stored shot is untouched...
    expect(screen.getByText("first")).toBeInTheDocument();

    // ...and reopening the SAME shot brings the unsaved rewrite back.
    fireEvent.click(
      within(screen.getByText("first").closest("li")!).getByRole("button", { name: "Edit" })
    );
    expect(notesField()).toHaveValue("rewritten but unsaved");
    fireEvent.keyDown(window, { key: "Escape" });
    await sheetGone();

    // A different shot is unaffected — drafts are per shot, not global.
    fireEvent.click(
      within(screen.getByText("second").closest("li")!).getByRole("button", { name: "Edit" })
    );
    expect(notesField()).toHaveValue("second");
  });

  it("does not update a shot that was just dismissed", async () => {
    // The edit path needs the same closing guard as the new-shot path: the sheet
    // is still mounted and its Update button still live through the exit.
    seedShots([{ id: "a", date: "2026-06-01", notes: "original" }]);
    renderApp();
    goTo("History");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(notesField(), { target: { value: "should not land" } });
    const sheet = screen.getByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: "Cancel editing" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Update shot" }));
    await sheetGone();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.shots)!);
    expect(stored[0].notes).toBe("original");
  });

  it("drops a parked edit when the shot itself changes underneath it", async () => {
    // Importing a backup exported from this same device brings the same ids back
    // with different contents. A draft keyed only by id would silently re-seed the
    // sheet with pre-import values and overwrite the entry just restored.
    seedShots([{ id: "a", date: "2026-06-01", notes: "original" }]);
    renderApp();
    goTo("History");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(notesField(), { target: { value: "parked edit" } });
    fireEvent.keyDown(window, { key: "Escape" });
    await sheetGone();

    // Same id, different content — as a restore would produce.
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEYS.shots,
          newValue: JSON.stringify([
            { id: "a", date: "2026-06-01", notes: "restored from backup" },
          ]),
          storageArea: window.localStorage,
        })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    // The restored value, not the stale draft.
    expect(notesField()).toHaveValue("restored from backup");
  });

  it("forgets the edit draft once that shot is saved", async () => {
    seedShots([{ id: "a", date: "2026-06-01", notes: "before" }]);
    renderApp();
    goTo("History");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(notesField(), { target: { value: "after" } });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Update shot" })
    );
    await sheetGone();
    expect(screen.getByText("after")).toBeInTheDocument();

    // Reopening shows the saved value, not a leftover draft.
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(notesField()).toHaveValue("after");
  });

  it("keeps the edit sheet out of the draft system", async () => {
    seedShots([{ id: "a", date: "2026-06-01", notes: "original" }]);
    renderApp();
    goTo("History");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(notesField(), { target: { value: "abandoned edit" } });
    fireEvent.keyDown(window, { key: "Escape" });
    await sheetGone();

    // An abandoned edit must not leak into the next NEW shot.
    goTo("Home");
    openSheet();
    expect(notesField()).toHaveValue("");
  });
});

describe("App — editing from History", () => {
  it("edits in a sheet over the list, leaving the list's filters underneath", async () => {
    seedShots([{ id: "a", date: "2026-06-01", notes: "original" }]);
    renderApp();
    goTo("History");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "Edit shot" })).toBeInTheDocument();

    const notes = within(sheet).getByPlaceholderText(
      /remember for later/i
    ) as HTMLTextAreaElement;
    expect(notes.value).toBe("original");

    fireEvent.change(notes, { target: { value: "updated" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Update shot" }));

    await sheetGone();
    expect(screen.getByText("updated")).toBeInTheDocument();
  });

  it("confirms an update with the ✓, held through the slide", () => {
    // The same beat a new shot gets. CONFIRM_MS exists because a sheet that
    // vanishes the instant you press it leaves you unsure the press registered,
    // and that is a fact about the write landing — an edit needs it just as
    // much. The verb mirrors the button that was pressed.
    vi.useFakeTimers();
    try {
      seedShots([{ id: "a", date: "2026-06-01", notes: "original" }]);
      renderApp();
      goTo("History");
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));

      const sheet = () => within(screen.getByRole("dialog"));
      fireEvent.change(sheet().getByPlaceholderText(/remember for later/i), {
        target: { value: "updated" },
      });
      fireEvent.click(sheet().getByRole("button", { name: "Update shot" }));

      expect(sheet().getByRole("button", { name: "✓ Updated" })).toBeInTheDocument();

      // Still confirming mid-slide, and a second press there writes nothing.
      act(() => {
        vi.advanceTimersByTime(CONFIRM_MS);
      });
      const submit = sheet().getByRole("button", { name: "✓ Updated" });
      fireEvent.click(submit);

      act(() => {
        vi.advanceTimersByTime(SHEET_EXIT_MS);
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      const stored: ShotEntry[] = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.shots) ?? "[]"
      );
      expect(stored).toHaveLength(1);
      expect(stored[0].notes).toBe("updated");
    } finally {
      vi.useRealTimers();
    }
  });

  it("the Home teaser is read-only — no edit or delete there", () => {
    seedShots([{ id: "a", date: "2026-06-01", notes: "only shot" }]);
    renderApp();

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    // ...but the same shot is editable one tap away, in History.
    goTo("History");
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("drops the in-progress edit when the edited shot disappears", () => {
    seedShots([{ id: "gone", date: "2026-06-01", notes: "delete me" }]);
    renderApp();
    goTo("History");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      within(screen.getByRole("dialog")).getByRole("heading", { name: "Edit shot" })
    ).toBeInTheDocument();

    // Another tab removes the shot while this one is editing it. The edit must
    // end on its own, so a later Save can't silently no-op against a missing id.
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEYS.shots,
          newValue: JSON.stringify([]),
          storageArea: window.localStorage,
        })
      );
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("delete me")).not.toBeInTheDocument();
  });

  it("does not reopen the sheet if the dropped shot's id comes back", () => {
    const shot = { id: "gone", date: "2026-06-01", notes: "delete me" };
    seedShots([shot]);
    renderApp();
    goTo("History");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const sync = (next: ShotEntry[]) =>
      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: STORAGE_KEYS.shots,
            newValue: JSON.stringify(next),
            storageArea: window.localStorage,
          })
        );
      });

    sync([]); // the shot vanishes — the edit is dropped
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Restoring a backup that contains the same id must NOT resurrect the edit:
    // a sheet springing open unprompted, pre-filled with pre-import values,
    // would overwrite the restored entry on save.
    sync([shot]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("delete me")).toBeInTheDocument();
  });
});

describe("App — the sheet protects in-progress input", () => {
  it("ignores a backdrop click so a stray click can't discard the form", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));

    const notes = within(screen.getByRole("dialog")).getByPlaceholderText(
      /remember for later/i
    );
    fireEvent.change(notes, { target: { value: "half-filled" } });

    // The overlay is most of the viewport on desktop; dismissing on click would
    // throw away everything typed, with no undo.
    fireEvent.click(screen.getByRole("dialog"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(notes).toHaveValue("half-filled");
  });

  it("carries dose, type of T, and carrier oil forward to the next shot", () => {
    seedShots([
      {
        id: "prev",
        date: "2026-06-01",
        doseMg: 60,
        testosteroneEster: "cypionate",
        carrierOil: "grapeseed",
        injectionSite: "thigh",
      },
    ]);
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    const sheet = screen.getByRole("dialog");

    // These rarely change shot-to-shot, so they arrive pre-filled...
    expect(within(sheet).getByLabelText("Dose (mg)")).toHaveValue(60);
    expect(within(sheet).getByLabelText("Type of T")).toHaveValue("cypionate");
    expect(within(sheet).getByLabelText("Carrier oil")).toHaveValue("grapeseed");
    // ...while site is per-shot (rotating it is the point) and starts empty.
    expect(within(sheet).getByLabelText("Injection site")).toHaveValue("");
  });

  it("opens the edit sheet already showing the shot's values", () => {
    seedShots([
      { id: "old", date: "2026-06-01", doseMg: 12, notes: "old note" },
      { id: "new", date: "2026-07-20", doseMg: 99 },
    ]);
    renderApp();
    goTo("History");
    // The row for the older shot.
    const row = screen.getByText("old note").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));

    // First painted render, no effect needed: showing today's date and the
    // carried-forward dose here would flash the wrong shot before correcting.
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByLabelText("Date")).toHaveValue("2026-06-01");
    expect(within(sheet).getByLabelText("Dose (mg)")).toHaveValue(12);
  });

  it("carries forward deterministically when two shots share a date", () => {
    // Time is optional, so same-day shots routinely tie. Ordering by id would
    // decide this on a random UUID — and whatever it picked would be pre-filled
    // and then saved into the new entry. The most recently added must win.
    seedShots([
      { id: "zzz-added-first", date: "2026-07-20", doseMg: 10 },
      { id: "aaa-added-later", date: "2026-07-20", doseMg: 99 },
    ]);
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));

    // "aaa…" sorts before "zzz…", so an id tiebreak would have chosen 10.
    expect(
      within(screen.getByRole("dialog")).getByLabelText("Dose (mg)")
    ).toHaveValue(99);
  });
});

describe("App — a failed save is never silent", () => {
  const breakWrites = () =>
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });

  afterEach(() => vi.restoreAllMocks());

  it("keeps the sheet open when the write fails, so the entry is not lost too", async () => {
    // Saving closes the sheet and clears the draft. Without this the user is
    // left with nothing on screen AND nothing in storage — the worst of both.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    breakWrites();
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    fireEvent.change(
      within(screen.getByRole("dialog")).getByPlaceholderText(/remember for later/i),
      { target: { value: "still here" } }
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
    );

    const sheet = screen.getByRole("dialog");
    expect(sheet).toBeInTheDocument();
    expect(
      within(sheet).getByPlaceholderText(/remember for later/i)
    ).toHaveValue("still here");
    // The message must be INSIDE the sheet. The storage banner lives in `#root`,
    // which the sheet marks inert and covers completely on a phone, so on the one
    // failure the user is watching for it is unreadable and its buttons are
    // unclickable. Held-open-and-silent is the same silent failure one layer up.
    expect(within(sheet).getByRole("alert")).toHaveTextContent(
      "Couldn’t save this shot"
    );
  });

  it("offers a working Export inside the sheet, where Settings is unreachable", async () => {
    // Retry is the only other move, and on a genuinely full device it keeps
    // failing — so "go to Settings and export" is advice the user cannot take
    // from a sheet that covers Settings.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const download = vi
      .spyOn(dl, "tryDownloadTextFile")
      .mockImplementation(() => true);
    seedShots([{ id: "old", date: "2026-06-01", notes: "already logged" }]);
    breakWrites();
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    const sheet = screen.getByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: "Save shot" }));

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Export a backup",
      })
    );

    expect(download).toHaveBeenCalledTimes(1);
    const [text, name, mime] = download.mock.calls[0];
    expect(name).toMatch(/\.json$/);
    expect(mime).toBe("application/json");
    // It rescues the history, which is what it claims to do...
    expect(text).toContain("already logged");
    // ...and the sheet stays open, because the shot on screen is NOT in the file.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not fake a save when Save lands during the sheet's exit animation", () => {
    // The sheet stays mounted through its exit, and only `#root` is inert, so its
    // own Save button is still live for those ~200ms. The closing guard returned
    // nothing, and the form reads anything but `false` as saved — so a Save in
    // that window blanked every field and cleared the failure message as though
    // the shot had been written. Nothing had.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    breakWrites();
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    const notes = () =>
      within(screen.getByRole("dialog")).getByPlaceholderText(/remember for later/i);
    fireEvent.change(notes(), { target: { value: "still here" } });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
    );
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toBeInTheDocument();

    // Dismiss, then Save again before the exit animation has finished.
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Close" })
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save again" })
    );

    expect(notes()).toHaveValue("still here");
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toBeInTheDocument();
    expect(localStorage.getItem("hrt-shot-tracker:v1:shots")).toBeNull();
  });

  it("says nothing when a Save is dropped during the sheet's exit — the shot DID save", () => {
    // The closing guard and a refused write used to share `false`, and the form
    // can only read that one way. So a double-tapped Save — the codebase's own
    // comment notes 200ms is precisely a double-tap — announced "Couldn't save
    // this shot" over a shot that had just saved perfectly, assertively, as the
    // sheet slid away. The obvious response is to log it again: a duplicate, with
    // no undo until slice C.
    renderApp(); // storage working
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    const sheet = () => within(screen.getByRole("dialog"));
    fireEvent.change(sheet().getByPlaceholderText(/remember for later/i), {
      target: { value: "saved fine" },
    });
    fireEvent.click(sheet().getByRole("button", { name: "Save shot" }));

    // The submit now confirms with a ✓ and is disabled for that beat, so the
    // second tap of a double-tap cannot land at all — a stronger guarantee than
    // the closing guard, which stays because the button becomes live again for
    // the exit that follows.
    // `aria-disabled`, not `disabled`: disabling the focused button would blur
    // it and drop focus to <body> for the whole confirm + exit.
    const confirmed = sheet().getByRole("button", { name: "✓ Saved" });
    expect(confirmed).toHaveAttribute("aria-disabled", "true");
    expect(confirmed).not.toBeDisabled();
    fireEvent.click(confirmed);

    expect(sheet().queryByRole("alert")).not.toBeInTheDocument();
    expect(sheet().queryByRole("button", { name: "Save again" })).not.toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem("hrt-shot-tracker:v1:shots") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].notes).toBe("saved fine");
  });

  it("holds the ✓ through the slide, and still drops a Save that lands there", () => {
    // Two things at once, because they are the same moment.
    //
    // The ✓ must survive the whole exit: retiring it when the slide STARTED put
    // "Save shot" back on screen while the sheet was still visibly leaving,
    // which reads as the save being taken back.
    //
    // And a press landing in that window must still write nothing. The button is
    // never truly `disabled` (that would blur it and strand focus on <body>), so
    // something has to drop the press — here it is ShotForm's own `confirming`
    // guard. The `closingRef` guard behind it covers the dismissal path, where
    // there is no ✓ at all; "does not save a shot that was just dismissed" is
    // the test that exercises it.
    vi.useFakeTimers();
    try {
      renderApp();
      fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
      const sheet = () => within(screen.getByRole("dialog"));
      fireEvent.change(sheet().getByPlaceholderText(/remember for later/i), {
        target: { value: "once only" },
      });
      fireEvent.click(sheet().getByRole("button", { name: "Save shot" }));

      // Past the ✓ beat, into the slide.
      act(() => {
        vi.advanceTimersByTime(CONFIRM_MS);
      });
      const submit = sheet().getByRole("button", { name: "✓ Saved" });
      expect(sheet().queryByRole("button", { name: "Save shot" })).not.toBeInTheDocument();

      fireEvent.click(submit);

      expect(sheet().queryByRole("alert")).not.toBeInTheDocument();
      const stored = JSON.parse(localStorage.getItem("hrt-shot-tracker:v1:shots") ?? "[]");
      expect(stored).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves the typed entry on screen under the ✓", () => {
    // The form used to clear its per-shot fields on a successful save, which was
    // invisible while the sheet left immediately. With the ✓ beat the sheet holds
    // still for CONFIRM_MS and then takes SHEET_EXIT_MS to slide, so the user
    // watched what they had just typed empty itself for ~440ms under a message
    // saying it had been saved.
    vi.useFakeTimers();
    try {
      renderApp();
      fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
      const sheet = () => within(screen.getByRole("dialog"));
      fireEvent.change(sheet().getByPlaceholderText(/remember for later/i), {
        target: { value: "sore today, left side" },
      });
      fireEvent.change(sheet().getByLabelText("Injection site"), {
        target: { value: "Left thigh" },
      });
      fireEvent.click(sheet().getByRole("button", { name: "Save shot" }));

      // On the ✓, sheet motionless and fully on screen.
      expect(sheet().getByPlaceholderText(/remember for later/i)).toHaveValue(
        "sore today, left side"
      );
      expect(sheet().getByLabelText("Injection site")).toHaveValue("Left thigh");

      // ...and still there through the slide, which is most of the 440ms.
      act(() => {
        vi.advanceTimersByTime(CONFIRM_MS);
      });
      expect(sheet().getByPlaceholderText(/remember for later/i)).toHaveValue(
        "sore today, left side"
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens a NEW shot mid-exit of an edit, rather than reopening that edit", () => {
    // The exit timer is what clears `editingShot`, and openSheet cancels it — so
    // without retiring the subject here, an interrupted edit stayed current.
    // The sheet reopened titled "Edit shot", and because its key is that shot's
    // id the openCount bump did not force a remount either, so Save routed
    // through handleUpdateShot and OVERWROTE the entry instead of adding one.
    vi.useFakeTimers();
    try {
      seedShots([{ id: "a", date: "2026-06-01", notes: "the original" }]);
      renderApp();
      goTo("History");
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      fireEvent.change(
        within(screen.getByRole("dialog")).getByPlaceholderText(/remember for later/i),
        { target: { value: "an edit" } }
      );
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Update shot" })
      );

      // Mid-exit — the sheet is still mounted, its timer still pending.
      act(() => {
        vi.advanceTimersByTime(CONFIRM_MS);
      });
      goTo("Home");
      fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));

      const sheet = within(screen.getByRole("dialog"));
      expect(sheet.getByRole("heading", { name: "Log a shot" })).toBeInTheDocument();
      expect(sheet.getByRole("button", { name: "Save shot" })).toBeInTheDocument();

      fireEvent.change(sheet.getByPlaceholderText(/remember for later/i), {
        target: { value: "a second, separate shot" },
      });
      fireEvent.click(sheet.getByRole("button", { name: "Save shot" }));
      act(() => {
        vi.advanceTimersByTime(CONFIRM_MS + SHEET_EXIT_MS);
      });

      // Two entries, and the edited one still holds its edit.
      const stored: ShotEntry[] = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.shots) ?? "[]"
      );
      expect(stored).toHaveLength(2);
      expect(stored.find((s) => s.id === "a")?.notes).toBe("an edit");
      expect(
        stored.some((s) => s.notes === "a second, separate shot")
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reopens the sheet with a fresh form, even mid-exit", () => {
    // The new-shot form used to be keyed on the constant "new", so reopening
    // while a save was still leaving reused the mounted form: the entry that had
    // just been saved, still on screen, with `confirming` cleared and Save live
    // — one press from a duplicate, and no undo until slice C. `#root` being
    // inert is what made that unreachable, which is a reason it can't happen
    // rather than a reason it can't be.
    vi.useFakeTimers();
    try {
      renderApp();
      fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
      fireEvent.change(
        within(screen.getByRole("dialog")).getByPlaceholderText(/remember for later/i),
        { target: { value: "the saved one" } }
      );
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
      );

      // Mid-exit, before the sheet has unmounted.
      act(() => {
        vi.advanceTimersByTime(CONFIRM_MS);
      });
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));

      const sheet = within(screen.getByRole("dialog"));
      expect(sheet.getByPlaceholderText(/remember for later/i)).toHaveValue("");
      expect(sheet.getByRole("button", { name: "Save shot" })).toBeInTheDocument();

      // And saving that fresh form does not write the saved entry a second time.
      fireEvent.click(sheet.getByRole("button", { name: "Save shot" }));
      act(() => {
        vi.advanceTimersByTime(CONFIRM_MS + SHEET_EXIT_MS);
      });
      const stored: ShotEntry[] = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.shots) ?? "[]"
      );
      expect(stored.filter((s) => s.notes === "the saved one")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets Escape cut the ✓ short instead of swallowing it", () => {
    // The dismissal window is 440ms now and motionless for the first 200. A
    // dismissal there is an ordinary request — the shot is saved and the beat is
    // a courtesy — so it starts the slide rather than doing nothing. It mattered
    // most on Android: the first Back spends the overlay's history entry, so a
    // reflexive second one popped a REAL entry and left the app with the sheet
    // still painted over it.
    vi.useFakeTimers();
    try {
      renderApp();
      fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
      fireEvent.change(
        within(screen.getByRole("dialog")).getByPlaceholderText(/remember for later/i),
        { target: { value: "impatient" } }
      );
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
      );

      // Escape 50ms in, well before the ✓ would have ended on its own.
      act(() => {
        vi.advanceTimersByTime(50);
      });
      fireEvent.keyDown(window, { key: "Escape" });

      // The slide is already running: SHEET_EXIT_MS from HERE, not from the end
      // of the beat it cut short.
      act(() => {
        vi.advanceTimersByTime(SHEET_EXIT_MS);
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // Saved exactly once, and the dismissal did not park it as a draft to log
      // all over again.
      const stored: ShotEntry[] = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.shots) ?? "[]"
      );
      expect(stored).toHaveLength(1);
      fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
      expect(
        within(screen.getByRole("dialog")).getByPlaceholderText(/remember for later/i)
      ).toHaveValue("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores Clear form during the ✓", () => {
    // The sheet is fully on screen and still for CONFIRM_MS, and this is the one
    // control there that changes what you are looking at: it blanks every field
    // and moves focus. Live, it reproduced the entry-empties-itself defect that
    // deleting the post-save reset had just fixed.
    vi.useFakeTimers();
    try {
      renderApp();
      fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
      const sheet = () => within(screen.getByRole("dialog"));
      fireEvent.change(sheet().getByPlaceholderText(/remember for later/i), {
        target: { value: "still here" },
      });
      fireEvent.click(sheet().getByRole("button", { name: "Save shot" }));

      fireEvent.click(sheet().getByRole("button", { name: "Clear form" }));

      expect(sheet().getByPlaceholderText(/remember for later/i)).toHaveValue(
        "still here"
      );
      act(() => {
        vi.advanceTimersByTime(CONFIRM_MS + SHEET_EXIT_MS);
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("holds the delete confirm open when the deletion can't be written", async () => {
    // A refused delete commits nothing, so the shot is still listed. Closing the
    // dialog anyway dismissed as though it had worked — and a later "Try again"
    // then force-wrote the UNCHANGED list, succeeded, and cleared the banner: a
    // green all-clear over a delete that never happened.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    seedShots([{ id: "a", date: "2026-06-01", notes: "keep me" }]);
    renderApp();
    goTo("History");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    breakWrites();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" })
    );

    const confirm = within(screen.getByRole("dialog"));
    expect(confirm.getByRole("alert")).toHaveTextContent(/Couldn.t delete it/);
    expect(confirm.getByText(/still here/)).toBeInTheDocument();
    // And the shot really is still there, in state and in storage.
    expect(
      JSON.parse(localStorage.getItem("hrt-shot-tracker:v1:shots") ?? "[]")
    ).toHaveLength(1);
  });

  it("deletes normally, and closes, once the write lands", async () => {
    seedShots([{ id: "a", date: "2026-06-01" }]);
    renderApp();
    goTo("History");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" })
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(
      JSON.parse(localStorage.getItem("hrt-shot-tracker:v1:shots") ?? "[]")
    ).toHaveLength(0);
  });

  it("says so when the backup download itself is blocked", () => {
    // The export button is the last recovery on a device that has stopped saving.
    // Unguarded, a throw from this handler escapes React entirely (error
    // boundaries don't catch event handlers) and the button just looks dead —
    // this feature's own bug, inside its own escape hatch.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(dl, "tryDownloadTextFile").mockImplementation(() => false);
    breakWrites();
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Export a backup" })
    );

    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent(
      /download didn.t start/i
    );
  });

  it("relabels Save to 'Save again' after a refused write, and back on success", () => {
    // "Save shot" would be naming an outcome the last press did not produce. The
    // button IS the retry, so it says so — while keeping the verb, so it never
    // stops naming what it acts on.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const spy = breakWrites();
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    const inSheet = () => within(screen.getByRole("dialog"));
    expect(inSheet().getByRole("button", { name: "Save shot" })).toBeInTheDocument();

    fireEvent.click(inSheet().getByRole("button", { name: "Save shot" }));
    expect(inSheet().getByRole("button", { name: "Save again" })).toBeInTheDocument();
    expect(inSheet().queryByRole("button", { name: "Save shot" })).not.toBeInTheDocument();

    // It stays relabelled while it keeps failing, rather than flickering back.
    fireEvent.click(inSheet().getByRole("button", { name: "Save again" }));
    expect(inSheet().getByRole("button", { name: "Save again" })).toBeInTheDocument();

    // And the shot lands on the retry.
    spy.mockRestore();
    fireEvent.click(inSheet().getByRole("button", { name: "Save again" }));
    expect(
      JSON.parse(localStorage.getItem("hrt-shot-tracker:v1:shots") ?? "[]")
    ).toHaveLength(1);
  });

  it("relabels an EDIT's button with ITS verb, not the new-shot one", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    seedShots([{ id: "a", date: "2026-06-01", notes: "before" }]);
    renderApp();
    goTo("History");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Update shot" })
    ).toBeInTheDocument();

    // A real change, so there is genuinely something to write. Saving an
    // untouched edit writes nothing and so cannot fail — correct, but it would
    // make this test pass without exercising anything.
    fireEvent.change(
      within(screen.getByRole("dialog")).getByPlaceholderText(/remember for later/i),
      { target: { value: "after" } }
    );
    breakWrites();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Update shot" })
    );

    // "Update again", not "Save again": the retry keeps the verb the action had,
    // so the button never stops naming what it does.
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Update again" })
    ).toBeInTheDocument();
  });

  it("starts a NEW entry with 'Save shot', never inheriting the last one's failure", async () => {
    // The label has to reset itself, or the next shot opens already looking
    // broken. It rides on the form's own lifetime — the sheet unmounts on close —
    // so there is nothing to persist and nothing to time out.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const spy = breakWrites();
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
    );
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save again" })
    ).toBeInTheDocument();

    // Dismiss, let the sheet finish leaving, and open a fresh one.
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Close" })
    );
    await sheetGone();
    spy.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));

    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByRole("button", { name: "Save shot" })).toBeInTheDocument();
    expect(sheet.queryByRole("button", { name: "Save again" })).not.toBeInTheDocument();
    // ...and no stale failure message riding along with it.
    expect(sheet.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the form's retry distinct from the banner's, so both stay unambiguous", () => {
    // The banner says "Try again" because it retries every store from a screen
    // with no other button. The form's button is the save itself, so it keeps the
    // verb. Both are on screen together after a failed save, and a bare "Try
    // again" in two places doing two different things is how a screen-reader user
    // ends up pressing the wrong one.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    breakWrites();
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
    );

    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByRole("button", { name: "Save again" })).toBeInTheDocument();
    // The sheet's own retry is never the banner's word...
    expect(sheet.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    // ...and every label the button can take still names the action.
    expect(
      sheet.getByRole("button", { name: "Save again" }).textContent
    ).toMatch(/^Save /);
  });

  it("takes the label back when 'Clear form' starts the entry over", () => {
    // Clearing is starting over, so the failed-save state has to go with the
    // values it referred to. Left behind, the button says "Save again" over an
    // empty form, referring to an attempt whose contents no longer exist.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    breakWrites();
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    const inSheet = () => within(screen.getByRole("dialog"));
    fireEvent.change(inSheet().getByPlaceholderText(/remember for later/i), {
      target: { value: "something" },
    });
    fireEvent.click(inSheet().getByRole("button", { name: "Save shot" }));
    expect(inSheet().getByRole("button", { name: "Save again" })).toBeInTheDocument();

    fireEvent.click(inSheet().getByRole("button", { name: "Clear form" }));

    expect(inSheet().getByRole("button", { name: "Save shot" })).toBeInTheDocument();
    expect(inSheet().queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not put the unsaved shot in the list, so retrying can't duplicate it", () => {
    // The first build added the shot to in-memory state on failure "so nothing
    // typed disappears". The form already holds it — and because ShotForm mints a
    // fresh id per submit, pressing Save again (the obvious reaction to nothing
    // happening, and the right one once storage recovers) appended a SECOND
    // entry. With no undo until slice C that writes real duplicate history.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const spy = breakWrites();
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    fireEvent.change(
      within(screen.getByRole("dialog")).getByPlaceholderText(/remember for later/i),
      { target: { value: "only once" } }
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
    );
    // Nothing entered the list: the form is the only copy, which is the point.
    expect(localStorage.getItem("hrt-shot-tracker:v1:shots")).toBeNull();

    // Storage comes back and the user presses the retry on the held-open sheet.
    spy.mockRestore();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save again" })
    );

    const stored = JSON.parse(
      localStorage.getItem("hrt-shot-tracker:v1:shots") ?? "[]"
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].notes).toBe("only once");
  });

  it("closes and clears as normal when the write lands", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
    );
    await sheetGone();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("App — a failed EDIT is held open too", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the edit sheet and its changes when the write fails", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    seedShots([{ id: "a", date: "2026-06-01", notes: "before" }]);
    renderApp();
    goTo("History");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(
      within(screen.getByRole("dialog")).getByPlaceholderText(/remember for later/i),
      { target: { value: "after" } }
    );

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Update shot" })
    );

    const sheet = screen.getByRole("dialog");
    expect(sheet).toBeInTheDocument();
    expect(
      within(sheet).getByPlaceholderText(/remember for later/i)
    ).toHaveValue("after");
    expect(within(sheet).getByRole("alert")).toHaveTextContent(
      "Couldn’t save this shot"
    );
    // The list still shows the OLD value: refusing to commit an unwritable change
    // is what keeps the screen and storage telling the same story.
    expect(JSON.parse(localStorage.getItem("hrt-shot-tracker:v1:shots") ?? "[]")[0].notes)
      .toBe("before");
  });
});

// The shared guard, applied across flows rather than case by case. Four of slice
// B's nine focus defects were exactly this condition, each found by hand after
// review; this covers every interaction that removes the element holding focus,
// which is the whole population the bug can come from.
//
// jsdom sees neither `inert` nor CSS, so "the trap is escapable" and "the ring
// is invisible" — the other two shapes among the nine — stay Playwright checks.
describe("focus is never left on <body>", () => {
  // Scoped restore, matching the other two mocking blocks in this file. One test
  // here spies on Storage.prototype.setItem; restoring inline at the end of it
  // means a failure earlier in the test leaks a THROWING setItem into every
  // later test. `unstubGlobals` does not cover spies — this file has already
  // been bitten once by exactly that.
  afterEach(() => vi.restoreAllMocks());

  it("survives opening and dismissing the log sheet", async () => {
    renderApp();
    // Focus the opener first. `fireEvent.click` does not focus what it clicks
    // (nor does Safari), so without this the guard starts from <body> and passes
    // vacuously — there is no stranding to detect if nothing was held.
    const opener = screen.getByRole("button", { name: /Log a shot/ });
    opener.focus();
    withFocusGuard("after opening the log sheet", () => fireEvent.click(opener));
    dismissSheet();
    await sheetGone();
    await expectFocusSettled("after dismissing the log sheet");
    expectVisibleFocusRing("after dismissing the log sheet");
  });

  it("survives saving a shot", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
    );
    await sheetGone();
    await expectFocusSettled("after saving a shot");
    expectVisibleFocusRing("after saving a shot");
  });

  it("survives 'Clear form', which removes the link that was clicked", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    const sheet = () => within(screen.getByRole("dialog"));
    fireEvent.change(sheet().getByPlaceholderText(/remember for later/i), {
      target: { value: "something" },
    });
    withFocusGuard("after Clear form", () =>
      fireEvent.click(sheet().getByRole("button", { name: "Clear form" }))
    );
    expectVisibleFocusRing("after Clear form");
  });

  it("survives editing a shot from History", async () => {
    seedShots([{ id: "a", date: "2026-06-01", notes: "x" }]);
    renderApp();
    goTo("History");
    const editBtn = screen.getByRole("button", { name: "Edit" });
    editBtn.focus(); // see the note on the log-sheet guard above
    withFocusGuard("after opening an edit sheet", () => fireEvent.click(editBtn));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Update shot" })
    );
    await sheetGone();
    await expectFocusSettled("after saving an edit");
    expectVisibleFocusRing("after saving an edit");
  });

  it("survives deleting a shot — the confirm removes the row that opened it", async () => {
    seedShots([
      { id: "a", date: "2026-06-01" },
      { id: "b", date: "2026-06-08" },
    ]);
    renderApp();
    goTo("History");
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" })
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    await expectFocusSettled("after deleting a shot");
    expectVisibleFocusRing("after deleting a shot");
  });

  it("survives deleting the LAST shot, when there is no row left to receive focus", async () => {
    seedShots([{ id: "only", date: "2026-06-01" }]);
    renderApp();
    goTo("History");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" })
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    await expectFocusSettled("after deleting the only shot");
    expectVisibleFocusRing("after deleting the only shot");
  });

  it("survives every tab change", () => {
    // Focus the tab first. jsdom's fireEvent.click does not focus what it clicks
    // (nor does Safari), so without this the guard would start from <body> and
    // pass vacuously — there is no stranding to detect if nothing was held.
    renderApp();
    const nav = () => within(screen.getByRole("navigation"));
    for (const tab of ["History", "Settings", "Home"] as const) {
      const button = nav().getByRole("button", { name: tab });
      button.focus();
      withFocusGuard(`after navigating to ${tab}`, () => fireEvent.click(button));
    }
  });

  it("survives the skip link, which must not poison later focus restores", async () => {
    renderApp();
    const skip = screen.getByRole("link", { name: /Skip to navigation/i });
    skip.focus(); // a skip link is only ever reached BY keyboard, so this is realistic
    withFocusGuard("after using the skip link", () => fireEvent.click(skip));
    // The whole point of the link: it must actually land somewhere, visibly.
    expectFocusSomewhereUseful("after using the skip link");
    expectVisibleFocusRing("after using the skip link");
    // ...and a dialog opened afterwards still restores focus properly, rather
    // than to whatever the skip link left in the URL.
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    dismissSheet();
    await sheetGone();
    await expectFocusSettled("after a sheet opened following the skip link");
  });

  it("survives a save that storage refuses, where the sheet stays open", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    withFocusGuard("after a refused save", () =>
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
      )
    );
  });
});

describe("the post-log acknowledgement", () => {
  const ACK = "Logged for you.";
  const greeting = () => document.querySelector(".greeting")?.textContent;
  /** The portaled, always-mounted live region — the thing AT actually hears. */
  const announced = () =>
    document.querySelector("body > .visually-hidden[role='status']")?.textContent;
  const washedRows = () =>
    document.querySelectorAll(".shot-list-item--washing").length;

  /** Log a shot and let the ✓ beat pass, leaving the sheet mid-exit. */
  const logAShot = async (notes = "a shot") => {
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    fireEvent.change(
      within(screen.getByRole("dialog")).getByPlaceholderText(/remember for later/i),
      { target: { value: notes } }
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
    );
    await sheetGone();
  };

  it("says 'Logged for you.' after a save, in place of the greeting", async () => {
    renderApp();
    expect(greeting()).not.toContain(ACK);
    await logAShot();
    expect(greeting()).toBe(ACK);
  });

  it("announces it from a live region outside the inert app root", async () => {
    // The greeting swaps while the sheet still has #root inert, and `inert`
    // removes a subtree from the accessibility tree — so a live region there is
    // mutated while nobody can hear it, and there is no second change once inert
    // lifts. The announcing region is portaled to <body> and always mounted,
    // because a live region does not announce its initial content.
    renderApp();
    const region = document.querySelector("body > .visually-hidden[role='status']");
    expect(region).toBeTruthy();
    expect(region).not.toBe(document.querySelector(".greeting"));
    expect(announced()).toBe("");

    await logAShot();
    expect(announced()).toBe(ACK);

    goTo("History");
    expect(announced()).toBe("");
  });

  it("announces only once the dialog is gone", async () => {
    // Portaling the region out of `#root` dodges the `inert` the sheet applies,
    // but the dialog also carries aria-modal="true", which tells assistive tech
    // to ignore everything outside it. A live region announces CHANGES, so a
    // change made while the dialog is still up is not re-announced when it
    // leaves — there is no second chance. Wait for the dialog to go instead.
    vi.useFakeTimers();
    try {
      renderApp();
      fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
      );
      expect(announced()).toBe(""); // during the ✓

      act(() => {
        vi.advanceTimersByTime(CONFIRM_MS);
      });
      expect(screen.queryByRole("dialog")).toBeInTheDocument(); // mid-slide
      expect(announced()).toBe("");

      act(() => {
        vi.advanceTimersByTime(SHEET_EXIT_MS);
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(announced()).toBe(ACK);
    } finally {
      vi.useRealTimers();
    }
  });

  it("comes back to the greeting when the app is reopened", async () => {
    // The third retirement route, alongside opening the form and changing tab.
    // A reload would clear this for free, but "reopening the app" usually is not
    // a reload — switching apps and back, or leaving the tab open overnight,
    // keeps this component mounted, and the line has no timer of its own.
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: yearsAgoLocal(1) })
    );
    renderApp();
    const milestone = greeting();
    await logAShot();
    expect(greeting()).toBe(ACK);

    // Away...
    setVisibility("hidden");
    expect(greeting()).toBe(ACK); // still there while the app is in the background
    // ...and back.
    setVisibility("visible");

    expect(greeting()).toBe(milestone);
    expect(announced()).toBe("");
  });

  it("says nothing if the app was put away before the sheet finished leaving", () => {
    // Both halves are armed 440ms after the save, and timers are suspended
    // rather than throttled on iOS Safari and anything restored from bfcache —
    // so tapping Save and locking the phone leaves that callback to run on
    // RESUME, after the visibility sweep has already been and gone. It would arm
    // the acknowledgement at the exact moment it is supposed to be retired, and
    // what you would see on unlocking is "Logged for you." over the milestone it
    // is meant to defer to. The shot is saved either way.
    vi.useFakeTimers();
    try {
      renderApp();
      fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
      );

      // The ORDER is the whole point, and getting it backwards is what hid a
      // worthless first fix: the timer does not run while the app is away, it
      // runs on RESUME. So the sweep happens first and finds nothing, and a
      // fix that asks "is the page visible?" from inside the callback is told
      // "yes" and arms anyway.
      setVisibility("hidden");
      setVisibility("visible");
      act(() => {
        vi.advanceTimersByTime(CONFIRM_MS + SHEET_EXIT_MS);
      });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); // still closed
      expect(greeting()).not.toBe(ACK);
      expect(announced()).toBe("");
      expect(washedRows()).toBe(0);
      // ...and the shot is saved regardless.
      expect(
        JSON.parse(localStorage.getItem(STORAGE_KEYS.shots) ?? "[]")
      ).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the same words whether or not a name is set", async () => {
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ preferredName: "Lou" })
    );
    renderApp();
    expect(greeting()).toContain("Lou"); // the ordinary greeting does use it
    await logAShot();
    expect(greeting()).toBe(ACK); // ...and the acknowledgement never does
  });

  it("outranks a milestone, but only until the next deliberate action", async () => {
    // A milestone is the bigger landmark, so it must be DEFERRED rather than
    // eclipsed — it is still there when you look again.
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: yearsAgoLocal(1) })
    );
    renderApp();
    const milestone = greeting();
    expect(milestone).toMatch(/1 year/i);

    await logAShot();
    expect(greeting()).toBe(ACK);

    goTo("History");
    goTo("Home");
    expect(greeting()).toBe(milestone);
  });

  it("clears when the log form is opened again", async () => {
    renderApp();
    await logAShot();
    expect(greeting()).toBe(ACK);

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    expect(greeting()).not.toBe(ACK);
  });

  it("says nothing when the save is refused", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
    );
    expect(greeting()).not.toBe(ACK);
    expect(washedRows()).toBe(0);
    vi.restoreAllMocks();
  });

  it("gives a retry that succeeds the full acknowledgement", async () => {
    // The natural mistake is to treat "this errored a moment ago" as a reason to
    // stay quiet. The shot was still taken.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("QuotaExceededError");
      });
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
    );
    expect(greeting()).not.toBe(ACK);

    spy.mockRestore();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save again" })
    );
    await sheetGone();

    expect(greeting()).toBe(ACK);
    expect(washedRows()).toBe(1);
    vi.restoreAllMocks();
  });

  it("says nothing when the sheet is dismissed", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    dismissSheet();
    await sheetGone();
    expect(greeting()).not.toBe(ACK);
    expect(washedRows()).toBe(0);
  });

  it("says nothing when an existing shot is edited", async () => {
    // "Logged for you." is about logging a shot, not correcting one.
    seedShots([{ id: "a", date: "2026-06-01", notes: "before" }]);
    renderApp();
    goTo("History");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(
      within(screen.getByRole("dialog")).getByPlaceholderText(/remember for later/i),
      { target: { value: "after" } }
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Update shot" })
    );
    await sheetGone();
    goTo("Home");
    expect(greeting()).not.toBe(ACK);
  });
});

describe("the post-log wash", () => {
  /**
   * Fire a real `animationend` carrying `animationName`.
   *
   * `fireEvent.animationEnd(el, { animationName })` silently drops the property
   * in jsdom — it arrives as `undefined` — so driving the guard needs an event
   * built by hand. Worth knowing before concluding the guard is broken.
   */
  const endAnimation = (el: Element, animationName: string) => {
    const evt = new Event("animationend", { bubbles: true });
    Object.defineProperty(evt, "animationName", { value: animationName });
    fireEvent(el, evt);
  };

  const washed = () =>
    [...document.querySelectorAll(".shot-list-item--washing")].map(
      (el) => el.querySelector(".shot-list-item__date")?.textContent
    );

  const logAShot = async () => {
    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
    );
    await sheetGone();
  };

  it("arms the wash when the sheet leaves, not when the shot is saved", async () => {
    // Measured in a browser: the sheet covers the screen for the ✓ plus the
    // slide, ~440ms, which is almost exactly the 20% the wash spends holding at
    // full tint. Armed at save time the whole hold happened behind the sheet and
    // what you saw was a tint already fading — the flash the hold exists to make.
    vi.useFakeTimers();
    try {
      renderApp();
      fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
      );

      // Still confirming, sheet still up: nothing washing yet.
      expect(document.querySelectorAll(".shot-list-item--washing")).toHaveLength(0);
      act(() => {
        vi.advanceTimersByTime(CONFIRM_MS);
      });
      // Mid-slide: still nothing.
      expect(document.querySelectorAll(".shot-list-item--washing")).toHaveLength(0);

      act(() => {
        vi.advanceTimersByTime(SHEET_EXIT_MS);
      });
      expect(document.querySelectorAll(".shot-list-item--washing")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the wash's last frame until the class goes, in both motion modes", () => {
    // A CSS animation stops applying the instant it ends, so with no fill mode
    // opacity reverted to its underlying value — 1, since nothing else sets it —
    // and the overlay snapped back to FULL tint for the frame (or more) before
    // React's onAnimationEnd re-render dropped the class. The wash ended in a
    // green flash instead of a fade, which no jsdom test can see and only a
    // screenshot can settle.
    //
    // Both rules, because `animation` is a SHORTHAND: the reduced-motion
    // override resets fill-mode to `none` and silently reintroduces the flash.
    // Comments are stripped FIRST. Both rules explain the fill mode in prose, so
    // matching the raw body found the word "forwards" in the comment and passed
    // with the declaration itself deleted — a test that asked whether the rule
    // was documented, not whether it was set.
    const css = readFileSync(`${process.cwd()}/src/styles.css`, "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      ""
    );
    const rules = [
      ...css.matchAll(/\.shot-list-item--washing::after\s*\{([^}]*)\}/g),
    ];

    expect(rules).toHaveLength(2); // base + the reduced-motion override
    for (const [, body] of rules) expect(body).toMatch(/animation:[^;]*\bforwards\b/);
  });

  it("arms no wash for a shot the teaser will not show", async () => {
    // A backdated entry logged behind three newer ones never enters the teaser,
    // so no row mounts to play the animation — and `animationend` is the only
    // thing that retires the state. Left armed, it waits for the teaser to
    // change underneath it (a cross-tab delete, a backup import) and then plays
    // a full wash for an entry nobody just logged.
    seedShots([
      { id: "n1", date: "2026-08-01" },
      { id: "n2", date: "2026-08-02" },
      { id: "n3", date: "2026-08-03" },
    ]);
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText("Date"), {
      target: { value: "2026-01-05" },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
    );
    await sheetGone();

    expect(washed()).toEqual([]);
    // The words are not conditional on a visible row: the shot was still logged.
    expect(
      document.querySelector("body > .visually-hidden[role='status']")?.textContent
    ).toBe("Logged for you.");

    // Nothing is left armed, so the older entry cannot wash later when it
    // reaches the teaser — here by the three newer ones going away in another
    // tab. It has to be the REAL saved shot, read back from storage: seeding an
    // invented id let this pass with the fix reverted, since nothing matched
    // whatever was armed.
    const stored: ShotEntry[] = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.shots) ?? "[]"
    );
    const backdated = stored.find((s) => s.date === "2026-01-05");
    expect(backdated).toBeDefined();

    // A storage event carries the new value; the listener never re-reads. An
    // event without `newValue` and `storageArea` is ignored outright, which is
    // how the first version of this test watched nothing happen and passed.
    const fromOtherTab = JSON.stringify([backdated]);
    seedShots([backdated!]);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEYS.shots,
          newValue: fromOtherTab,
          storageArea: localStorage,
        })
      );
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(1); // it IS in the teaser now
    expect(washed()).toEqual([]);
  });

  it("retires a wash whose row leaves the teaser mid-animation", async () => {
    // The other way a row never sends `animationend`: it unmounts while the wash
    // is still playing. Another tab deleting a shot, or a backup import, arrives
    // through the storage listener at any moment. Left armed, the id waits for
    // the teaser to change back and then washes an entry nobody just logged.
    renderApp();
    await logAShot();
    expect(washed()).toHaveLength(1);

    const stored: ShotEntry[] = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.shots) ?? "[]"
    );
    const logged = stored[0];
    const other: ShotEntry = { id: "other", date: "2026-07-01" };

    // Another tab replaces the list without the washing shot in it.
    const withoutIt = JSON.stringify([other]);
    localStorage.setItem(STORAGE_KEYS.shots, withoutIt);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEYS.shots,
          newValue: withoutIt,
          storageArea: localStorage,
        })
      );
    });
    expect(washed()).toEqual([]);

    // ...and when it comes back — restoring that backup — it arrives unwashed.
    const withItAgain = JSON.stringify([other, logged]);
    localStorage.setItem(STORAGE_KEYS.shots, withItAgain);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEYS.shots,
          newValue: withItAgain,
          storageArea: localStorage,
        })
      );
    });
    expect(washed()).toEqual([]);
  });

  it("washes a shot logged on a day that already has three", async () => {
    // The end-to-end version of the ordering fix. With an id tiebreak, a
    // just-logged shot could sort below three same-day ones, never enter the
    // teaser, and get no wash — while the greeting still said "Logged for you.",
    // telling the user it landed and showing them nothing arriving.
    seedShots([
      { id: "zzz1", date: todayLocalISO(), notes: "older A" },
      { id: "zzz2", date: todayLocalISO(), notes: "older B" },
      { id: "zzz3", date: todayLocalISO(), notes: "older C" },
    ]);
    renderApp();
    await logAShot();

    expect(washed()).toHaveLength(1);
    // ...and it is the new row, at the top of the teaser.
    const rows = screen.getAllByRole("listitem");
    expect(rows[0].className).toContain("shot-list-item--washing");
  });

  it("washes only the shot just logged, not every row", async () => {
    seedShots([
      { id: "old1", date: "2026-06-01" },
      { id: "old2", date: "2026-06-08" },
    ]);
    renderApp();
    await logAShot();

    expect(washed()).toEqual([todayLocalISO()]);
  });

  it("does not carry the ✓ into the next sheet", async () => {
    // openSheet exists to stop any route inheriting a half-finished exit, and
    // `confirming` is part of that state. Left set, the next sheet mounts with a
    // submit that reads "✓ Saved" and refuses to save — with no way to log a
    // shot until reload. Unreachable by pointer today only because `#root` is
    // inert during the beat, which is one attribute standing between this and a
    // dead form.
    vi.useFakeTimers();
    try {
      renderApp();
      fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Save shot" })
      );
      expect(
        within(screen.getByRole("dialog")).getByRole("button", { name: "✓ Saved" })
      ).toBeInTheDocument();

      // Re-open mid-beat (jsdom does not enforce inert, which is what lets this
      // be tested at all).
      fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));

      const sheet = within(screen.getByRole("dialog"));
      expect(sheet.getByRole("button", { name: "Save shot" })).toBeInTheDocument();
      expect(sheet.getByRole("button", { name: "Save shot" })).toHaveAttribute(
        "aria-disabled",
        "false"
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("retires the wash when the log form is opened over it", async () => {
    // At phone widths the sheet covers the row completely, so a wash left
    // running would spend its life behind it — the same way the hold did before
    // it was moved to arm on exit.
    renderApp();
    await logAShot();
    expect(document.querySelectorAll(".shot-list-item--washing")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));

    expect(document.querySelectorAll(".shot-list-item--washing")).toHaveLength(0);
  });

  it("moves the wash to the newest row without recreating the older one", async () => {
    // The prototype's bug was a class reapplied by a re-render restarting the
    // animation. Keying it to the shot's id means React leaves both the element
    // and an unchanged className alone, so the older row is the same node and
    // simply stops washing.
    renderApp();
    await logAShot();
    const first = document.querySelector(".shot-list-item")!;
    expect(first.className).toContain("shot-list-item--washing");

    await logAShot();

    const rows = [...document.querySelectorAll(".shot-list-item")];
    expect(rows).toContain(first); // same node, not rebuilt
    expect(first.className).not.toContain("shot-list-item--washing");
    expect(document.querySelectorAll(".shot-list-item--washing")).toHaveLength(1);
  });

  it("retires on its own animation end, not on a timer", async () => {
    renderApp();
    await logAShot();
    const row = document.querySelector(".shot-list-item--washing")!;

    endAnimation(row, "shot-wash");

    expect(document.querySelectorAll(".shot-list-item--washing")).toHaveLength(0);
  });

  it("ignores an animationend that isn't the wash", async () => {
    // onAnimationEnd bubbles, so "an animation ended" is not "the wash ended".
    renderApp();
    await logAShot();
    const row = document.querySelector(".shot-list-item--washing")!;

    endAnimation(row, "some-other-animation");

    expect(document.querySelectorAll(".shot-list-item--washing")).toHaveLength(1);
  });

  it("does not replay after leaving Home and coming back", async () => {
    // Home unmounts on navigation, so a wash still armed would restart from the
    // beginning on every return — the nuisance the milestone item avoids by
    // firing once on the crossing.
    renderApp();
    await logAShot();

    goTo("History");
    goTo("Home");

    expect(document.querySelectorAll(".shot-list-item--washing")).toHaveLength(0);
  });
});
