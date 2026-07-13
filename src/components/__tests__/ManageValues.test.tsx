import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ManageValues } from "../ManageValues";
import type { ShotEntry } from "../../types/shot";

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

const dialog = () => screen.getByRole("dialog");

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
