import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { useState } from "react";
import { ManageValues } from "../ManageValues";
import type { ShotEntry } from "../../types/shot";
import type { TextField } from "../../utils/suggestions";

const shots: ShotEntry[] = [
  {
    id: "1",
    date: "2026-07-01",
    testosteroneEster: "cypionate",
    injectionSite: "thigh",
  },
  {
    id: "2",
    date: "2026-07-02",
    testosteroneEster: "cypionate",
    injectionSite: "glute",
  },
  { id: "3", date: "2026-07-03", testosteroneEster: "test cyp" },
];

const renderPanel = () => {
  const onRenameValue = vi.fn(() => true);
  const onClearValue = vi.fn(() => true);
  render(
    <ManageValues
      shots={shots}
      onRenameValue={onRenameValue}
      onClearValue={onClearValue}
    />,
  );
  return { onRenameValue, onClearValue };
};

// A panel whose callbacks actually mutate its shots, so a confirmed
// rename/remove really removes the affected row from the DOM (unlike the
// spy-based renderPanel). Needed to exercise the "opener no longer exists" path.
const StatefulPanel = () => {
  const [current, setCurrent] = useState<ShotEntry[]>([
    { id: "1", date: "2026-07-01", injectionSite: "thigh" },
    { id: "2", date: "2026-07-02", injectionSite: "glute" },
  ]);
  return (
    <ManageValues
      shots={current}
      onRenameValue={(field: TextField, from: string, to: string) => {
        setCurrent((prev) =>
          prev.map((s) => (s[field] === from ? { ...s, [field]: to } : s)),
        );
        return true;
      }}
      onClearValue={(field: TextField, value: string) => {
        setCurrent((prev) =>
          prev.map((s) =>
            s[field] === value ? { ...s, [field]: undefined } : s,
          ),
        );
        return true;
      }}
    />
  );
};

const dialog = () => screen.getByRole("dialog");
const panel = () => document.querySelector(".manage-values");

describe("ManageValues", () => {
  it("lists distinct values with usage counts", () => {
    renderPanel();
    expect(screen.getByText("cypionate")).toBeInTheDocument();
    expect(screen.getByText("test cyp")).toBeInTheDocument();
    expect(screen.getByText("used in 2 entries")).toBeInTheDocument();
  });

  it("confirms then clears a value on remove", () => {
    const { onClearValue } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Remove test cyp" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Remove" }));
    expect(onClearValue).toHaveBeenCalledWith("testosteroneEster", "test cyp");
  });

  it("holds the remove dialog open when the change can't be written", () => {
    // Closing regardless dismissed as though it had worked, while the value was
    // still in the list — the same silent failure the log sheet was fixed for.
    // Settings is one of the four write sites this is meant to stop being quiet.
    render(
      <ManageValues
        shots={shots}
        onRenameValue={vi.fn(() => true)}
        onClearValue={vi.fn(() => false)}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove test cyp" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Remove" }));

    expect(dialog()).toBeInTheDocument();
    expect(within(dialog()).getByRole("alert")).toHaveTextContent(
      /Couldn.t save that/,
    );
    expect(screen.getByText("test cyp")).toBeInTheDocument();
  });

  it("holds the rename dialog open when the change can't be written", () => {
    render(
      <ManageValues
        shots={shots}
        onRenameValue={vi.fn(() => false)}
        onClearValue={vi.fn(() => true)}
      />,
    );
    const row = screen.getByText("test cyp").closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Rename" }));
    fireEvent.change(within(dialog()).getByRole("textbox"), {
      target: { value: "cyp" },
    });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Rename" }));

    expect(dialog()).toBeInTheDocument();
    expect(within(dialog()).getByRole("alert")).toHaveTextContent(
      /Couldn.t save that/,
    );
  });

  it("asks to combine when renaming onto an existing value, then renames", () => {
    const { onRenameValue } = renderPanel();

    const row = screen.getByText("test cyp").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Rename" }));

    fireEvent.change(screen.getByLabelText("New name"), {
      target: { value: "cypionate" },
    });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Rename" }));

    // collision -> combine step, nothing applied yet
    expect(screen.getByText(/already exists/)).toBeInTheDocument();
    expect(onRenameValue).not.toHaveBeenCalled();

    fireEvent.click(within(dialog()).getByRole("button", { name: "Combine" }));
    expect(onRenameValue).toHaveBeenCalledWith(
      "testosteroneEster",
      "test cyp",
      "cypionate",
    );
  });

  // --- Cancel/Escape path: the opener still exists, so focus returns to it. ---
  it("restores focus to the opener button on cancel (not document.activeElement)", () => {
    renderPanel();
    // jsdom (like Safari/iOS) does not focus a <button> on click, so the opener
    // is tracked explicitly rather than via document.activeElement.
    const row = screen.getByText("test cyp").closest("li")!;
    const renameBtn = within(row).getByRole("button", { name: "Rename" });
    fireEvent.click(renameBtn);

    // Dialog open, focus on the input (initial focus).
    expect(screen.getByLabelText("New name")).toHaveFocus();

    // Close with Escape → focus returns to the exact button that opened it.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(renameBtn).toHaveFocus();
  });

  // --- Confirm path: the mutation removes the opener's row, so focus must fall
  // back to the panel (APG "logical location"), not to <body>. ---
  it("moves focus to the panel when a confirmed rename removes the opener's row", () => {
    render(<StatefulPanel />);
    const row = screen.getByText("glute").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("New name"), {
      target: { value: "quad" },
    });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Rename" }));

    // The "glute" row (with its Rename button) is gone.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("glute")).not.toBeInTheDocument();
    // Focus landed on the panel, not on <body>.
    expect(panel()).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });

  it("moves focus to the panel when Remove deletes the opener's row", () => {
    render(<StatefulPanel />);
    const row = screen.getByText("glute").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Remove glute" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Remove" }));

    expect(screen.queryByText("glute")).not.toBeInTheDocument();
    expect(panel()).toHaveFocus();
  });

  it("renames immediately to a brand-new value", () => {
    const { onRenameValue } = renderPanel();

    const row = screen.getByText("glute").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Rename" }));

    fireEvent.change(screen.getByLabelText("New name"), {
      target: { value: "quad" },
    });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Rename" }));

    expect(onRenameValue).toHaveBeenCalledWith(
      "injectionSite",
      "glute",
      "quad",
    );
  });
});

