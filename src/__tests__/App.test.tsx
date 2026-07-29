import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import App from "../App";
import { ShotsProvider } from "../context/ShotsContext";
import { ProfileProvider } from "../context/ProfileContext";
import type { ShotEntry } from "../types/shot";
import { STORAGE_KEYS } from "../storageKeys";

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
});

describe("App — logging via the sheet", () => {
  it("opens the form in a dialog and closes it after saving", () => {
    renderApp();

    // The form is not inline on Home — it lives behind the primary action.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "Log a shot" })).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: "Save shot" }));

    // Saving dismisses the sheet and the shot lands in the teaser.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /See all/ })).toBeInTheDocument();
  });

  it("Cancel closes the new-shot sheet without saving", () => {
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /Log a shot/ }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" })
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Nothing was logged, so the teaser still shows its empty state.
    expect(screen.getByText(/No shots logged yet/)).toBeInTheDocument();
  });
});

describe("App — editing from History", () => {
  it("edits in a sheet over the list, leaving the list's filters underneath", () => {
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

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
});
