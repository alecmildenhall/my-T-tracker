import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act, configure } from "@testing-library/react";
import { useRef, useState } from "react";
import { Modal } from "../Modal";

// Harness: a modal with Cancel + Confirm, optionally given an initial-focus ref.
const Harness = ({
  onClose = vi.fn(),
  initialCancel = true,
}: {
  onClose?: () => void;
  initialCancel?: boolean;
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      labelledBy="t"
      onClose={onClose}
      initialFocusRef={initialCancel ? cancelRef : undefined}
    >
      <h3 id="t">Title</h3>
      <button ref={cancelRef} type="button">
        Cancel
      </button>
      <button type="button">Confirm</button>
    </Modal>
  );
};

// Stateful opener → modal → close, to observe focus restoration on unmount.
function ModalToggle() {
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <Modal labelledBy="mt" onClose={() => setOpen(false)} initialFocusRef={cancelRef}>
          <h3 id="mt">T</h3>
          <button ref={cancelRef} type="button" onClick={() => setOpen(false)}>
            Close
          </button>
        </Modal>
      )}
    </>
  );
}

describe("Modal", () => {
  it("focuses the initialFocusRef on open", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("falls back to the first focusable when no initialFocusRef is given", () => {
    render(<Harness initialCancel={false} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("traps Tab within the dialog", () => {
    render(<Harness />);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Confirm" });

    confirm.focus();
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();
  });

  it("re-traps Tab even when focus has already escaped the dialog", () => {
    // The trap used to be the dialog's own onKeyDown, so it only saw keys pressed
    // while focus was already inside — missing the one case it most needed to
    // catch. Clicking a dialog's non-focusable padding drops focus to <body>, and
    // from there Tab left the page entirely (#root is inert, so there is nothing
    // earlier to land on). Found in a real browser; jsdom neither lays out
    // padding nor implements `inert`, so only the consequence is testable here.
    render(<Harness />);
    (document.activeElement as HTMLElement)?.blur();
    expect(document.activeElement).toBe(document.body);

    fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    // ...and backwards, which is the direction that actually left the page.
    (document.activeElement as HTMLElement)?.blur();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
  });

  it("wraps past a DISABLED control instead of making Tab a dead key", () => {
    // FOCUSABLE matches `button`, disabled included, so a disabled control at
    // either end used to be the wrap target: focus() silently refused, the
    // default was already prevented, and Tab did nothing whatsoever. Walking
    // inward lands on the outermost control that will actually take focus.
    render(
      <Modal labelledBy="t" onClose={() => {}}>
        <h2 id="t">Title</h2>
        <button type="button">First</button>
        <button type="button">Middle</button>
        <button type="button" disabled>
          Last
        </button>
      </Modal>
    );
    const first = screen.getByRole("button", { name: "First" });
    const middle = screen.getByRole("button", { name: "Middle" });

    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });

    expect(middle).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it("keeps Tab inside even from the dialog container itself", () => {
    // The container carries tabIndex -1 as the last-resort focus target, but
    // FOCUSABLE excludes tabindex="-1", so it is neither the first nor the last
    // focusable and fell through both wrap branches. It is reachable in practice:
    // .dialog has padding, and clicking that dead space focuses it. With #root
    // inert there is nothing earlier in the document, so an unintercepted
    // Shift+Tab took focus clean out of the page.
    render(<Harness />);
    const dialog = screen.getByRole("dialog").querySelector(".dialog") as HTMLElement;
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Confirm" });

    dialog.focus();
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus(); // wrapped to the last control, not out of the page

    dialog.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(cancel).toHaveFocus(); // forward goes to the first
  });

  it("leaves every other key alone", () => {
    // The trap runs on the dialog's keydown, so it sees ordinary typing too. If
    // its Tab guard ever went, entering text in the shot sheet would yank focus
    // to the top of the form on each keystroke — the trap has to be inert for
    // everything that is not Tab.
    render(<Harness />);
    const confirm = screen.getByRole("button", { name: "Confirm" });
    confirm.focus();

    for (const key of ["a", "Enter", "ArrowDown", " "]) {
      fireEvent.keyDown(confirm, { key });
      expect(confirm).toHaveFocus();
    }
  });

  it("uses the fallback when nothing had focus before it opened", () => {
    // document.activeElement is <body> whenever nothing holds focus — the norm
    // for touch users, and specifically for Safari, which does not focus a
    // <button> when tapped. <body> IS connected, so an isConnected-only guard
    // took the restore branch, body.focus() did nothing, and the fallback never
    // ran: focus ended up nowhere on the app's primary platform.
    const Fallback = () => {
      const heading = useRef<HTMLHeadingElement>(null);
      const [open, setOpen] = useState(true);
      return (
        <>
          <h1 ref={heading} tabIndex={-1}>
            Title
          </h1>
          {open && (
            <Modal
              labelledBy="ft"
              onClose={() => setOpen(false)}
              fallbackFocusRef={heading}
            >
              <h3 id="ft">T</h3>
              <button type="button">Only button</button>
            </Modal>
          )}
        </>
      );
    };
    // StrictMode is off for THIS test only, and deliberately: its extra
    // mount/cleanup/mount re-captures `previouslyFocused` *after* the first
    // cleanup has already moved focus, so by the real close the restore target is
    // a genuine element and the "nothing was focused" condition under test no
    // longer holds. With the double-invoke on, this test passes whether or not
    // the bug is present — verified by mutation.
    configure({ reactStrictMode: false });
    try {
      // Nothing focused at open time.
      (document.activeElement as HTMLElement)?.blur?.();
      expect(document.activeElement).toBe(document.body);

      render(<Fallback />);
      fireEvent.keyDown(window, { key: "Escape" });

      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Title" })
      );
    } finally {
      configure({ reactStrictMode: true });
    }
  });

  it("falls back when the restore target cannot actually take focus", () => {
    // focus() on a non-focusable element is a silent no-op, so a restore target
    // that is still connected but unfocusable strands focus just as surely as a
    // removed one. The result has to be checked, not assumed.
    const Unfocusable = () => {
      // A plain <span>: present and connected, but with no tabindex it cannot
      // take focus. Callers point restoreFocusRef at a persistent landmark
      // exactly like this when the real opener isn't reliably focused.
      const restoreTo = useRef<HTMLSpanElement>(null);
      const heading = useRef<HTMLHeadingElement>(null);
      const [open, setOpen] = useState(false);
      return (
        <>
          <h1 ref={heading} tabIndex={-1}>
            Fallback heading
          </h1>
          <span ref={restoreTo}>not focusable</span>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          {open && (
            <Modal
              labelledBy="ut"
              onClose={() => setOpen(false)}
              restoreFocusRef={restoreTo}
              fallbackFocusRef={heading}
            >
              <h3 id="ut">T</h3>
              <button type="button">Only button</button>
            </Modal>
          )}
        </>
      );
    };
    render(<Unfocusable />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Fallback heading" })
    );
  });

  it("focuses itself when its content holds nothing focusable", () => {
    // A plain message dialog is legitimate. With nothing inside to focus, leaving
    // focus where it was means leaving it in the root that was just marked inert
    // — the browser drops it to <body>, so the dialog is announced to nobody and
    // Tab restarts at the top of the page behind it.
    const onClose = vi.fn();
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    // finally, not a trailing remove(): a failing assertion would otherwise skip
    // the cleanup and leave a stray focused button in the body for every later
    // test in this file, turning one failure into a confusing cascade.
    try {
      opener.focus();

      render(
        <Modal labelledBy="nt" onClose={onClose}>
          <h3 id="nt">Nothing to focus</h3>
          <p>Just a message.</p>
        </Modal>
      );
      const dialog = screen.getByRole("dialog");

      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement).not.toBe(opener);
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
      // And Tab is a no-op rather than a crash, since there is nothing to cycle.
      expect(() => fireEvent.keyDown(dialog, { key: "Tab" })).not.toThrow();

      fireEvent.keyDown(window, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      opener.remove();
    }
  });

  it("closes on Escape and on backdrop click", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    // The overlay carries the dialog role; clicking it (not its children) closes.
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("restores focus to the opener when it closes", () => {
    render(<ModalToggle />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);

    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(opener).toHaveFocus();
  });

  it("gives every dialog a history entry, so Back dismisses it", async () => {
    // Wired in Modal rather than per-caller: the rename/remove confirms and the
    // "Replace your data?" import confirm would otherwise let a reflexive Back
    // exit the app outright — from one tap away from a destructive restore.
    // Drain any deferred entry-removal left pending by an earlier test first.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    window.history.replaceState(null, "");
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal labelledBy="h" onClose={onClose}>
        <h2 id="h">Replace your data?</h2>
        <button type="button">Cancel</button>
      </Modal>
    );
    expect(window.history.state?.overlay).toBe(true);

    act(() => {
      window.history.replaceState(null, "");
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
  });

  it("lifts inert before restoring focus, not after", () => {
    // The ordering bug this guards: `inert` makes its subtree unfocusable, so
    // restoring focus to the opener while the root is still inert silently fails
    // and focus lands nowhere. jsdom doesn't implement inert's *behaviour*, so
    // the symptom is invisible here — but the call ORDER is observable, and that
    // is the actual invariant.
    const root = document.createElement("div");
    root.id = "root";
    const opener = document.createElement("button");
    root.appendChild(opener);
    document.body.appendChild(root);

    const calls: string[] = [];
    // Spies must call through: swallowing focus() would leave activeElement on
    // <body>, so the Modal would capture the wrong restore target.
    const realRemove = root.removeAttribute.bind(root);
    vi.spyOn(root, "removeAttribute").mockImplementation((name: string) => {
      if (name === "inert") calls.push("inert-lifted");
      realRemove(name);
    });
    const realFocus = opener.focus.bind(opener);
    vi.spyOn(opener, "focus").mockImplementation(() => {
      calls.push("focus-restored");
      realFocus();
    });

    realFocus();
    const { unmount } = render(
      <Modal labelledBy="o" onClose={vi.fn()}>
        <h2 id="o">Ordering</h2>
      </Modal>
    );
    unmount();

    // StrictMode makes this happen more than once; the invariant is the order.
    expect(calls).toContain("inert-lifted");
    expect(calls).toContain("focus-restored");
    expect(calls.indexOf("inert-lifted")).toBeLessThan(
      calls.indexOf("focus-restored")
    );
    root.remove();
    vi.restoreAllMocks();
  });

  it("sizes itself to the visual viewport, so a keyboard can't cover it", () => {
    // iOS Safari keeps the layout viewport full height when the keyboard opens,
    // so a height:100% sheet would put its pinned Save button under the keyboard.
    // visualViewport.height is the space actually visible.
    const listeners: Record<string, () => void> = {};
    const fakeViewport = {
      height: 800,
      addEventListener: (type: string, fn: () => void) => {
        listeners[type] = fn;
      },
      removeEventListener: () => {},
    };
    vi.stubGlobal("visualViewport", fakeViewport);

    const { unmount } = render(
      <Modal labelledBy="v" onClose={vi.fn()} variant="sheet">
        <h2 id="v">Sheet</h2>
      </Modal>
    );
    const read = () =>
      document.documentElement.style.getPropertyValue("--sheet-h");
    expect(read()).toBe("800px");

    // Keyboard opens: the visible area shrinks and the sheet follows.
    fakeViewport.height = 420;
    act(() => listeners.resize?.());
    expect(read()).toBe("420px");

    // Cleared on close, so it never constrains a later dialog.
    unmount();
    expect(read()).toBe("");
  });

  it("starts the sheet off-screen so it has somewhere to animate from", () => {
    // Without a first paint in the closed state the browser has nothing to
    // transition, and the sheet would simply appear.
    render(
      <Modal labelledBy="s" onClose={vi.fn()} variant="sheet">
        <h2 id="s">Sheet</h2>
      </Modal>
    );
    expect(screen.getByRole("dialog")).toHaveClass("is-closed");
  });

  it("marks the sheet closing so the exit transition can play", () => {
    render(
      <Modal labelledBy="s" onClose={vi.fn()} variant="sheet" closing>
        <h2 id="s">Sheet</h2>
      </Modal>
    );
    const overlay = screen.getByRole("dialog");
    expect(overlay).toHaveClass("is-closing");
    expect(overlay).toHaveClass("is-closed");
  });

  it("does not put a compact confirm dialog through the sheet animation", () => {
    render(
      <Modal labelledBy="d" onClose={vi.fn()}>
        <h2 id="d">Remove this?</h2>
      </Modal>
    );
    // The animation is styled per-variant; a confirm box appears at once.
    expect(screen.getByRole("dialog")).toHaveClass("dialog-overlay--dialog");
  });

  it("sheet variant ignores backdrop clicks but still closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal labelledBy="t" onClose={onClose} variant="sheet">
        <h2 id="t">Sheet</h2>
        <button type="button">Inside</button>
      </Modal>
    );

    // A sheet holds a long form; on desktop the backdrop is most of the
    // viewport, so a stray click must not discard what was typed.
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    // Escape is a deliberate act, so it still closes.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("falls back to a given element when the opener is gone", () => {
    // Models the real case: you tap Edit on a row, the row disappears while the
    // sheet is open (deleted, or wiped by an import), and the sheet closes. The
    // opener no longer exists, so focus would drop to <body> — the APG says send
    // it somewhere logical instead.
    const Fallback = () => {
      const ref = useRef<HTMLHeadingElement>(null);
      const [open, setOpen] = useState(false);
      const [rowExists, setRowExists] = useState(true);
      return (
        <>
          <h1 tabIndex={-1} ref={ref}>
            Title
          </h1>
          {rowExists && (
            <button type="button" onClick={() => setOpen(true)}>
              Edit
            </button>
          )}
          {open && (
            <Modal
              labelledBy="t2"
              onClose={() => setOpen(false)}
              fallbackFocusRef={ref}
            >
              <h2 id="t2">Editing</h2>
              <button type="button" onClick={() => setRowExists(false)}>
                Remove row
              </button>
              <button type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </Modal>
          )}
        </>
      );
    };
    render(<Fallback />);

    const opener = screen.getByRole("button", { name: "Edit" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "Remove row" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.getByRole("heading", { name: "Title" })).toHaveFocus();
  });
});
