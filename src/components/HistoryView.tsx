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
import React, { useMemo, useState } from "react";
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
import { suggestionsFor } from "../utils/suggestions";
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
  const debouncedText = useDebouncedValue(query.text, SEARCH_DEBOUNCE_MS);

  // Facet options come from the user's own logged values, so the dropdowns only
  // ever offer choices that can actually match something. The currently-selected
  // value is kept in the list even when no shot uses it any more — deleting the
  // last "glute" shot (one tap away, here in History) would otherwise leave the
  // select rendering blank while still filtering, with the badge as the only
  // clue.
  const withSelected = (options: string[], selected?: string) =>
    selected && !options.includes(selected) ? [selected, ...options] : options;

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
        page: { offset: 0, limit: query.limit },
      }),
    [shots, query.filter, query.limit, debouncedText]
  );

  const activeFacets = countActiveFacets(query);
  const patch = (next: Partial<HistoryQuery>) =>
    // Any change to the query resets the page window: keeping a grown limit
    // across a new filter would silently reveal more than one page of results.
    onQueryChange({ ...query, limit: PAGE_SIZE, ...next });

  const setFilter = (next: Partial<ShotFilter>) =>
    patch({ filter: { ...query.filter, ...next } });

  const setPainBand = (id: string) =>
    onQueryChange({ ...withPainBand(query, id), limit: PAGE_SIZE });

  const clearAll = () => onQueryChange(emptyHistoryQuery);

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
            // Spelled out rather than left to the visible "Filters · 2", which
            // a screen reader would read as "Filters, 2" with no idea what the
            // number counts.
            aria-label={
              activeFacets > 0 ? `Filters, ${activeFacets} active` : "Filters"
            }
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filters
            {activeFacets > 0 && (
              <span className="filter-count"> · {activeFacets}</span>
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
      <p className="history__count" role="status" aria-live="polite">
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
        <ul className="shot-list__items">
          {page.items.map((shot) => (
            <ShotListItem
              key={shot.id}
              shot={shot}
              onEdit={onEditShot}
              onDelete={onDeleteShot}
            />
          ))}
        </ul>
      )}

      {page.hasMore && (
        <button
          type="button"
          className="secondary-button history__load-more"
          onClick={() => onQueryChange({ ...query, limit: query.limit + PAGE_SIZE })}
        >
          Load more
        </button>
      )}
    </section>
  );
};
