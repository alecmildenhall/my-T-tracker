import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within, act, waitFor } from "@testing-library/react";
import App from "../App";
import { ShotsProvider } from "../context/ShotsContext";
import { ProfileProvider } from "../context/ProfileContext";
import type { ShotEntry } from "../types/shot";
import { STORAGE_KEYS } from "../storageKeys";
import { SHEET_EXIT_MS } from "../components/Modal";
import { todayLocalISO } from "../utils/datetime";

// App reads both stores via context (Settings uses the profile store), so mount
// it under the same providers main.tsx does.
const renderApp = () =>
  render(
    <ShotsProvider>
      <ProfileProvider>
        <App />
      </ProfileProvider>
    </ShotsProvider>
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
    expect(within(screen.getByRole("dialog")).getByLabelText("Date")).toHaveFocus();
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
    // "Untouched date follows today" is right for a NEW shot and wrong for an
    // edit: an edit's date already means the day that shot was taken. Park an
    // edit of a shot dated today, cross midnight with the session alive (a phone
    // left open), reopen — the date must still be the shot's own, not the new
    // today, and saving must not move a logged shot to a day it did not happen.
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
