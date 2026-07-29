// src/components/HistoryView.tsx
// The full shot list: text search, structured filters, and a "Load more" page
// control — all composed through the slice-A selector layer (queryShots), never
// by touching the raw array. This screen owns no data; it owns a *query*.
//
// Layout follows the mobile-filtering convention: the search field stays visible
// (it's the cheapest way to narrow a list), while the structured facets collapse
// behind a "Filters · N" toggle whose badge counts active facets, so a filter can
// never be silently on while the list looks short for no reason.
//
// Pagination (not infinite scroll or windowing) is deliberate: it's keyboard- and
// screen-reader-friendly, and right-sized for the hundreds-to-low-thousands of
// entries a shot log realistically reaches. Virtualization can drop in later if
// measurement ever demands it.
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ShotEntry } from "../types/shot";
import type { ShotFilter } from "../utils/shotQuery";
import { queryShots } from "../utils/shotQuery";
import {
  PAGE_SIZE,
  PAIN_BANDS,
  countActiveFacets,
  emptyHistoryQuery,
  withPainBand,
  type HistoryQuery,
} from "../utils/historyQuery";
import { toCivilDate } from "../utils/civilDate";
import { suggestionsFor, normalizeValue } from "../utils/suggestions";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { ShotListItem } from "./ShotListItem";

/** Pause in typing before the search re-runs. Short — the work is in-memory. */
const SEARCH_DEBOUNCE_MS = 200;

interface HistoryViewProps {
  shots: ShotEntry[];
  query: HistoryQuery;
  onQueryChange: (next: HistoryQuery) => void;
  onEditShot: (shot: ShotEntry) => void;
  onDeleteShot: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  shots,
  query,
  onQueryChange,
  onEditShot,
  onDeleteShot,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Local, not lifted: see HistoryQuery. Owning it here is also what makes the
  // render-time reset below legal — React allows a component to adjust its OWN
  // state during render, but updating a parent's from render is an error.
  const [limit, setLimit] = useState(PAGE_SIZE);
  const debouncedText = useDebouncedValue(query.text, SEARCH_DEBOUNCE_MS);
  const listRef = useRef<HTMLUListElement>(null);
  const countRef = useRef<HTMLParagraphElement>(null);
  /** Index of the first row revealed by the last "Load more"; null when the
   *  render wasn't caused by one. */
  const revealFrom = useRef<number | null>(null);

  // Move focus to the first newly revealed row after "Load more" — the button
  // itself may have just unmounted, and focus must not fall to <body>.
  useEffect(() => {
    const from = revealFrom.current;
    revealFrom.current = null;
    if (from === null) return;
    const rows = listRef.current?.querySelectorAll<HTMLElement>("li");
    rows?.[from]?.focus();
  });

  // Facet options come from the user's own logged values, so the dropdowns only
  // ever offer choices that can actually match something. The currently-selected
  // value is kept in the list even when no shot uses it any more — deleting the
  // last "glute" shot (one tap away, here in History) would otherwise leave the
  // select rendering blank while still filtering, with the badge as the only
  // clue.
  // Compared with normalizeValue, matching how filterShots itself matches: an
  // exact comparison would list "Thigh" and "thigh" as two options that filter
  // identically, once a later shot changes the casing suggestionsFor reports.
  const withSelected = (options: string[], selected?: string) =>
    selected &&
    !options.some((o) => normalizeValue(o) === normalizeValue(selected))
      ? [selected, ...options]
      : options;

  const siteOptions = useMemo(
    () => withSelected(suggestionsFor(shots, "injectionSite"), query.filter.site),
    [shots, query.filter.site]
  );
  const positionOptions = useMemo(
    () =>
      withSelected(
        suggestionsFor(shots, "injectionSitePosition"),
        query.filter.position
      ),
    [shots, query.filter.position]
  );
  const esterOptions = useMemo(
    () =>
      withSelected(suggestionsFor(shots, "testosteroneEster"), query.filter.ester),
    [shots, query.filter.ester]
  );

  const page = useMemo(
    () =>
      queryShots(shots, {
        filter: query.filter,
        text: debouncedText,
        sort: "newest",
        page: { offset: 0, limit },
      }),
    [shots, query.filter, limit, debouncedText]
  );

  // Typing must not reset the page window on every keystroke: the list is still
  // showing results for the *old* search until the debounce settles, so an
  // immediate reset collapses 60 visible rows to 20 of the previous results,
  // jumping the page under the user's finger and announcing a stale count. Reset
  // when the settled text actually changes instead. (Adjusted during render —
  // React's pattern for state that follows changing data.)
  const [lastSearched, setLastSearched] = useState(debouncedText);
  if (lastSearched !== debouncedText) {
    setLastSearched(debouncedText);
    setLimit(PAGE_SIZE);
  }

  const activeFacets = countActiveFacets(query);
  const patch = (next: Partial<HistoryQuery>) => {
    // A facet change applies immediately, so its page window resets immediately
    // too — keeping a grown window would reveal several pages of the new result
    // set at once. Text is excluded: see the debounce note above.
    if (next.text === undefined) setLimit(PAGE_SIZE);
    onQueryChange({ ...query, ...next });
  };

