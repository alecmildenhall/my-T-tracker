import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
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

  it("filters by an inclusive date range from the picker", () => {
    render(<Harness />);
    openFilters();

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-06-15" } });
    expect(screen.getByText("Showing 2 of 2 shots")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-06-15" } });
    // Both bounds inclusive, so the 15th itself is the only match.
    expect(screen.getByText("Showing 1 of 1 shot")).toBeInTheDocument();
    expect(screen.getByText("quite sore")).toBeInTheDocument();
  });

  it("treats a cleared date bound as no constraint", () => {
    render(<Harness />);
    openFilters();
    const from = screen.getByLabelText("From");

    fireEvent.change(from, { target: { value: "2026-07-01" } });
    expect(screen.getByText("Showing 1 of 1 shot")).toBeInTheDocument();

    // Emptying the picker (or a partially-typed, impossible date) must restore
    // the full list rather than filtering on a bad bound.
    fireEvent.change(from, { target: { value: "" } });
    expect(screen.getByText("Showing 3 of 3 shots")).toBeInTheDocument();
  });

  it("filters by position and by type of T", () => {
    const shots2: ShotEntry[] = [
      { id: "a", date: "2026-06-01", injectionSitePosition: "left", testosteroneEster: "cypionate" },
      { id: "b", date: "2026-06-02", injectionSitePosition: "right", testosteroneEster: "enanthate" },
    ];
    render(<Harness data={shots2} />);
    openFilters();

    fireEvent.change(screen.getByLabelText("Position"), { target: { value: "left" } });
    expect(screen.getByText("Showing 1 of 1 shot")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Position"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Type of T"), { target: { value: "enanthate" } });
    expect(screen.getByText("Showing 1 of 1 shot")).toBeInTheDocument();
  });

  it("combines a date range with a facet", () => {
    render(<Harness />);
    openFilters();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-06-10" } });
    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "thigh" } });
    // 06-15 is glute and 06-01 is out of range, leaving only 07-01 (thigh).
    expect(screen.getByText("Showing 1 of 1 shot")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Filters, 2 active" })
    ).toBeInTheDocument();
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

  it("Clear all resets search and filters together", async () => {
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

      fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
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
    // The harness must actually LOSE the shot for this to test anything: the
    // filter value then no longer appears in suggestionsFor's options, which is
    // the case withSelected exists to cover.
    const thighShot: ShotEntry = {
      id: "t",
      date: "2026-06-02",
      injectionSite: "thigh",
    };
    const Removable = () => {
      const [data, setData] = useState<ShotEntry[]>([
        { id: "x", date: "2026-06-01", injectionSite: "glute" },
        thighShot,
      ]);
      const [query, setQuery] = useState<HistoryQuery>(emptyHistoryQuery);
      return (
        <>
          {/* Deletes the only "glute" shot, leaving the log non-empty — so the
              list shows "no matches", not "nothing logged". */}
          <button type="button" onClick={() => setData([thighShot])}>
            drop
          </button>
          <HistoryView
            shots={data}
            query={query}
            onQueryChange={setQuery}
            onEditShot={vi.fn()}
            onDeleteShot={vi.fn()}
          />
        </>
      );
    };
    render(<Removable />);
    openFilters();
    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "glute" } });
    expect(screen.getByText("Showing 1 of 1 shot")).toBeInTheDocument();

    // Delete lives in History, so losing the last shot using a filtered value is
    // one tap away; the select must still show it rather than rendering blank
    // while the list silently shows nothing.
    fireEvent.click(screen.getByRole("button", { name: "drop" }));
    const site = screen.getByLabelText("Site") as HTMLSelectElement;
    expect(site.value).toBe("glute");
    expect(site.selectedIndex).not.toBe(-1);
    expect(screen.getByText(/No shots match these filters/)).toBeInTheDocument();
  });

  it("renders the canonical option when a rename changes only the casing", () => {
    // Renaming "Thigh" to "thigh" in Settings is explicitly supported, and the
    // History query survives the tab trip — so the stored selection can differ
    // from the option list by casing only. The select must show the canonical
    // option rather than a value matching nothing, which would blank the control
    // while it is still filtering.
    const Recased = () => {
      const [data, setData] = useState<ShotEntry[]>([
        { id: "x", date: "2026-06-01", injectionSite: "Thigh" },
      ]);
      const [query, setQuery] = useState<HistoryQuery>(emptyHistoryQuery);
      return (
        <>
          <button
            type="button"
            onClick={() => setData([{ id: "x", date: "2026-06-01", injectionSite: "thigh" }])}
          >
            rename
          </button>
          <HistoryView
            shots={data}
            query={query}
            onQueryChange={setQuery}
            onEditShot={vi.fn()}
            onDeleteShot={vi.fn()}
          />
        </>
      );
    };
    render(<Recased />);
    openFilters();
    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "Thigh" } });
    fireEvent.click(screen.getByRole("button", { name: "rename" }));

    const sel = screen.getByLabelText("Site") as HTMLSelectElement;
    expect(sel.selectedIndex).not.toBe(-1);
    expect(sel.value).toBe("thigh");
    // Still filtering, and still only one shot matches.
    expect(screen.getByText("Showing 1 of 1 shot")).toBeInTheDocument();
  });

  it("does not offer the same value twice when only its casing differs", () => {
    // suggestionsFor keeps the most recent display form, so a casing change can
    // make the preserved selection and the fresh option look like two choices
    // that filter identically.
    const Recased = () => {
      const [data, setData] = useState<ShotEntry[]>([
        { id: "x", date: "2026-06-01", injectionSite: "Thigh" },
      ]);
      const [query, setQuery] = useState<HistoryQuery>(emptyHistoryQuery);
      return (
        <>
          <button
            type="button"
            onClick={() => setData([{ id: "y", date: "2026-06-02", injectionSite: "thigh" }])}
          >
            recase
          </button>
          <HistoryView
            shots={data}
            query={query}
            onQueryChange={setQuery}
            onEditShot={vi.fn()}
            onDeleteShot={vi.fn()}
          />
        </>
      );
    };
    render(<Recased />);
    openFilters();
    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "Thigh" } });
    fireEvent.click(screen.getByRole("button", { name: "recase" }));

    const options = [...(screen.getByLabelText("Site") as HTMLSelectElement).options]
      .map((o) => o.value)
      .filter((v) => v !== "");
    expect(options).toHaveLength(1);
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

  it("hands focus to a neighbouring row when one is deleted", () => {
    // Deleting unmounts the row holding the focused button; without a handoff
    // focus falls to <body> and a keyboard user is stranded at the top of a long
    // list.
    const Deletable = () => {
      const [data, setData] = useState<ShotEntry[]>(shots);
      const [query, setQuery] = useState<HistoryQuery>(emptyHistoryQuery);
      return (
        <HistoryView
          shots={data}
          query={query}
          onQueryChange={setQuery}
          onEditShot={vi.fn()}
          onDeleteShot={(id) => setData((cur) => cur.filter((s) => s.id !== id))}
        />
      );
    };
    render(<Deletable />);

    const rows = screen.getAllByRole("listitem");
    const middle = rows[1];
    const del = within(middle).getByRole("button", { name: "Delete" });
    del.focus();
    fireEvent.click(del);

    expect(document.body).not.toHaveFocus();
    expect(document.activeElement).toHaveClass("shot-list-item");
  });

  it("falls back to the count line when the last row is deleted", () => {
    const One = () => {
      const [data, setData] = useState<ShotEntry[]>([
        { id: "only", date: "2026-06-01", notes: "last one" },
      ]);
      const [query, setQuery] = useState<HistoryQuery>(emptyHistoryQuery);
      return (
        <HistoryView
          shots={data}
          query={query}
          onQueryChange={setQuery}
          onEditShot={vi.fn()}
          onDeleteShot={(id) => setData((cur) => cur.filter((s) => s.id !== id))}
        />
      );
    };
    render(<One />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    // No rows left to receive focus, so it lands on the status line rather than
    // <body>.
    expect(document.activeElement).toHaveClass("history__count");
  });

  it("announces the result count politely", () => {
    render(<Harness />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Showing 3 of 3 shots");
  });
});
