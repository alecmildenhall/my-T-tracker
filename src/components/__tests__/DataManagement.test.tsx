import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { DataManagement } from "../DataManagement";
import type { ShotEntry } from "../../types/shot";
import * as downloadModule from "../../utils/download";
import { toJson } from "../../utils/exportData";
import { APP_NAME, FORMAT_VERSION } from "../../appMeta";

// Stub the download layer: no real Blob/anchor, and predictable filenames.
vi.mock("../../utils/download", () => ({
  // The guarded wrapper is what every caller uses now; it returns whether the
  // download started, so `false` is how a test says "the browser blocked it".
  tryDownloadTextFile: vi.fn(() => true),
  backupFilename: (stem: string, ext: string) => `${stem}.${ext}`,
}));

const downloadMock = vi.mocked(downloadModule.tryDownloadTextFile);

const shots: ShotEntry[] = [
  { id: "s1", date: "2026-06-01", doseMg: 50, injectionSite: "thigh" },
  { id: "s2", date: "2026-06-08", doseMg: 50, injectionSite: "glute" },
];

/** A backup envelope around arbitrary raw rows — `toJson` can only produce valid
 *  ones, and the point of these tests is what happens when a row is not. */
const withShots = (rows: unknown[], profile?: unknown) =>
  JSON.stringify({
    app: APP_NAME,
    formatVersion: FORMAT_VERSION,
    appVersion: "0.0.0",
    exportedAt: new Date().toISOString(),
    shots: rows,
    ...(profile === undefined ? {} : { profile }),
  });

const uploadText = (content: string) => {
  const input = screen.getByLabelText("Import backup file");
  // jsdom's File.text() is unreliable; the component only calls file.text(), so
  // a minimal file-like object exercises the real code path faithfully.
  const file = {
    name: "backup.json",
    type: "application/json",
    text: () => Promise.resolve(content),
  } as unknown as File;
  fireEvent.change(input, { target: { files: [file] } });
};

