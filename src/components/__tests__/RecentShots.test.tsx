import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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
      onDeleteShot={vi.fn(() => true)}
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

  it("offers the same two actions History does", () => {
    // Delete was kept off this screen because a mis-tap on the screen you touch
    // most could lose an entry — but it sits behind the same confirm History
    // uses, which makes it two deliberate acts rather than one. A row offering
    // Edit and not Delete, beside an identical row a tab away offering both, is
    // a difference with no reason a user can see.
    renderTeaser();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(3);
  });

  it("asks before deleting, and does not delete on the press itself", () => {
    const onDeleteShot = vi.fn(() => true);
    renderTeaser({ onDeleteShot });

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    // The press opens the question; it does not answer it.
    expect(onDeleteShot).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Delete this shot?");

    // "Keep it" is the initially focused control, so a stray Enter keeps it.
    expect(within(dialog).getByRole("button", { name: "Keep it" })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(onDeleteShot).toHaveBeenCalledWith("s2"); // newest first
  });

  it("keeps the shot and says so when the delete cannot be written", () => {
    // Same dialog as History, so the same refusal behaviour: it holds open and
    // says so rather than dismissing as though it had worked.
    renderTeaser({ onDeleteShot: vi.fn(() => false) });
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" })
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/isn.t accepting changes/i);
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
      expect(names).toEqual(["Edit", "Delete"]);
    });
  });

  it("renders its actions per row, and nothing empty when there are none", () => {
    // The wrapper used to render regardless, so a row with no actions carried an
    // empty flex div and its top margin — 24px of nothing on the one screen that
    // has to fit greeting, log button and teaser above the fold. It is
    // conditional, so it appears exactly when it has something in it.
    renderTeaser();
    const rows = document.querySelectorAll(".shot-list-item__actions");
    expect(rows).toHaveLength(3);
    rows.forEach((r) => expect(r.querySelectorAll("button")).toHaveLength(2));
  });

  it("offers 'See all' only once something has been logged", () => {
    const onSeeAll = vi.fn();
    const { rerender } = render(
      <RecentShots
        shots={[]}
        onSeeAll={onSeeAll}
        onEditShot={vi.fn()}
        onDeleteShot={vi.fn(() => true)}
      />
    );
    expect(screen.queryByRole("button", { name: /See all/ })).not.toBeInTheDocument();
    expect(screen.getByText(/No shots logged yet/)).toBeInTheDocument();

    rerender(
      <RecentShots
        shots={makeShots(1)}
        onSeeAll={onSeeAll}
        onEditShot={vi.fn()}
        onDeleteShot={vi.fn(() => true)}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /See all/ }));
    expect(onSeeAll).toHaveBeenCalledOnce();
  });
});
