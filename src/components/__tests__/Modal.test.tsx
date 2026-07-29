import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
