import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useState } from "react";
import { HistoryView } from "../HistoryView";
import {
  emptyHistoryQuery,
  type HistoryQuery,
} from "../../utils/historyQuery";
import type { ShotEntry } from "../../types/shot";

beforeEach(() => localStorage.clear());

const shots: ShotEntry[] = [
  { id: "a", date: "2026-06-01", injectionSite: "thigh", painScore: 2, notes: "felt fine" },
  { id: "b", date: "2026-06-15", injectionSite: "glute", painScore: 8, notes: "quite sore" },
  { id: "c", date: "2026-07-01", injectionSite: "thigh", painScore: 5, mood: "anxious" },
];

/** HistoryView is controlled — the real query state lives in App — so wrap it in
 *  a tiny stateful host to drive it the way the app does. */
const Harness = ({ data = shots }: { data?: ShotEntry[] }) => {
  const [query, setQuery] = useState<HistoryQuery>(emptyHistoryQuery);
  return (
    <HistoryView
      shots={data}
      query={query}
      onQueryChange={setQuery}
      onEditShot={vi.fn()}
      onDeleteShot={vi.fn()}
    />
  );
};

/** Search is debounced, so advance past the pause before asserting. */
const settleSearch = async () => {
  await act(async () => {
    vi.advanceTimersByTime(250);
  });
};

const openFilters = () =>
  fireEvent.click(screen.getByRole("button", { name: /Filters/ }));