describe("ManageValues rename wash", () => {
  /** `fireEvent.animationEnd` does NOT carry `animationName` through jsdom — it
   *  arrives as `undefined`, which leaves the guard permanently unsatisfied and
   *  reads as a broken guard rather than a broken event. Built by hand, the same
   *  way App.test.tsx does it for the shot row. */
  const endAnimation = (el: Element, animationName: string) => {
    const evt = new Event("animationend", { bubbles: true });
    Object.defineProperty(evt, "animationName", { value: animationName });
    fireEvent(el, evt);
  };

  const washing = () => document.querySelectorAll(".manage-row--washing");
  const rowNamed = (name: string) =>
    [...document.querySelectorAll(".manage-row")].find(
      (r) => r.querySelector(".manage-row__name")?.textContent === name,
    )!;
  const openRenameOf = (value: string) => {
    const row = rowNamed(value);
    fireEvent.click(
      within(row as HTMLElement).getByRole("button", { name: "Rename" }),
    );
  };
  const typeAndSubmit = (value: string) => {
    fireEvent.change(within(dialog()).getByLabelText("New name"), {
      target: { value },
    });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Rename" }));
  };

  it("washes the renamed row, and only that row", () => {
    render(<StatefulPanel />);
    openRenameOf("thigh");
    typeAndSubmit("quad");

    expect(washing()).toHaveLength(1);
    expect(rowNamed("quad").className).toContain("manage-row--washing");
  });

  it("washes nothing when the name comes back unchanged", () => {
    // The whole point of the acknowledgement is that it means something
    // happened. Submitting the same name closes the dialog and writes nothing,
    // so a wash here would be the app congratulating itself for a no-op.
    render(<StatefulPanel />);
    openRenameOf("thigh");
    typeAndSubmit("thigh");

    expect(washing()).toHaveLength(0);
  });

  it("washes nothing when the box is emptied", () => {
    render(<StatefulPanel />);
    openRenameOf("thigh");
    typeAndSubmit("   ");

    expect(washing()).toHaveLength(0);
  });

  it("washes nothing when the write is refused", () => {
    // A refused write leaves the dialog open with its error, and the value
    // unchanged in the list. Washing here would be the silent-success bug in
    // reverse: an acknowledgement for data that never reached storage.
    render(
      <ManageValues
        shots={shots}
        onRenameValue={vi.fn(() => false)}
        onClearValue={vi.fn(() => true)}
      />,
    );
    openRenameOf("thigh");
    typeAndSubmit("quad");

    expect(washing()).toHaveLength(0);
    expect(dialog()).toBeInTheDocument();
  });

  it("washes a re-capitalisation, which does change every entry", () => {
    render(<StatefulPanel />);
    openRenameOf("thigh");
    typeAndSubmit("Thigh");

    expect(washing()).toHaveLength(1);
    expect(rowNamed("Thigh").className).toContain("manage-row--washing");
  });

  it("washes the surviving row after two values are combined", () => {
    // The row that changed is the target's: it absorbed the other's entries.
    // Matching by normalized value rather than the submitted string matters
    // here — the group's display name is whichever casing was seen most
    // recently, so an exact-string match could find no row at all.
    render(<StatefulPanel />);
    openRenameOf("thigh");
    typeAndSubmit("glute");
    fireEvent.click(within(dialog()).getByRole("button", { name: /Combine/ }));

    expect(washing()).toHaveLength(1);
  });

  it("retires the wash when its own animation ends, not any animation", () => {
    render(<StatefulPanel />);
    openRenameOf("thigh");
    typeAndSubmit("quad");

    // onAnimationEnd bubbles, so an unrelated animation must not cut it short.
    endAnimation(rowNamed("quad"), "chip-pop");
    expect(washing()).toHaveLength(1);

    endAnimation(rowNamed("quad"), "row-wash");
    expect(washing()).toHaveLength(0);
  });

  it("retires an outstanding wash when the next dialog is dismissed", () => {
    render(<StatefulPanel />);
    openRenameOf("thigh");
    typeAndSubmit("quad");
    expect(washing()).toHaveLength(1);

    openRenameOf("glute");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(washing()).toHaveLength(0);
  });
});
