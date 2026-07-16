import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import App from "../App";
import { ShotsProvider } from "../context/ShotsContext";
import { ProfileProvider } from "../context/ProfileContext";
import type { ShotEntry } from "../types/shot";
import { STORAGE_KEYS } from "../storageKeys";
import { toJson } from "../utils/exportData";

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

// Real downloads need object URLs jsdom doesn't provide; the replace path only
// cares that the safety backup *succeeds*, so stub the download layer.
vi.mock("../utils/download", () => ({
  downloadTextFile: vi.fn(),
  backupFilename: (stem: string, ext: string) => `${stem}.${ext}`,
}));

const seedShots = (shots: ShotEntry[]) =>
  localStorage.setItem(STORAGE_KEYS.shots, JSON.stringify(shots));

const uploadBackup = (shots: ShotEntry[]) => {
  const input = screen.getByLabelText("Import backup file");
  const file = {
    name: "backup.json",
    type: "application/json",
    text: () => Promise.resolve(toJson(shots)),
  } as unknown as File;
  fireEvent.change(input, { target: { files: [file] } });
};

beforeEach(() => localStorage.clear());

describe("App — import while editing", () => {
  it("drops the in-progress edit when a backup replaces the list", async () => {
    seedShots([{ id: "orig", date: "2026-06-01", notes: "original" }]);
    renderApp();

    // Start editing the existing shot.
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      screen.getByRole("heading", { name: "Edit Shot" })
    ).toBeInTheDocument();

    // Go to Settings and import a backup that replaces the whole list, so the
    // shot being edited no longer exists.
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    uploadBackup([{ id: "fresh", date: "2026-05-01" }]);

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Replace" }));

    // Back to the log: the form must have left edit mode, so a Save can't
    // silently no-op against the now-missing "orig" id.
    fireEvent.click(screen.getByRole("button", { name: "← Back" }));

    expect(
      screen.getByRole("heading", { name: "Log a Shot" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save shot" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Edit Shot" })
    ).not.toBeInTheDocument();
  });

  it("drops the in-progress edit when the edited shot is deleted from the list", () => {
    seedShots([
      { id: "keep", date: "2026-06-01", notes: "keep me" },
      { id: "gone", date: "2026-06-02", notes: "delete me" },
    ]);
    renderApp();

    // Edit the shot we're about to delete.
    const goneRow = screen.getByText("delete me").closest("li")!;
    fireEvent.click(within(goneRow).getByRole("button", { name: "Edit" }));
    expect(
      screen.getByRole("heading", { name: "Edit Shot" })
    ).toBeInTheDocument();

    // Delete it from the list while its edit is open.
    fireEvent.click(within(goneRow).getByRole("button", { name: "Delete" }));

    // Editing ends on its own — no stale edit against a missing id.
    expect(
      screen.getByRole("heading", { name: "Log a Shot" })
    ).toBeInTheDocument();

    // ...and the form clears, so the deleted shot's values don't linger in what
    // is now the new-shot form (saving them would silently recreate the entry).
    const notes = screen.getByPlaceholderText(
      /remember for later/i
    ) as HTMLTextAreaElement;
    expect(notes.value).toBe("");

    // The remaining shot is untouched, and a Save now would add a fresh entry,
    // not resurrect "delete me".
    expect(screen.getByText("keep me")).toBeInTheDocument();
    expect(screen.queryByText("delete me")).not.toBeInTheDocument();
  });
});
