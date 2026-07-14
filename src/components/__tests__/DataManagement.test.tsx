import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DataManagement } from "../DataManagement";
import type { ShotEntry } from "../../types/shot";
import * as downloadModule from "../../utils/download";
import { toJson } from "../../utils/exportData";

// Stub the download layer: no real Blob/anchor, and predictable filenames.
vi.mock("../../utils/download", () => ({
  downloadTextFile: vi.fn(),
  backupFilename: (stem: string, ext: string) => `${stem}.${ext}`,
}));

const downloadMock = vi.mocked(downloadModule.downloadTextFile);

const shots: ShotEntry[] = [
  { id: "s1", date: "2026-06-01", doseMg: 50, injectionSite: "thigh" },
  { id: "s2", date: "2026-06-08", doseMg: 50, injectionSite: "glute" },
];

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
      render(<DataManagement shots={shots} onReplaceAll={vi.fn()} />);
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

    it("downloads a CSV with a BOM", () => {
      render(<DataManagement shots={shots} onReplaceAll={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));

      expect(downloadMock).toHaveBeenCalledTimes(1);
      const [text, filename, type] = downloadMock.mock.calls[0];
      expect(filename).toBe("t-shot-export.csv");
      expect(type).toBe("text/csv");
      expect(text.charCodeAt(0)).toBe(0xfeff);
    });

    it("shows an error (not a silent failure) when the download is blocked", () => {
      downloadMock.mockImplementationOnce(() => {
        throw new Error("blocked by browser");
      });
      render(<DataManagement shots={shots} onReplaceAll={vi.fn()} />);

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
      const onReplaceAll = vi.fn();
      render(<DataManagement shots={shots} onReplaceAll={onReplaceAll} />);

      uploadText("this is not a backup {");

      expect(await screen.findByRole("status")).toHaveTextContent(
        /as a T-Shot Tracker backup/i
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(onReplaceAll).not.toHaveBeenCalled();
      expect(downloadMock).not.toHaveBeenCalled();
    });

    it("confirms, backs up current data, then replaces on a valid import", async () => {
      const onReplaceAll = vi.fn();
      render(<DataManagement shots={shots} onReplaceAll={onReplaceAll} />);

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

    it("aborts the replace (no data loss) if the safety backup can't download", async () => {
      const onReplaceAll = vi.fn();
      render(<DataManagement shots={shots} onReplaceAll={onReplaceAll} />);

      uploadText(toJson([{ id: "imp", date: "2026-05-01" }]));
      const dialog = await screen.findByRole("dialog");

      // The safety-backup download fails (e.g. blocked object URLs).
      downloadMock.mockImplementationOnce(() => {
        throw new Error("blocked by browser");
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Replace" }));

      // Fail-safe: data is NOT replaced, dialog closes, and the user is told why.
      expect(onReplaceAll).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(
        /couldn.t back up your current data/i
      );
    });

    it("traps Tab inside the dialog and restores focus to Import on close", async () => {
      render(<DataManagement shots={shots} onReplaceAll={vi.fn()} />);

      uploadText(toJson([{ id: "imp", date: "2026-05-01" }]));
      const dialog = await screen.findByRole("dialog");

      const cancel = within(dialog).getByRole("button", { name: "Cancel" });
      const replace = within(dialog).getByRole("button", { name: "Replace" });

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
      const onReplaceAll = vi.fn();
      render(<DataManagement shots={shots} onReplaceAll={onReplaceAll} />);

      uploadText(toJson([{ id: "imp", date: "2026-05-01" }]));

      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(onReplaceAll).not.toHaveBeenCalled();
      expect(downloadMock).not.toHaveBeenCalled();
    });
  });
});