  const setFilter = (next: Partial<ShotFilter>) =>
    patch({ filter: { ...query.filter, ...next } });

  const setPainBand = (id: string) => {
    setLimit(PAGE_SIZE);
    onQueryChange(withPainBand(query, id));
  };

  const clearAll = () => {
    setLimit(PAGE_SIZE);
    onQueryChange(emptyHistoryQuery);
  };

  // Deleting unmounts the row holding the focused button, which would drop focus
  // to <body> and strand a keyboard or screen-reader user at the top of a long
  // list. Hand focus to the neighbouring row (or the count line, when the list
  // empties) — the same care the sheet and "Load more" already take.
  const handleDelete = (id: string) => {
    const index = page.items.findIndex((s) => s.id === id);
    const rows = listRef.current?.querySelectorAll<HTMLElement>("li");
    const neighbour = rows?.[index + 1] ?? rows?.[index - 1] ?? null;
    onDeleteShot(id);
    (neighbour ?? countRef.current)?.focus();
  };

  return (
    <section className="history">
      <div className="history__controls">
        <label className="history__search">
          <span className="visually-hidden">Search notes and mood</span>
          <input
            type="search"
            value={query.text}
            placeholder="Search notes &amp; mood"
            onChange={(e) => patch({ text: e.target.value })}
          />
        </label>

        <div className="history__filter-bar">
          <button
            type="button"
            className="secondary-button"
            aria-expanded={filtersOpen}
            aria-controls="history-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            {/* The accessible name keeps the visible word "Filters" first and
                appends the meaning of the badge, rather than replacing the label
                with an aria-label — a voice-control user saying what they see
                must still match (WCAG 2.5.3 Label in Name). */}
            Filters
            {activeFacets > 0 && (
              <>
                <span className="filter-count" aria-hidden="true">
                  {" "}
                  · {activeFacets}
                </span>
                <span className="visually-hidden">, {activeFacets} active</span>
              </>
            )}
          </button>
          {(activeFacets > 0 || query.text !== "") && (
            <button type="button" className="link-button" onClick={clearAll}>
              Clear
            </button>
          )}
        </div>

        {/* Always rendered, toggled with `hidden`, so the aria-controls above
            never points at a missing element while collapsed. */}
        <div className="history__filters" id="history-filters" hidden={!filtersOpen}>
            <div className="form-row">
              <label>
                From
                <input
                  type="date"
                  value={query.filter.dateFrom ?? ""}
                  onChange={(e) =>
                    // Brand at the boundary: an incomplete or impossible date
                    // becomes "no constraint" rather than a bad bound.
                    setFilter({ dateFrom: toCivilDate(e.target.value) ?? undefined })
                  }
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={query.filter.dateTo ?? ""}
                  onChange={(e) =>
                    setFilter({ dateTo: toCivilDate(e.target.value) ?? undefined })
                  }
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                Site
                <select
                  value={query.filter.site ?? ""}
                  onChange={(e) => setFilter({ site: e.target.value })}
                >
                  <option value="">Any</option>
                  {siteOptions.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Position
                <select
                  value={query.filter.position ?? ""}
                  onChange={(e) => setFilter({ position: e.target.value })}
                >
                  <option value="">Any</option>
                  {positionOptions.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                Type of T
                <select
                  value={query.filter.ester ?? ""}
                  onChange={(e) => setFilter({ ester: e.target.value })}
                >
                  <option value="">Any</option>
                  {esterOptions.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Pain
                <select
                  value={query.painBand}
                  onChange={(e) => setPainBand(e.target.value)}
                >
                  <option value="">Any</option>
                  {PAIN_BANDS.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
              </label>
            </div>
        </div>
      </div>

      {/* Announced politely so a screen reader hears the list shrink as filters
          and search change, without interrupting typing. */}
      <p
        className="history__count"
        role="status"
        aria-live="polite"
        ref={countRef}
        tabIndex={-1}
      >
        {/* An empty log is not the same as a filtered-to-nothing list —
            announcing "no matching shots" on first run implies a filter is on
            when none is. Matches the empty state below. */}
        {shots.length === 0
          ? "No shots logged yet"
          : page.total === 0
            ? "No matching shots"
            : `Showing ${page.items.length} of ${page.total} shot${page.total === 1 ? "" : "s"}`}
      </p>

      {page.total === 0 ? (
        <p className="empty-state">
          {shots.length === 0
            ? "No shots logged yet. Your data stays on this device."
            : "No shots match these filters. Try clearing one."}
        </p>
      ) : (
        <ul className="shot-list__items" ref={listRef}>
          {page.items.map((shot) => (
            <ShotListItem
              key={shot.id}
              shot={shot}
              onEdit={onEditShot}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}

      {page.hasMore && (
        <button
          type="button"
          className="secondary-button history__load-more"
          onClick={() => {
            // On the final press this button unmounts itself, which would drop
            // focus to <body> and dump a keyboard or screen-reader user at the
            // top of the document mid-task. Send focus to the first newly
            // revealed row instead — the content they asked for.
            revealFrom.current = page.items.length;
            setLimit((current) => current + PAGE_SIZE);
          }}
        >
          Load more
        </button>
      )}
    </section>
  );
};
