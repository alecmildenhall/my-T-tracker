import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, within, act, waitFor } from "@testing-library/react";
import App from "../App";
import { ShotsProvider } from "../context/ShotsContext";
import { ProfileProvider } from "../context/ProfileContext";
import { StorageHealthProvider } from "../context/StorageHealthContext";
import type { ShotEntry } from "../types/shot";
import { STORAGE_KEYS } from "../storageKeys";
import { SHEET_EXIT_MS } from "../components/Modal";
import { todayLocalISO } from "../utils/datetime";
import * as dl from "../utils/download";

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

const seedShots = (shots: ShotEntry[]) =>
  localStorage.setItem(STORAGE_KEYS.shots, JSON.stringify(shots));

const goTo = (tab: "Home" | "History" | "Settings") =>
  fireEvent.click(within(screen.getByRole("navigation")).getByRole("button", { name: tab }));

/** The sheet plays a 200ms exit transition before unmounting, so its removal is
 *  asynchronous. */
const sheetGone = () =>
  waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

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
      .spyOn(dl, "downloadTextFile")
      .mockImplementation(() => {});
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
      within(screen.getByRole("dialog")).getByRole("button", { name: "Try again" })
    );

    expect(notes()).toHaveValue("still here");
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toBeInTheDocument();
    expect(localStorage.getItem("hrt-shot-tracker:v1:shots")).toBeNull();
  });

  it("relabels Save to 'Try again' after a refused write, and back on success", () => {
    // "Save shot" would be naming an outcome the last press did not produce. The
    // button IS the retry, so it should say so — the same word the storage banner
    // uses for the same job.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const spy = breakWrites();
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    const inSheet = () => within(screen.getByRole("dialog"));
    expect(inSheet().getByRole("button", { name: "Save shot" })).toBeInTheDocument();

    fireEvent.click(inSheet().getByRole("button", { name: "Save shot" }));
    expect(inSheet().getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(inSheet().queryByRole("button", { name: "Save shot" })).not.toBeInTheDocument();

    // It stays relabelled while it keeps failing, rather than flickering back.
    fireEvent.click(inSheet().getByRole("button", { name: "Try again" }));
    expect(inSheet().getByRole("button", { name: "Try again" })).toBeInTheDocument();

    // And the shot lands on the retry.
    spy.mockRestore();
    fireEvent.click(inSheet().getByRole("button", { name: "Try again" }));
    expect(
      JSON.parse(localStorage.getItem("hrt-shot-tracker:v1:shots") ?? "[]")
    ).toHaveLength(1);
  });

  it("relabels an EDIT's button too, since it failed the same way", () => {
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

    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Try again" })
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
      within(screen.getByRole("dialog")).getByRole("button", { name: "Try again" })
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
    expect(sheet.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    // ...and no stale failure message riding along with it.
    expect(sheet.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("takes the label back when 'Clear form' starts the entry over", () => {
    // Clearing is starting over, so the failed-save state has to go with the
    // values it referred to. Left behind, the button says "Try again" over an
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
    expect(inSheet().getByRole("button", { name: "Try again" })).toBeInTheDocument();

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
      within(screen.getByRole("dialog")).getByRole("button", { name: "Try again" })
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
