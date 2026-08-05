import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { StorageBanner } from "../StorageBanner";
import { StorageHealthProvider } from "../../context/StorageHealthContext";
import { ShotsProvider } from "../../context/ShotsContext";
import { ProfileProvider } from "../../context/ProfileContext";
import { useShotsContext } from "../../context/ShotsContext";
import { useProfileContext } from "../../context/ProfileContext";
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

/**
 * Reject writes to one key only. Quota fires on the SIZE of the value, so the
 * big shots array can be refused while the small profile object still fits.
 */
function breakWritesTo(keyPart: string) {
  const real = Storage.prototype.setItem;
  return vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(function (this: Storage, k: string, v: string) {
      if (k.includes(keyPart)) throw new DOMException("QuotaExceededError");
      return real.call(this, k, v);
    });
}

/** Buttons that cause real writes, to two DIFFERENT stores, through the real hooks. */
const StorageBannerHarness: React.FC<{
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}> = ({ returnFocusRef }) => {
  const { addShot } = useShotsContext();
  const { setPreferredName } = useProfileContext();
  return (
    <>
      <StorageBanner returnFocusRef={returnFocusRef} />
      <button
        type="button"
        onClick={() => addShot({ id: newId(), date: "2026-08-04" })}
      >
        log
      </button>
      <button
        type="button"
        onClick={() => setPreferredName("Lou")}
      >
        save profile
      </button>
    </>
  );
};

const mount = () =>
  render(
    <StorageHealthProvider>
      <ShotsProvider>
        <ProfileProvider>
          <StorageBannerHarness />
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
    mount();
    // One shot that DID save, so the retry has real content to re-persist.
    logAShot();
    // Then storage goes, and the next save is refused.
    const spy = breakWrites();
    localStorage.clear();
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

  it("'Try again' actually writes, instead of re-affirming what storage already holds", () => {
    // The retry path skipped the write whenever storage already matched state —
    // and a refused write commits nothing, so for the shots store they ALWAYS
    // match after a failure. Retry therefore reported success without touching
    // storage: the app's one anti-silent-failure surface giving a false all-clear
    // on a device still refusing every write.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mount();
    logAShot(); // lands, so state and storage agree
    const spy = breakWrites();
    logAShot(); // refused, commits nothing — state and storage STILL agree
    expect(screen.getByRole("alert")).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(spy).toHaveBeenCalled(); // it tried
    expect(screen.getByRole("alert")).toBeInTheDocument(); // and did not lie
  });

  it("is not cleared by a DIFFERENT store's write succeeding", () => {
    // Health was a single counter, but writes are per key: saving a display name
    // reported success and wiped a banner that was reporting an unsaved shot.
    // Telling someone their data is safe while it isn\u2019t is the exact failure
    // this feature exists to end.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    breakWritesTo("shots");
    mount();
    logAShot();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // The profile store writes fine and reports its success.
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "save profile" }));
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(localStorage.getItem("hrt-shot-tracker:v1:profile")).toContain("Lou");
    expect(localStorage.getItem("hrt-shot-tracker:v1:shots")).toBeNull();
  });

  it("hands focus on rather than dropping it on <body> when it removes itself", () => {
    // Every control in the banner removes the element that contains it. CLAUDE.md:
    // focus is never left on <body> \u2014 the defect class behind nine slice-B bugs.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    breakWrites();
    const target = document.createElement("h1");
    target.tabIndex = -1;
    document.body.appendChild(target);
    render(
      <StorageHealthProvider>
        <ShotsProvider>
          <ProfileProvider>
            <StorageBannerHarness returnFocusRef={{ current: target }} />
          </ProfileProvider>
        </ShotsProvider>
      </StorageHealthProvider>
    );
    logAShot();

    const dismissBtn = screen.getByRole("button", { name: "Dismiss" });
    dismissBtn.focus();
    fireEvent.click(dismissBtn);

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(target);
    target.remove();
  });

  it("actually exports, which is the only recovery that survives a dead device", () => {
    // A button that is present but does nothing would be worse than no button:
    // this is the escape hatch for a device that will never save again.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const download = vi
      .spyOn(dl, "downloadTextFile")
      .mockImplementation(() => {});
    mount();
    logAShot(); // lands
    breakWrites();
    logAShot(); // refused, and raises the banner

    fireEvent.click(screen.getByRole("button", { name: "Export a backup" }));

    expect(download).toHaveBeenCalledTimes(1);
    const [text, name, mime] = download.mock.calls[0];
    expect(name).toMatch(/\.json$/);
    expect(mime).toBe("application/json");
    // Everything the app currently holds, whether or not storage accepted it.
    expect(text).toContain("2026-08-04");
  });
});