describe("HistoryView", () => {
  it("lists every shot newest-first by default", () => {
    render(<Harness />);
    expect(screen.getByText("Showing 3 of 3 shots")).toBeInTheDocument();
    const dates = screen.getAllByText(/2026-0/).map((el) => el.textContent);
    expect(dates).toEqual(["2026-07-01", "2026-06-15", "2026-06-01"]);
  });

  it("searches free text after the debounce settles", async () => {
    vi.useFakeTimers();
    try {
      render(<Harness />);
      fireEvent.change(screen.getByPlaceholderText(/Search notes/), {
        target: { value: "sore" },
      });
      await settleSearch();
      expect(screen.getByText("Showing 1 of 1 shot")).toBeInTheDocument();
      expect(screen.getByText("quite sore")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("filters by a structured facet", () => {
    render(<Harness />);
    openFilters();
    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "thigh" } });
    expect(screen.getByText("Showing 2 of 2 shots")).toBeInTheDocument();
  });

  it("filters pain by band rather than a raw 0–10 range", () => {
    render(<Harness />);
    openFilters();
    fireEvent.change(screen.getByLabelText("Pain"), { target: { value: "severe" } });
    expect(screen.getByText("Showing 1 of 1 shot")).toBeInTheDocument();
    expect(screen.getByText("quite sore")).toBeInTheDocument();
  });

  it("counts active facets on the toggle so a hidden filter is never silent", () => {
    render(<Harness />);
    openFilters();
    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "thigh" } });
    fireEvent.change(screen.getByLabelText("Pain"), { target: { value: "mild" } });
    // The visible badge reads "Filters · 2"; the accessible name spells out what
    // the number means.
    expect(
      screen.getByRole("button", { name: "Filters, 2 active" })
    ).toBeInTheDocument();
  });

  it("treats the 'Any' option as no constraint", () => {
    render(<Harness />);
    openFilters();
    const site = screen.getByLabelText("Site");
    fireEvent.change(site, { target: { value: "thigh" } });
    expect(screen.getByText("Showing 2 of 2 shots")).toBeInTheDocument();
    // Back to "Any" — an empty value must restore the full list, not blank it.
    fireEvent.change(site, { target: { value: "" } });
    expect(screen.getByText("Showing 3 of 3 shots")).toBeInTheDocument();
  });

  it("Clear resets search and filters together", async () => {
    vi.useFakeTimers();
    try {
      render(<Harness />);
      openFilters();
      fireEvent.change(screen.getByLabelText("Site"), { target: { value: "thigh" } });
      fireEvent.change(screen.getByPlaceholderText(/Search notes/), {
        target: { value: "fine" },
      });
      await settleSearch();
      expect(screen.getByText("Showing 1 of 1 shot")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Clear" }));
      await settleSearch();
      expect(screen.getByText("Showing 3 of 3 shots")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the empty-log message when nothing has been logged", () => {
    render(<Harness data={[]} />);
    expect(
      screen.getByText(/No shots logged yet\. Your data stays on this device\./)
    ).toBeInTheDocument();
    // The status line must not claim "no matching shots" on first run — that
    // implies a filter is on when none is.
    expect(screen.getByRole("status")).toHaveTextContent("No shots logged yet");
  });

  it("keeps the filter panel mounted while collapsed, for aria-controls", () => {
    render(<Harness />);
    const panel = document.getElementById("history-filters");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute("hidden");

    openFilters();
    expect(document.getElementById("history-filters")).not.toHaveAttribute("hidden");
  });

  it("keeps a selected facet visible after its last shot is gone", () => {
    const one: ShotEntry[] = [{ id: "x", date: "2026-06-01", injectionSite: "glute" }];
    const { rerender } = render(<Harness data={one} />);
    openFilters();
    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "glute" } });

    // Delete lives in History, so losing the last shot using a filtered value is
    // one tap away; the select must still show it rather than rendering blank.
    rerender(<Harness data={one} />);
    const site = screen.getByLabelText("Site") as HTMLSelectElement;
    expect(site.value).toBe("glute");
    expect(site.selectedIndex).not.toBe(-1);
  });

  it("distinguishes 'no matches' from 'nothing logged'", () => {
    render(<Harness />);
    openFilters();
    fireEvent.change(screen.getByLabelText("Pain"), { target: { value: "none" } });
    expect(screen.getByText(/No shots match these filters/)).toBeInTheDocument();
    expect(screen.queryByText(/No shots logged yet/)).not.toBeInTheDocument();
  });

  it("pages with Load more and stops when the list is exhausted", () => {
    const many: ShotEntry[] = Array.from({ length: 25 }, (_, i) => ({
      id: `s${i}`,
      date: `2026-06-${String(i + 1).padStart(2, "0")}`,
    }));
    render(<Harness data={many} />);

    expect(screen.getByText("Showing 20 of 25 shots")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getByText("Showing 25 of 25 shots")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("resets the page window when the query changes", () => {
    const many: ShotEntry[] = Array.from({ length: 25 }, (_, i) => ({
      id: `s${i}`,
      date: `2026-06-${String(i + 1).padStart(2, "0")}`,
      injectionSite: "thigh",
    }));
    render(<Harness data={many} />);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getByText("Showing 25 of 25 shots")).toBeInTheDocument();

    // Narrowing must not keep the grown window, which would reveal several
    // pages at once for the new result set.
    openFilters();
    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "thigh" } });
    expect(screen.getByText("Showing 20 of 25 shots")).toBeInTheDocument();
  });

  it("keeps the visible label inside the accessible name (WCAG 2.5.3)", () => {
    render(<Harness />);
    openFilters();
    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "thigh" } });

    // A voice-control user says what they see ("Filters"), so the visible word
    // must be part of the accessible name, not replaced by an aria-label.
    const toggle = screen.getByRole("button", { name: /^Filters/ });
    expect(toggle).toHaveTextContent("Filters · 1");
    expect(toggle).toHaveAccessibleName("Filters, 1 active");
  });

  it("moves focus to the first newly revealed row after Load more", () => {
    const many: ShotEntry[] = Array.from({ length: 25 }, (_, i) => ({
      id: `s${i}`,
      date: `2026-06-${String(i + 1).padStart(2, "0")}`,
    }));
    render(<Harness data={many} />);

    // The final press unmounts the button itself, so focus must land on the
    // content the user asked for rather than falling to <body>.
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    const rows = screen.getAllByRole("listitem");
    expect(rows[20]).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });

  it("does not collapse the page window until the search settles", async () => {
    vi.useFakeTimers();
    try {
      const many: ShotEntry[] = Array.from({ length: 45 }, (_, i) => ({
        id: `s${i}`,
        date: `2026-06-${String((i % 28) + 1).padStart(2, "0")}`,
        notes: "keep",
      }));
      render(<Harness data={many} />);
      fireEvent.click(screen.getByRole("button", { name: "Load more" }));
      expect(screen.getByText("Showing 40 of 45 shots")).toBeInTheDocument();

      // Mid-typing the list still shows the OLD results, so collapsing to one
      // page now would jump the page height under the user's finger and
      // announce a stale count.
      fireEvent.change(screen.getByPlaceholderText(/Search notes/), {
        target: { value: "kee" },
      });
      expect(screen.getByText("Showing 40 of 45 shots")).toBeInTheDocument();

      await settleSearch();
      expect(screen.getByText("Showing 20 of 45 shots")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("announces the result count politely", () => {
    render(<Harness />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Showing 3 of 3 shots");
  });
});
