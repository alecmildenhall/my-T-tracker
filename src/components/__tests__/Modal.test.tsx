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
});
