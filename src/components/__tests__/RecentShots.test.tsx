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
      onEditShot={vi.fn()}
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
    // Edit is here now; Delete deliberately is not. That was always the point of
    // "read-only" — a mis-tap on the screen you use most must never lose an
    // entry — and editing is recoverable in a way deleting is not.
    renderTeaser();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("edits a shot from its own Edit button", () => {
    const onEditShot = vi.fn();
    renderTeaser({ shots: makeShots(3), onEditShot });

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    expect(onEditShot).toHaveBeenCalledTimes(1);
    // Newest first, so the first row is the newest shot.
    expect(onEditShot.mock.calls[0][0].date).toBe("2026-06-03");
  });

  it("does not make the whole row a control", () => {
    // A card-sized target beside the app's primary button is too easy to hit on
    // the way past, and what it opened was a modal editor rather than a page.
    // The only buttons in a teaser row are the ones you aim at.
    renderTeaser();
    document.querySelectorAll("li.shot-list-item").forEach((row) => {
      const names = [...row.querySelectorAll("button")].map((b) => b.textContent);
      expect(names).toEqual(["Edit"]);
    });
  });

  it("renders one action per row, and nothing empty when there are none", () => {
    // The wrapper used to render regardless, so a row with no actions carried an
    // empty flex div and its top margin — 24px of nothing on the one screen that
    // has to fit greeting, log button and teaser above the fold. It is
    // conditional, so it appears exactly when it has something in it.
    renderTeaser();
    const rows = document.querySelectorAll(".shot-list-item__actions");
    expect(rows).toHaveLength(3);
    rows.forEach((r) => expect(r.querySelectorAll("button")).toHaveLength(1));
  });

  it("offers 'See all' only once something has been logged", () => {
    const onSeeAll = vi.fn();
    const { rerender } = render(
      <RecentShots shots={[]} onSeeAll={onSeeAll} onEditShot={vi.fn()} />
    );
    expect(screen.queryByRole("button", { name: /See all/ })).not.toBeInTheDocument();
    expect(screen.getByText(/No shots logged yet/)).toBeInTheDocument();

    rerender(
      <RecentShots shots={makeShots(1)} onSeeAll={onSeeAll} onEditShot={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /See all/ }));
    expect(onSeeAll).toHaveBeenCalledOnce();
  });
});
