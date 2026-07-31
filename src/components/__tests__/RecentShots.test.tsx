import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RecentShots, TEASER_COUNT } from "../RecentShots";
import type { ShotEntry } from "../../types/shot";

beforeEach(() => localStorage.clear());

const makeShots = (n: number): ShotEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    date: `2026-06-${String(i + 1).padStart(2, "0")}`,
  }));

describe("RecentShots", () => {
  it("shows only the newest few, newest first", () => {
    render(<RecentShots shots={makeShots(10)} onSeeAll={vi.fn()} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(TEASER_COUNT);
    expect(items[0]).toHaveTextContent("2026-06-10");
  });

  it("is read-only — the destructive control is not one tap from the log button", () => {
    render(<RecentShots shots={makeShots(3)} onSeeAll={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("leaves no empty actions row taking up space on each teaser card", () => {
    // A read-only row rendered the actions wrapper regardless, so each card
    // carried an empty flex div and its top margin — 24px of nothing on the one
    // screen that has to fit greeting, log button and teaser above the fold.
    render(<RecentShots shots={makeShots(3)} onSeeAll={vi.fn()} />);
    expect(document.querySelectorAll(".shot-list-item__actions")).toHaveLength(0);
  });

  it("offers 'See all' only once something has been logged", () => {
    const onSeeAll = vi.fn();
    const { rerender } = render(<RecentShots shots={[]} onSeeAll={onSeeAll} />);
    expect(screen.queryByRole("button", { name: /See all/ })).not.toBeInTheDocument();
    expect(screen.getByText(/No shots logged yet/)).toBeInTheDocument();

    rerender(<RecentShots shots={makeShots(1)} onSeeAll={onSeeAll} />);
    fireEvent.click(screen.getByRole("button", { name: /See all/ }));
    expect(onSeeAll).toHaveBeenCalledOnce();
  });
});
