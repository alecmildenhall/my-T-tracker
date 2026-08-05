import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { StorageBanner } from "../StorageBanner";
import { StorageHealthProvider } from "../../context/StorageHealthContext";
import { ShotsProvider } from "../../context/ShotsContext";
import { ProfileProvider } from "../../context/ProfileContext";
import { useShotsContext } from "../../context/ShotsContext";
import { newId } from "../../utils/id";
import * as dl from "../../utils/download";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

/** Make every write throw, the way Safari private browsing does. */
function breakWrites() {
  return vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
}

/** A log button so a test can cause a real write through the real store. */
const Harness: React.FC = () => {
  const { addShot } = useShotsContext();
  return (
    <>
      <StorageBanner />
      <button
        type="button"
        onClick={() => addShot({ id: newId(), date: "2026-08-04" })}
      >
        log
      </button>
    </>
  );
};

const mount = () =>
  render(
    <StorageHealthProvider>
      <ShotsProvider>
        <ProfileProvider>
          <Harness />
        </ProfileProvider>
      </ShotsProvider>
    </StorageHealthProvider>
  );

const logAShot = () => fireEvent.click(screen.getByRole("button", { name: "log" }));

describe("StorageBanner", () => {
  it("says nothing while writes are landing", () => {
    mount();
    logAShot();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("speaks up when a write fails, instead of only the console", () => {
    // The whole point: the UI used to show the shot saved while nothing
    // persisted, and the only report went to a console the user never opens.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    breakWrites();
    mount();
    logAShot();

    expect(screen.getByRole("alert")).toHaveTextContent("aren’t being saved");
    expect(warn).toHaveBeenCalled(); // still there for a developer
  });

  it("does not put a number on it, because the number would be a lie", () => {
    // Writes fire per store and on mount, so a single failed save reports
    // several attempts — an early build said "5 changes couldn\u2019t be saved" for
    // one. They are not separate losses either: the in-memory state holds
    // everything, so a run of failures is one unsaved state rather than a tally.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    breakWrites();
    mount();
    logAShot();

    const text = screen.getByRole("alert").textContent ?? "";
    expect(text).toContain("aren\u2019t being saved");
    expect(text).not.toMatch(/\d+\s+changes?/);
  });

  it("can be dismissed — a full device would otherwise degrade the app forever", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    breakWrites();
    mount();
    logAShot();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("comes back on the NEXT failure, so one acknowledgement can't silence the rest", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    breakWrites();
    mount();
    logAShot();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    logAShot();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("clears only on a real success, and 'Try again' re-attempts the write", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const spy = breakWrites();
    mount();
    logAShot();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Still failing: retrying must not pretend it worked.
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Storage comes back — now the retry actually persists, and the banner goes.
    spy.mockRestore();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(localStorage.getItem("hrt-shot-tracker:v1:shots")).toContain("2026-08-04");
  });

  it("actually exports, which is the only recovery that survives a dead device", () => {
    // A button that is present but does nothing would be worse than no button:
    // this is the escape hatch for a device that will never save again.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const download = vi
      .spyOn(dl, "downloadTextFile")
      .mockImplementation(() => {});
    breakWrites();
    mount();
    logAShot();

    fireEvent.click(screen.getByRole("button", { name: "Export a backup" }));

    expect(download).toHaveBeenCalledTimes(1);
    const [text, name, mime] = download.mock.calls[0];
    expect(name).toMatch(/\.json$/);
    expect(mime).toBe("application/json");
    // The shot that could not be written is still in the file, because the
    // export reads in-memory state rather than storage.
    expect(text).toContain("2026-08-04");
  });
});
