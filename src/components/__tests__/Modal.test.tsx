import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  configure,
} from "@testing-library/react";
import { useRef, useState } from "react";
import { Modal, SHEET_EXIT_MS } from "../Modal";

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

    // Backwards from the first control wraps to the last one that can take it.
    first.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(middle).toHaveFocus();

    // FORWARDS from the last REAL control is the direction that escaped. The
    // edge check compared against focusables[length - 1] — the disabled button —
    // so it read "not at the edge" precisely when you were, let the default run,
    // and focus left the page (#root is inert, so there is nothing to land on).
    middle.focus();
    const notPrevented = fireEvent.keyDown(window, { key: "Tab" });
    expect(notPrevented).toBe(false); // false = preventDefault() was called
    expect(first).toHaveFocus(); // wrapped round to the start, still inside
  });

  it("continues from a tabIndex -1 element inside, rather than restarting", () => {
    // Where every in-dialog hand-off lands: "Clear form" moves focus to the
    // sheet's own heading, which FOCUSABLE excludes. Treating that the same as
    // "focus is outside" restarted Tab at the top of the list — and since the ✕
    // renders BEFORE the heading, that sent focus BACKWARDS out of the content.
    render(
      <Modal labelledBy="t" onClose={() => {}}>
        <button type="button">Close X</button>
        <h2 id="t" tabIndex={-1}>
          Title
        </h2>
        <button type="button">Field A</button>
        <button type="button">Save</button>
      </Modal>
    );
    const heading = screen.getByRole("heading", { name: "Title" });
    const closeX = screen.getByRole("button", { name: "Close X" });
    const fieldA = screen.getByRole("button", { name: "Field A" });

    heading.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(fieldA).toHaveFocus(); // forwards, not back to Close X

    heading.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(closeX).toHaveFocus(); // the control actually before it
  });

  it("does not let Tab escape a dialog with nothing focusable in it", () => {
    // A content-free dialog is supported — the open-time chain lands on the
    // container for exactly that case. The Tab handler used to bail before
    // preventDefault, so the default ran and, with #root inert, focus left the
    // page: the escape this trap exists to close.
    render(
      <Modal labelledBy="t" onClose={() => {}}>
        <h2 id="t">Nothing to do here</h2>
      </Modal>
    );
    // role="dialog" sits on the overlay; the focus target is the inner .dialog,
    // which carries tabIndex -1 as the last-resort landing spot.
    const inner = document.querySelector(".dialog") as HTMLElement;
    expect(inner).toHaveFocus();

    const notPrevented = fireEvent.keyDown(window, { key: "Tab" });
    expect(notPrevented).toBe(false); // false = preventDefault() was called
    expect(inner).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it("leaves Tab alone inside a date field, which uses it to change segment", () => {
    // `input[type=date]` is several controls in one — Tab steps month → day →
    // year before leaving — and that stepping is the DEFAULT action. Owning
    // every Tab cancelled it, so the log sheet's date field (required, and the
    // first thing focused in the primary flow) lost segment navigation. jsdom
    // has no segments, so this pins the contract instead: the handler must not
    // preventDefault while there is a control beyond it.
    render(
      <Modal labelledBy="t" onClose={() => {}}>
        <h2 id="t">Title</h2>
        <input type="date" aria-label="Date" />
        <button type="button">After</button>
      </Modal>
    );
    const date = screen.getByLabelText("Date");
    date.focus();

    const notPrevented = fireEvent.keyDown(window, { key: "Tab" });
    expect(notPrevented).toBe(true); // true = default left alone, browser steps

    // ...but at the far edge the trap takes over again, or focus would escape.
    const after = screen.getByRole("button", { name: "After" });
    after.focus();
    expect(fireEvent.keyDown(window, { key: "Tab" })).toBe(false);
    expect(date).toHaveFocus(); // wrapped back inside
  });

  it("lets the browser step BACKWARDS into a date field, at its last segment", () => {
    // The mirror of the test above, and the half that was missing. `focus()`
    // enters a segmented input at its FIRST segment, which is right going
    // forwards and wrong going backwards — so the trap owning this Shift+Tab
    // landed on the hour and the next Shift+Tab left the field, making minutes
    // and AM/PM unreachable backwards. Measured in Chromium on the log sheet:
    // one backward stop inside the dialog against four for the same control
    // outside one.
    //
    // jsdom has no segments, so this pins the contract: the handler must stand
    // aside when Shift+Tab would ENTER a segmented input that has a control
    // before it, and the browser then enters at the last segment.
    render(
      <Modal labelledBy="t" onClose={() => {}}>
        <h2 id="t">Title</h2>
        <button type="button">Before</button>
        <input type="date" aria-label="Date" />
        <button type="button">After</button>
      </Modal>
    );
    const after = screen.getByRole("button", { name: "After" });
    after.focus();

    // Backwards into the date: left to the browser.
    expect(fireEvent.keyDown(window, { key: "Tab", shiftKey: true })).toBe(true);

    // ...but only where the browser's own move stays inside. Wrapping BACKWARDS
    // from the first control onto a segmented LAST control is the boundary: the
    // browser would walk off an inert page, so the trap keeps that one and
    // enters at the first segment. That is the residual the roadmap records,
    // and it is now genuinely limited to an END of the tab order rather than to
    // every segmented field with a non-segmented neighbour.
    cleanup();
    render(
      <Modal labelledBy="t2" onClose={() => {}}>
        <h2 id="t2">Title</h2>
        <button type="button">First</button>
        <input type="date" aria-label="Date2" />
      </Modal>
    );
    screen.getByRole("button", { name: "First" }).focus();
    expect(fireEvent.keyDown(window, { key: "Tab", shiftKey: true })).toBe(false);
    expect(screen.getByLabelText("Date2")).toHaveFocus();
  });

  it("ignores Escape carrying an OS modifier", () => {
    // The Ctrl/Alt/Cmd guard used to sit below the Escape branch, so it only
    // protected Tab. Alt+Esc cycles windows on Windows and Cmd-modified
    // Escapes are OS-level on macOS, and each still dispatches an Escape
    // keydown here — measured, all three dismissed the log sheet. Coming back
    // from another app to find a half-filled form gone is not a dismissal
    // anyone asked for.
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    for (const mod of ["altKey", "ctrlKey", "metaKey"]) {
      fireEvent.keyDown(window, { key: "Escape", [mod]: true });
    }
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("lets Tab out of a date field even when a DISABLED control follows it", () => {
    // The segmented-input escape hatch asks "is there a control beyond this one",
    // and a disabled button used to answer yes — so Tab was handed back to the
    // browser, which skipped the disabled control and, with #root inert, left the
    // page. Excluding disabled from FOCUSABLE makes the question mean what its
    // asker assumes: a control you can actually reach.
    render(
      <Modal labelledBy="t" onClose={() => {}}>
        <h2 id="t">Title</h2>
        <button type="button">Before</button>
        <input type="date" aria-label="Date" />
        <button type="button" disabled>
          Disabled
        </button>
      </Modal>
    );
    const date = screen.getByLabelText("Date");
    date.focus();

    // The date is now the LAST reachable control, so the trap must own this Tab.
    const notPrevented = fireEvent.keyDown(window, { key: "Tab" });
    expect(notPrevented).toBe(false);
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
  });

  it("does nothing once its own dialog has left the document", () => {
    // The listener can outlive the dialog: React removes the DOM in the commit
    // and runs the passive cleanup that detaches this listener afterwards. In
    // that window a stale Modal would measure a detached subtree, move nothing,
    // and still preventDefault — which makes the LIVE dialog's listener bail on
    // defaultPrevented, turning Tab into a no-op. It showed up as a suite that
    // went red about one run in sixteen.
    render(<Harness />);
    const outside = document.createElement("button");
    document.body.appendChild(outside);

    // Detach the dialog without unmounting React, reproducing that window.
    const overlay = document.querySelector(".dialog-overlay") as HTMLElement;
    overlay.remove();

    // Focused AFTER the detach, deliberately. Focusing it first would be a
    // truer copy of nothing at all: the focusin net corrects focus that lands
    // outside a LIVE dialog, so the setup would be exercising the net rather
    // than the stale-listener window this test is about. Detached first, the
    // net stands down and the question is only what the leftover keydown
    // listener does.
    outside.focus();

    const notPrevented = fireEvent.keyDown(window, { key: "Tab" });
    expect(notPrevented).toBe(true); // left alone entirely
    expect(outside).toHaveFocus(); // and focus not dragged into a dead dialog

    // Put it back before teardown: the overlay is portaled to <body>, and React
    // throws on unmount if the node it means to remove has already gone.
    document.body.appendChild(overlay);
    outside.remove();
  });

  it("ignores a tabIndex -1 control the same way it ignores a disabled one", () => {
    // `:not([tabindex="-1"])` used to bind only to the last clause of FOCUSABLE,
    // so `button:not([disabled])` matched a tabIndex -1 button. It then sat in
    // the list, the segmented-input hatch saw "something beyond this", handed Tab
    // to the browser, and the browser skipped it and left an inert page — the
    // disabled-button escape again, through a different attribute.
    render(
      <Modal labelledBy="t" onClose={() => {}}>
        <h2 id="t">Title</h2>
        <button type="button">Before</button>
        <input type="date" aria-label="Date" />
        <button type="button" tabIndex={-1}>
          Hidden helper
        </button>
      </Modal>
    );
    const date = screen.getByLabelText("Date");
    date.focus();

    // The date is the last REACHABLE control, so the trap must own this Tab.
    expect(fireEvent.keyDown(window, { key: "Tab" })).toBe(false);
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
  });

  it("ignores a control that is disabled AND carries an explicit tabindex", () => {
    // The `[tabindex]` clause matched on the tabindex alone, so a
    // <button disabled tabIndex={0}> entered the list — the same escape the other
    // clauses were fixed for, by a third route.
    render(
      <Modal labelledBy="t" onClose={() => {}}>
        <h2 id="t">Title</h2>
        <button type="button">Before</button>
        <input type="date" aria-label="Date" />
        <button type="button" disabled tabIndex={0}>
          Disabled but tabbable-looking
        </button>
      </Modal>
    );
    const date = screen.getByLabelText("Date");
    date.focus();

    // The date is the last REACHABLE control, so the trap must own this Tab.
    expect(fireEvent.keyDown(window, { key: "Tab" })).toBe(false);
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
  });

  it("ignores Ctrl/Alt/Cmd+Tab, which belong to the browser", () => {
    // preventDefault does not stop a reserved shortcut, so intercepting these
    // only meant returning from another browser tab to find focus silently
    // moved somewhere else in the dialog.
    render(<Harness />);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    cancel.focus();

    for (const mod of ["ctrlKey", "altKey", "metaKey"] as const) {
      const notPrevented = fireEvent.keyDown(window, { key: "Tab", [mod]: true });
      expect(notPrevented).toBe(true);
      expect(cancel).toHaveFocus();
    }
  });

  it("keeps Tab inside with only one focusable control", () => {
    render(
      <Modal labelledBy="t" onClose={() => {}}>
        <h2 id="t">Title</h2>
        <button type="button">Only</button>
      </Modal>
    );
    const only = screen.getByRole("button", { name: "Only" });
    only.focus();

    fireEvent.keyDown(window, { key: "Tab" });
    expect(only).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(only).toHaveFocus();
  });

  it("steps through controls in order, not just at the edges", () => {
    // The trap now owns every Tab, so ordinary movement has to keep working —
    // taking over Tab and getting the order wrong would be a worse bug than the
    // one it fixes.
    render(
      <Modal labelledBy="t" onClose={() => {}}>
        <h2 id="t">Title</h2>
        <button type="button">One</button>
        <button type="button">Two</button>
        <button type="button">Three</button>
      </Modal>
    );
    const [one, two, three] = ["One", "Two", "Three"].map((n) =>
      screen.getByRole("button", { name: n })
    );

    one.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(two).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(three).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(one).toHaveFocus(); // wrapped
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(three).toHaveFocus(); // wrapped back
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(two).toHaveFocus();
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

/**
 * The scroll lock and the reserved scrollbar gutter are a pair, held in two
 * files. Modal hides the page's overflow while a dialog is open; on a desktop
 * browser with classic scrollbars that removes the scrollbar, which widens the
 * layout by its width, which slides everything centred by `margin: 0 auto` —
 * the app and the sheet inside its own overlay — sideways on open and back on
 * close. Measured at 1280x600 before the fix: the title sat at 172.5px closed
 * and 180px open. `scrollbar-gutter: stable` reserves the space either way, so
 * hiding the scrollbar costs no width.
 *
 * jsdom has no layout and no scrollbars, so it cannot see the shift itself —
 * only that both halves are still present. Losing either one brings the jump
 * back, and it is invisible to every other test.
 */
describe("locking the page costs no layout width", () => {
  it("hides the page's overflow while open and restores it on close", () => {
    document.body.style.overflow = "scroll"; // a pre-existing value to restore
    const { unmount } = render(<Harness />);

    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("scroll");
    document.body.style.overflow = "";
  });

  it("paints the canvas dark, so nothing outside the document is white", () => {
    // The surface an elastic overscroll bounce exposes, and the one `body`'s
    // background does NOT cover: a radial-gradient is a background *image*, and
    // an image paints nothing beyond its element's box. With no colour anywhere,
    // scrolling up past the top of a black app revealed a white band — measured
    // by letting the document stop short of the viewport, which rendered #fff.
    //
    // Asserted on the stylesheet because jsdom has no canvas to sample. Both
    // halves matter: the colour is what gets painted, `color-scheme` is what
    // stops the browser assuming a light page for its own surfaces (scrollbars,
    // form controls, the overscroll area on mobile).
    const css = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");
    const htmlRule = /(^|\})\s*html\s*\{([^}]*)\}/.exec(css)?.[2];

    expect(htmlRule).toBeDefined();
    expect(htmlRule).toMatch(/background-color:\s*#020617/);
    expect(htmlRule).toMatch(/color-scheme:\s*dark/);
  });

  it("puts focus in a dialog opened from inside another one", () => {
    // Real Modals, both portalled to <body> as siblings — the shape that ships,
    // and the one a hand-rolled nested harness cannot reproduce.
    //
    // This failed once. Modal focuses its content from a passive effect declared
    // ABOVE useFocusTrap, so the inner dialog focused its first control while
    // still unregistered; the outer dialog was therefore still "topmost", its
    // focusin net saw focus land somewhere it did not contain, and hauled it
    // straight back. Opening a confirm from a sheet left focus on the button
    // that opened it. Registration is a LAYOUT effect now, so it always precedes
    // any passive focus effect.
    const Stacked = () => {
      const [inner, setInner] = useState(false);
      return (
        <div id="root">
          <Modal labelledBy="outer-t" onClose={() => {}}>
            <h2 id="outer-t">Outer</h2>
            <button type="button" onClick={() => setInner(true)}>
              Open inner
            </button>
            <button type="button">Outer other</button>
          </Modal>
          {inner && (
            <Modal labelledBy="inner-t" onClose={() => {}}>
              <h2 id="inner-t">Inner</h2>
              <button type="button">Inner control</button>
            </Modal>
          )}
        </div>
      );
    };
    render(<Stacked />);

    fireEvent.click(screen.getByRole("button", { name: "Open inner" }));

    expect(screen.getByRole("button", { name: "Inner control" })).toHaveFocus();
  });

  it("reserves the scrollbar's space in styles.css so hiding it shifts nothing", () => {
    const css = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");
    const htmlRule = /(^|\})\s*html\s*\{([^}]*)\}/.exec(css)?.[2];

    expect(htmlRule).toBeDefined();
    expect(htmlRule).toMatch(/scrollbar-gutter:\s*stable/);
  });
});

/**
 * `SHEET_EXIT_MS` and the stylesheet's exit durations are one value in three
 * places. If JS is shorter than CSS the sheet unmounts mid-slide; if it is
 * longer the dialog lingers invisible, delaying the focus restore. The README
 * has said "they are a set and must move together" since they were written —
 * this makes that a check rather than a hope.
 */
describe("the sheet exit duration is one value in three places", () => {
  const css = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");

  it("is never shorter than the longest exit in styles.css", () => {
    // Every rule whose selector LIST mentions a closing sheet, wherever it sits.
    //
    // Two ways this has been wrong, both of which left it green while blind. It
    // first matched `...--sheet\.is-closing\s*\{`, so grouping the rule with any
    // other selector hid it. Rewriting that fixed the grouping and broke nesting:
    // a body of `[^}]*` swallows the first rule inside an `@media` block, so the
    // prelude becomes the "selector" and the rule inside is never matched — which
    // lost the reduced-motion exit this file has always had. `[^{}]*` for the
    // BODY is what makes it innermost-rules-only, and therefore nesting-proof:
    // a body containing `{` is not a body.
    const durations = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selectors]) =>
        selectors
          .split(",")
          .some((s) => /\.dialog(-overlay)?--sheet\.is-closing\b/.test(s))
      )
      .map(([, , body]) => /transition-duration:\s*(\d+)ms/.exec(body)?.[1])
      .filter((d): d is string => d !== undefined)
      .map(Number);

    // Both top-level exits AND the media-scoped one. A bare "> 0" is what let the
    // nesting blindness above pass unnoticed: it kept finding the two top-level
    // rules and reported a healthy maximum while the `@media` rule was invisible.
    expect(durations).toHaveLength(3);

    // Equal to the longest, not to every one: the reduced-motion block shortens
    // the exit deliberately, and a CSS exit *shorter* than the JS wait is
    // harmless (the sheet has finished moving and waits, invisible, to unmount).
    // The failure mode this guards is the other direction — any CSS exit LONGER
    // than SHEET_EXIT_MS unmounts the sheet mid-slide.
    expect(Math.max(...durations)).toBe(SHEET_EXIT_MS);
  });
});