describe("DataManagement", () => {
  beforeEach(() => downloadMock.mockClear());

  describe("export", () => {
    it("downloads a JSON backup and confirms with status + a flashed button", () => {
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={vi.fn(() => true)}
          profile={{}}
          onReplaceProfile={vi.fn(() => true)}
        />
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Export backup (JSON)" })
      );

      expect(downloadMock).toHaveBeenCalledTimes(1);
      const [text, filename, type] = downloadMock.mock.calls[0];
      expect(filename).toBe("t-shot-backup.json");
      expect(type).toBe("application/json");
      expect(JSON.parse(text).shots).toHaveLength(2);

      expect(screen.getByRole("status")).toHaveTextContent("Backup downloaded.");
      // Button reflects the click, mirroring the reuse-chip selected state.
      expect(
        screen.getByRole("button", { name: "✓ Exported" })
      ).toBeInTheDocument();
    });

    it("includes the current profile in the JSON backup", () => {
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={vi.fn(() => true)}
          profile={{ startDate: "2025-01-15", preferredName: "Lou" }}
          onReplaceProfile={vi.fn(() => true)}
        />
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Export backup (JSON)" })
      );

      const [text] = downloadMock.mock.calls[0];
      expect(JSON.parse(text).profile).toEqual({
        startDate: "2025-01-15",
        preferredName: "Lou",
      });
    });

    it("downloads a CSV with a BOM", () => {
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={vi.fn(() => true)}
          profile={{}}
          onReplaceProfile={vi.fn(() => true)}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));

      expect(downloadMock).toHaveBeenCalledTimes(1);
      const [text, filename, type] = downloadMock.mock.calls[0];
      expect(filename).toBe("t-shot-export.csv");
      expect(type).toBe("text/csv");
      expect(text.charCodeAt(0)).toBe(0xfeff);
    });

    it("shows an error (not a silent failure) when the download is blocked", () => {
      downloadMock.mockReturnValueOnce(false); // the browser blocked it
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={vi.fn(() => true)}
          profile={{}}
          onReplaceProfile={vi.fn(() => true)}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));

      expect(screen.getByRole("status")).toHaveTextContent(/couldn.t save the file/i);
      // No false success, and the button doesn't flash "Exported".
      expect(
        screen.queryByRole("button", { name: "✓ Exported" })
      ).not.toBeInTheDocument();
    });
  });

  describe("import", () => {
    it("shows a generic error for a malformed file and never replaces", async () => {
      const onReplaceAll = vi.fn(() => true);
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={onReplaceAll}
          profile={{}}
          onReplaceProfile={vi.fn(() => true)}
        />
      );

      uploadText("this is not a backup {");

      expect(await screen.findByRole("status")).toHaveTextContent(
        /as a T-Shot Tracker backup/i
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(onReplaceAll).not.toHaveBeenCalled();
      expect(downloadMock).not.toHaveBeenCalled();
    });

    it("confirms, backs up current data, then replaces on a valid import", async () => {
      const onReplaceAll = vi.fn(() => true);
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={onReplaceAll}
          profile={{}}
          onReplaceProfile={vi.fn(() => true)}
        />
      );

      const incoming: ShotEntry[] = [{ id: "imp", date: "2026-05-01", doseMg: 40 }];
      uploadText(toJson(incoming));

      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent("current 2 entries with 1 entry");

      fireEvent.click(within(dialog).getByRole("button", { name: "Replace" }));

      // Safety backup of the CURRENT data is downloaded before overwriting.
      expect(downloadMock).toHaveBeenCalledTimes(1);
      expect(downloadMock.mock.calls[0][1]).toBe(
        "t-shot-backup-before-import.json"
      );
      expect(onReplaceAll).toHaveBeenCalledWith(incoming);
      expect(screen.getByRole("status")).toHaveTextContent(
        "Restored 1 entry from backup."
      );
    });

    it("restores what it can, and names what it skipped", async () => {
      // The whole point of row-level leniency, and the condition that makes it
      // safe rather than data quietly vanishing: the count is honest and the
      // skipped entry is named. A backup is usually the only copy left by the
      // time it is imported, so refusing all of it over one bad date is the
      // worse answer.
      const onReplaceAll = vi.fn(() => true);
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={onReplaceAll}
          profile={{}}
          onReplaceProfile={vi.fn(() => true)}
        />
      );

      uploadText(
        withShots([
          { id: "good-1", date: "2026-05-01" },
          { id: "bad", date: "9999-01-01" },
          { id: "good-2", date: "2026-05-08" },
        ])
      );

      // Said BEFORE the destructive step, not only in the report after it.
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent(/1 entry in the backup can.t be restored/i);

      fireEvent.click(within(dialog).getByRole("button", { name: "Replace" }));

      expect(onReplaceAll).toHaveBeenCalledWith([
        { id: "good-1", date: "2026-05-01" },
        { id: "good-2", date: "2026-05-08" },
      ]);
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("Restored 2 of 3 entries from backup.");
      // Named by the date the user typed — the thing they recognise.
      expect(status).toHaveTextContent(/An entry dated 9999-01-01/);
      expect(status).toHaveTextContent(/backup file is unchanged/i);
      // The closing note is not one of the skipped entries, so it must not be
      // rendered into their list — as a bullet it read as a fourth thing that
      // had gone wrong.
      const bullets = within(status).getAllByRole("listitem");
      expect(bullets).toHaveLength(1);
      expect(bullets[0]).toHaveTextContent(/An entry dated 9999-01-01/);
      // ...and it agrees with the count: one skipped shot, not "those shots".
      expect(status).toHaveTextContent(/add that shot again/i);
    });

    it("lists two identical failures as two entries, with no key collision", async () => {
      // They produce the same sentence. React renders both either way, so the
      // count is asserted AND the duplicate-key warning is caught — the warning
      // is the actual symptom, and asserting only the count let a text-keyed
      // list pass. React reports it through console.error.
      const keyWarning = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={vi.fn(() => true)}
          profile={{}}
          onReplaceProfile={vi.fn(() => true)}
        />
      );
      uploadText(
        withShots([
          { id: "good", date: "2026-05-01" },
          { id: "b1", date: "9999-01-01" },
          { id: "b2", date: "9999-01-01" },
        ])
      );
      fireEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Replace",
        })
      );
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("Restored 1 of 3 entries from backup.");
      expect(within(status).getAllByRole("listitem")).toHaveLength(2);
      expect(keyWarning.mock.calls.flat().join(" ")).not.toMatch(/same key/i);
      keyWarning.mockRestore();
    });

    it("summarises the tail rather than listing every bad entry", async () => {
      // A badly corrupt file would otherwise bury the count that matters under
      // a wall of bullets.
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={vi.fn(() => true)}
          profile={{}}
          onReplaceProfile={vi.fn(() => true)}
        />
      );
      uploadText(
        withShots([
          { id: "good", date: "2026-05-01" },
          ...[...Array(8)].map((_, i) => ({ id: `b${i}`, date: "9999-01-01" })),
        ])
      );
      fireEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Replace",
        })
      );
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("Restored 1 of 9 entries from backup.");
      // Five named, plus one line accounting for the rest.
      expect(within(status).getAllByRole("listitem")).toHaveLength(6);
      expect(status).toHaveTextContent(/…and 3 more entries\./);
    });

    it("does not put a megabyte of untrusted text on screen", async () => {
      // The date is rendered from the file. A real one is ten characters.
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={vi.fn(() => true)}
          profile={{}}
          onReplaceProfile={vi.fn(() => true)}
        />
      );
      uploadText(
        withShots([
          { id: "good", date: "2026-05-01" },
          { id: "huge", date: "9".repeat(5000) },
        ])
      );
      fireEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Replace",
        })
      );
      const line = within(screen.getByRole("status")).getAllByRole("listitem")[0];
      expect(line.textContent!.length).toBeLessThan(120);
      expect(line).toHaveTextContent(/…/);
    });

    it("names an entry by position when its date is the unreadable part", async () => {
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={vi.fn(() => true)}
          profile={{}}
          onReplaceProfile={vi.fn(() => true)}
        />
      );
      uploadText(
        withShots([{ id: "good", date: "2026-05-01" }, { id: "no-date" }])
      );
      fireEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Replace",
        })
      );
      expect(screen.getByRole("status")).toHaveTextContent(/The 2nd entry in the file/);
    });

    it("says nothing about skipping when every entry restored", async () => {
      // "Restored 3 of 3" on a clean import would invite the reader to look for
      // a problem that isn't there.
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={vi.fn(() => true)}
          profile={{}}
          onReplaceProfile={vi.fn(() => true)}
        />
      );
      uploadText(toJson([{ id: "a", date: "2026-05-01" }]));
      const dialog = await screen.findByRole("dialog");
      expect(dialog).not.toHaveTextContent(/can.t be restored/i);
      fireEvent.click(within(dialog).getByRole("button", { name: "Replace" }));
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("Restored 1 entry from backup.");
      expect(status).not.toHaveTextContent(/of 1 entries/);
      expect(status).not.toHaveTextContent(/skipped|unchanged/i);
    });

    it("refuses a file in which nothing can be read, and changes nothing", async () => {
      const onReplaceAll = vi.fn(() => true);
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={onReplaceAll}
          profile={{}}
          onReplaceProfile={vi.fn(() => true)}
        />
      );
      uploadText(withShots([{ id: "a", date: "9999-01-01" }]));

      const status = await screen.findByRole("status");
      expect(status).toHaveTextContent(/None of the 1 entry in this file/i);
      // Not the wrong-file message: they DID pick a backup from this app, and
      // sending them to look for another one is a dead end.
      expect(status).not.toHaveTextContent(/exported from this app/i);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(onReplaceAll).not.toHaveBeenCalled();
      expect(downloadMock).not.toHaveBeenCalled();
    });

    it("keeps this device's profile when the file's own cannot be read", async () => {
      // A profile is one object — there is no "43 of 44" to salvage — so an
      // unreadable one must not clear the name and shot day already here.
      const onReplaceProfile = vi.fn(() => true);
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={vi.fn(() => true)}
          profile={{ preferredName: "Lou" }}
          onReplaceProfile={onReplaceProfile}
        />
      );
      uploadText(
        withShots([{ id: "a", date: "2026-05-01" }], { startDate: "not-a-date" })
      );
      fireEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Replace",
        })
      );
      expect(onReplaceProfile).not.toHaveBeenCalled();
      expect(screen.getByRole("status")).toHaveTextContent(
        /saved profile in the file couldn.t be read/i
      );
    });

    it("says the restore failed, instead of announcing entries it never wrote", async () => {
      // On a device refusing writes the restore committed nothing, but still
      // reported "Restored 1 entry from backup." — and the profile half, which
      // went through a different path, WAS applied in memory. A green success
      // message beside a red storage banner, over a half-applied restore.
      const onReplaceAll = vi.fn(() => false);
      const onReplaceProfile = vi.fn(() => true);
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={onReplaceAll}
          profile={{}}
          onReplaceProfile={onReplaceProfile}
        />
      );

      uploadText(toJson([{ id: "imp", date: "2026-05-01", doseMg: 40 }]));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Replace" }));

      expect(screen.getByRole("status")).toHaveTextContent(
        /Couldn.t restore the backup/
      );
      expect(screen.getByRole("status")).toHaveTextContent(/Nothing has been changed/);
      expect(screen.queryByText(/Restored/)).not.toBeInTheDocument();
      // Nothing half-applied: the profile is never touched once shots refuse.
      expect(onReplaceProfile).not.toHaveBeenCalled();
    });

    it("does not claim 'nothing changed' when the shots DID land and the profile didn't", async () => {
      // The likelier half-failure: the big shots write is what exhausts the
      // remaining quota, so the small profile write fails right behind it. Saying
      // "nothing has been changed" there would be false — the history has already
      // been replaced.
      const onReplaceAll = vi.fn(() => true);
      const onReplaceProfile = vi.fn(() => false);
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={onReplaceAll}
          profile={{}}
          onReplaceProfile={onReplaceProfile}
        />
      );

      uploadText(toJson([{ id: "imp", date: "2026-05-01" }], { preferredName: "Lou" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Replace" }));

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent(/shots were restored/i);
      expect(status).not.toHaveTextContent(/Nothing has been changed/);
      expect(status).not.toHaveTextContent(/^Restored/);
    });

    it("replaces the profile too, using the profile from the imported file", async () => {
      const onReplaceAll = vi.fn(() => true);
      const onReplaceProfile = vi.fn(() => true);
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={onReplaceAll}
          profile={{ preferredName: "Old" }}
          onReplaceProfile={onReplaceProfile}
        />
      );

      const incoming: ShotEntry[] = [{ id: "imp", date: "2026-05-01" }];
      uploadText(toJson(incoming, { preferredName: "New", startDate: "2024-02-02" }));

      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Replace" }));

      expect(onReplaceAll).toHaveBeenCalledWith(incoming);
      expect(onReplaceProfile).toHaveBeenCalledWith({
        preferredName: "New",
        startDate: "2024-02-02",
      });
      // The user is told the profile changed, not just the shot count.
      expect(screen.getByRole("status")).toHaveTextContent(
        "Your profile was updated."
      );
    });

    it("does not claim a profile change when the import matches the current profile", async () => {
      const sameProfile = { preferredName: "Lou", startDate: "2025-01-15" };
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={vi.fn(() => true)}
          profile={sameProfile}
          onReplaceProfile={vi.fn(() => true)}
        />
      );

      // Re-import a backup whose profile equals what's already set.
      uploadText(toJson([{ id: "imp", date: "2026-05-01" }], sameProfile));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Replace" }));

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("Restored 1 entry from backup.");
      expect(status).not.toHaveTextContent(/profile/i);
    });

    it("reports a shot-day-only change under the generic profile-updated message", async () => {
      const onReplaceProfile = vi.fn(() => true);
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={vi.fn(() => true)}
          profile={{ shotDay: "monday" }}
          onReplaceProfile={onReplaceProfile}
        />
      );

      // Only the shot day differs — name and start date are both absent on each
      // side. The change must still surface (not silently overwrite the shot day).
      uploadText(toJson([{ id: "imp", date: "2026-05-01" }], { shotDay: "friday" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Replace" }));

      expect(onReplaceProfile).toHaveBeenCalledWith({ shotDay: "friday" });
      expect(screen.getByRole("status")).toHaveTextContent(
        "Your profile was updated."
      );
    });

    it("includes the current profile in the pre-import safety backup", async () => {
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={vi.fn(() => true)}
          profile={{ preferredName: "Lou", startDate: "2025-01-15" }}
          onReplaceProfile={vi.fn(() => true)}
        />
      );

      uploadText(toJson([{ id: "imp", date: "2026-05-01" }]));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Replace" }));

      // The recovery copy of the CURRENT data carries the profile, so a mistaken
      // import can be fully undone — not just the shots.
      const [safetyText, safetyName] = downloadMock.mock.calls[0];
      expect(safetyName).toBe("t-shot-backup-before-import.json");
      expect(JSON.parse(safetyText).profile).toEqual({
        preferredName: "Lou",
        startDate: "2025-01-15",
      });
    });

    it("clears the profile when the imported file has none", async () => {
      const onReplaceProfile = vi.fn(() => true);
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={vi.fn(() => true)}
          profile={{ preferredName: "Old" }}
          onReplaceProfile={onReplaceProfile}
        />
      );

      uploadText(toJson([{ id: "imp", date: "2026-05-01" }]));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Replace" }));

      expect(onReplaceProfile).toHaveBeenCalledWith({});
      // A cleared name shouldn't happen silently.
      expect(screen.getByRole("status")).toHaveTextContent(
        "Your saved profile was cleared."
      );
    });

    it("aborts the replace (no data loss) if the safety backup can't download", async () => {
      const onReplaceAll = vi.fn(() => true);
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={onReplaceAll}
          profile={{}}
          onReplaceProfile={vi.fn(() => true)}
        />
      );

      uploadText(toJson([{ id: "imp", date: "2026-05-01" }]));
      const dialog = await screen.findByRole("dialog");

      // The safety-backup download fails (e.g. blocked object URLs).
      downloadMock.mockReturnValueOnce(false); // the browser blocked it
      fireEvent.click(within(dialog).getByRole("button", { name: "Replace" }));

      // Fail-safe: data is NOT replaced, dialog closes, and the user is told why.
      expect(onReplaceAll).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(
        /couldn.t back up your current data/i
      );
    });

    it("traps Tab inside the dialog and restores focus to Import on close", async () => {
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={vi.fn(() => true)}
          profile={{}}
          onReplaceProfile={vi.fn(() => true)}
        />
      );

      uploadText(toJson([{ id: "imp", date: "2026-05-01" }]));
      const dialog = await screen.findByRole("dialog");

      const cancel = within(dialog).getByRole("button", { name: "Cancel" });
      const replace = within(dialog).getByRole("button", { name: "Replace" });

      // Wait for the dialog's OWN focus to land before moving it. `findByRole`
      // resolves on DOM presence, but Modal focuses initialFocusRef (Cancel)
      // from a passive effect that runs after the commit — so under load the
      // effect could fire after `replace.focus()` below and haul focus back to
      // Cancel. Tab then started from the wrong control and wrapped to Replace,
      // failing this assertion about one run in sixteen.
      await waitFor(() => expect(cancel).toHaveFocus());

      // Tab forward off the last control wraps to the first (stays in the modal).
      replace.focus();
      fireEvent.keyDown(replace, { key: "Tab" });
      expect(cancel).toHaveFocus();

      // Shift+Tab off the first control wraps to the last.
      fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
      expect(replace).toHaveFocus();

      // Closing returns focus to the button that opened the dialog.
      fireEvent.click(cancel);
      expect(
        screen.getByRole("button", { name: "Import backup (JSON)" })
      ).toHaveFocus();
    });

    it("cancel on the confirm dialog leaves data untouched", async () => {
      const onReplaceAll = vi.fn(() => true);
      render(
        <DataManagement
          shots={shots}
          onReplaceAll={onReplaceAll}
          profile={{}}
          onReplaceProfile={vi.fn(() => true)}
        />
      );

      uploadText(toJson([{ id: "imp", date: "2026-05-01" }]));

      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(onReplaceAll).not.toHaveBeenCalled();
      expect(downloadMock).not.toHaveBeenCalled();
    });
  });
});
