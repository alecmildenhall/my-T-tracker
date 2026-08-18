import React from "react";
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

/** The teaser, with both required callbacks. Defaults so a test only names the
 *  one it cares about. */
const renderTeaser = (
  props: Partial<React.ComponentProps<typeof RecentShots>> = {}
) =>
  render(
    <RecentShots
      shots={makeShots(3)}
      onSeeAll={vi.fn()}
      onOpenShot={vi.fn()}
      {...props}
    />
  );

describe("RecentShots", () => {
  it("shows only the newest few, newest first", () => {
    renderTeaser({ shots: makeShots(10) });
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(TEASER_COUNT);
    expect(items[0]).toHaveTextContent("2026-06-10");
  });

  it("carries no destructive control, one tap from the log button", () => {
    // The row opens now, but Delete still lives only in History: a mis-tap on
    // the screen you use most must never be able to lose an entry.
    renderTeaser();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("opens a shot when its row is pressed", () => {
    const onOpenShot = vi.fn();
    renderTeaser({ shots: makeShots(3), onOpenShot });

    // Found by ROLE, which is the point: the row is a real button, so it is in
    // the tab order and answers Enter and Space. A div with onClick would pass
    // a click test and none of that.
    const rows = screen.getAllByRole("button", { name: /2026-06-/ });
    fireEvent.click(rows[0]);

    expect(onOpenShot).toHaveBeenCalledTimes(1);
    // Newest first, so the first row is the newest shot.
    expect(onOpenShot.mock.calls[0][0].date).toBe("2026-06-03");
  });

  it("nests no button inside the row button", () => {
    // Invalid HTML that browsers reconstruct however they like — which is why
    // the teaser passes `onOpen` and History passes `onEdit`/`onDelete`, never
    // both.
    renderTeaser();
    document.querySelectorAll(".shot-list-item__open").forEach((row) => {
      expect(row.querySelector("button")).toBeNull();
    });
  });

  it("leaves no empty actions row taking up space on each teaser card", () => {
    // A read-only row rendered the actions wrapper regardless, so each card
    // carried an empty flex div and its top margin — 24px of nothing on the one
    // screen that has to fit greeting, log button and teaser above the fold.
    renderTeaser();
    expect(document.querySelectorAll(".shot-list-item__actions")).toHaveLength(0);
  });

  it("offers 'See all' only once something has been logged", () => {
    const onSeeAll = vi.fn();
    const { rerender } = render(
      <RecentShots shots={[]} onSeeAll={onSeeAll} onOpenShot={vi.fn()} />
    );
    expect(screen.queryByRole("button", { name: /See all/ })).not.toBeInTheDocument();
    expect(screen.getByText(/No shots logged yet/)).toBeInTheDocument();

    rerender(
      <RecentShots shots={makeShots(1)} onSeeAll={onSeeAll} onOpenShot={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /See all/ }));
    expect(onSeeAll).toHaveBeenCalledOnce();
  });
});
