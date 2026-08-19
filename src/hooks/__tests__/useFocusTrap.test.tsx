import React, { useRef } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useFocusTrap } from "../useFocusTrap";

/**
 * A bare dialog-shaped host. Deliberately NOT `Modal` — Modal's own tests cover
 * the trap through it, and the point here is the behaviour Modal cannot reach:
 * two of them at once, and focus arriving without a keypress.
 */
const Trap: React.FC<{
  onEscape?: () => void;
  children: React.ReactNode;
  label: string;
}> = ({ onEscape = () => {}, children, label }) => {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, { onEscape });
  return (
    <div ref={ref} tabIndex={-1} data-testid={label}>
      {children}
    </div>
  );
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("useFocusTrap", () => {
  describe("when one dialog is open", () => {
    it("wraps Tab from the last control back to the first", () => {
      render(
        <Trap label="only">
          <button>first</button>
          <button>last</button>
        </Trap>,
      );
      screen.getByText("last").focus();

      const notPrevented = fireEvent.keyDown(window, { key: "Tab" });

      expect(notPrevented).toBe(false);
      expect(screen.getByText("first")).toHaveFocus();
    });

    it("closes on Escape", () => {
      const onEscape = vi.fn();
      render(
        <Trap label="only" onEscape={onEscape}>
          <button>ok</button>
        </Trap>,
      );
      fireEvent.keyDown(window, { key: "Escape" });
      expect(onEscape).toHaveBeenCalledOnce();
    });

    it("pulls focus back when it lands outside without a keypress", () => {
      // The net. Tab is predicted; this catches focus that arrived some other
      // way — a click, a script, an assistive-tech gesture — which the keydown
      // handler never sees because no key was pressed.
      render(
        <Trap label="only">
          <button>inside</button>
        </Trap>,
      );
      const outside = document.createElement("button");
      document.body.appendChild(outside);

      outside.focus();

      expect(outside).not.toHaveFocus();
      expect(screen.getByText("inside")).toHaveFocus();
    });

    it("leaves focus alone once its dialog has left the document", () => {
      // The net must not fight the close-time restore. React removes the DOM in
      // the commit and runs this passive cleanup afterwards, so for one window
      // the listener is live and the dialog is gone — and that is exactly when
      // Modal is handing focus back to the opener.
      render(
        <Trap label="only">
          <button>inside</button>
        </Trap>,
      );
      const host = screen.getByTestId("only");
      const parent = host.parentNode as HTMLElement;
      host.remove();

      const opener = document.createElement("button");
      document.body.appendChild(opener);
      opener.focus();

      expect(opener).toHaveFocus();

      // Put it back before teardown: React still believes it owns this node and
      // throws on unmount if the node it means to remove has already gone.
      parent.appendChild(host);
    });
  });

  describe("when a dialog opens on top of another", () => {
    // None of this was reachable before: two mounted traps both listened on the
    // window, so the outer one measured focus as "outside" — because it was
    // outside ITS dialog — and hauled it back out of the inner one. It was
    // recorded as latent because today's dialogs are mutually exclusive. A
    // confirm opened from inside a sheet is on the way in B½.
    const Stacked: React.FC<{ onOuter: () => void; onInner: () => void }> = ({
      onOuter,
      onInner,
    }) => (
      <Trap label="outer" onEscape={onOuter}>
        <button>outer control</button>
        <Trap label="inner" onEscape={onInner}>
          <button>inner control</button>
        </Trap>
      </Trap>
    );

    it("only the topmost closes on Escape", () => {
      const onOuter = vi.fn();
      const onInner = vi.fn();
      render(<Stacked onOuter={onOuter} onInner={onInner} />);

      fireEvent.keyDown(window, { key: "Escape" });

      expect(onInner).toHaveBeenCalledOnce();
      expect(onOuter).not.toHaveBeenCalled();
    });

    it("the outer trap does not drag focus out of the inner dialog", () => {
      render(<Stacked onOuter={() => {}} onInner={() => {}} />);
      screen.getByText("inner control").focus();

      fireEvent.keyDown(window, { key: "Tab" });

      // One control inside the inner dialog, so Tab rotates back onto it.
      // Before the stack, the outer trap saw this as focus outside itself and
      // pulled it onto "outer control".
      expect(screen.getByText("inner control")).toHaveFocus();
    });

    it("a dialog beside another does not steal focus from the one on top", () => {
      // SIBLINGS, not nested — which is the shape that actually ships, since
      // Modal portals every dialog to <body>. It matters because the nested
      // harness above cannot exercise this: an inner dialog is *contained* by
      // the outer one, so the outer's net returns early on containment alone
      // and the topmost check is never reached. Rendered side by side, the
      // first dialog sees focus in the second as "outside me" and would haul it
      // back — which is the stacked-dialog bug in its focus form rather than
      // its keyboard form.
      render(
        <>
          <Trap label="under">
            <button>under control</button>
          </Trap>
          <Trap label="over">
            <button>over control</button>
          </Trap>
        </>,
      );

      screen.getByText("over control").focus();

      expect(screen.getByText("over control")).toHaveFocus();
    });

    it("hands the keyboard back to the outer dialog when the inner one closes", () => {
      const { rerender } = render(
        <Trap label="outer" onEscape={() => {}}>
          <button>outer control</button>
          <Trap label="inner" onEscape={() => {}}>
            <button>inner control</button>
          </Trap>
        </Trap>,
      );

      // Inner unmounts, as it would on confirm/cancel.
      const onOuter = vi.fn();
      rerender(
        <Trap label="outer" onEscape={onOuter}>
          <button>outer control</button>
        </Trap>,
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(onOuter).toHaveBeenCalledOnce();
    });
  });
});
