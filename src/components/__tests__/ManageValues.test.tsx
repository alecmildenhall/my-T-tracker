import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { useState } from "react";
import { ManageValues } from "../ManageValues";
import type { ShotEntry } from "../../types/shot";
import type { TextField } from "../../utils/suggestions";

const shots: ShotEntry[] = [
  { id: "1", date: "2026-07-01", testosteroneEster: "cypionate", injectionSite: "thigh" },
  { id: "2", date: "2026-07-02", testosteroneEster: "cypionate", injectionSite: "glute" },
  { id: "3", date: "2026-07-03", testosteroneEster: "test cyp" },
];

const renderPanel = () => {
  const onRenameValue = vi.fn();
  const onClearValue = vi.fn();
  render(
    <ManageValues
      shots={shots}
      onRenameValue={onRenameValue}
      onClearValue={onClearValue}
    />
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
      onRenameValue={(field: TextField, from: string, to: string) =>
        setCurrent((prev) =>
          prev.map((s) => (s[field] === from ? { ...s, [field]: to } : s))
        )
      }
      onClearValue={(field: TextField, value: string) =>
        setCurrent((prev) =>
          prev.map((s) => (s[field] === value ? { ...s, [field]: undefined } : s))
        )
      }
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
      "cypionate"
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
    fireEvent.change(screen.getByLabelText("New name"), { target: { value: "quad" } });
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

    expect(onRenameValue).toHaveBeenCalledWith("injectionSite", "glute", "quad");
  });
});
