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
import { Modal } from "./Modal";

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
  // INTERIM — slice C replaces this with an undo snackbar (undo-over-confirm is
  // the end state the roadmap chose). Until then Delete sits beside Edit on every
  // row of a dense phone list, there is no undo, and there is no server copy, so
  // one mis-tap permanently loses a logged entry. A confirm is throwaway work and
  // worth it against that.
  const [pendingDelete, setPendingDelete] = useState<ShotEntry | null>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const filtersToggleRef = useRef<HTMLButtonElement>(null);
  // Local, not lifted: see HistoryQuery. Owning it here is also what makes the
  // render-time reset below legal — React allows a component to adjust its OWN
  // state during render, but updating a parent's from render is an error.
  const [limit, setLimit] = useState(PAGE_SIZE);
  const debouncedText = useDebouncedValue(query.text, SEARCH_DEBOUNCE_MS);
  const listRef = useRef<HTMLUListElement>(null);
  const countRef = useRef<HTMLParagraphElement>(null);
  /** Row index to focus once the next render lands — set by "Load more" (the
   *  first newly revealed row) and by a delete (the row that takes its place).
   *  null when the render wasn't caused by either. */
  const focusRowAt = useRef<number | null>(null);

  // Deferred to an effect rather than done inline, because both triggers destroy
  // the element that had focus: "Load more" unmounts its own button on the last
  // page, and a confirmed delete unmounts the row AND the dialog — whose own
  // focus-restore would otherwise run last and win. Effects run after the removed
  // children's cleanup, so this is the final word.
  useEffect(() => {
    const at = focusRowAt.current;
    focusRowAt.current = null;
    if (at === null) return;
    const rows = listRef.current?.querySelectorAll<HTMLElement>("li");
    // Deleting the last row leaves nothing at that index; fall back to the
    // previous row, then to the count line, rather than dropping to <body>.
    (rows?.[at] ?? rows?.[at - 1] ?? countRef.current)?.focus();
  });

  // Facet options come from the user's own logged values, so the dropdowns only
  // ever offer choices that can actually match something. The currently-selected
  // value is kept in the list even when no shot uses it any more — deleting the
  // last "glute" shot (one tap away, here in History) would otherwise leave the
  // select rendering blank while still filtering, with the badge as the only
  // clue.
  // Returns the options AND the value to render, because the two can disagree.
  // Matching is case-insensitive (as filterShots matches), so when the stored
  // selection differs only in casing from the option list — renaming "Thigh" to
  // "thigh" in Settings does exactly that, and the query survives the tab trip —
  // the select must render the *canonical* option, or its value matches nothing
  // and the control goes blank while still filtering. When the value is gone from
  // the list entirely, it is prepended so it stays visible.
  const facet = (
    options: string[],
    selected?: string
  ): { options: string[]; value: string } => {
    if (!selected) return { options, value: "" };
    const canonical = options.find(
      (o) => normalizeValue(o) === normalizeValue(selected)
    );
    return canonical
      ? { options, value: canonical }
      : { options: [selected, ...options], value: selected };
  };

  // Sorted alphabetically, NOT by suggestionsFor's most-recently-used order.
  // Recency is right for the log form's reuse chips — the value you want next is
  // usually the one you used last — but a filter list is scanned and returned to,
  // so it has to sit still. Under recency ordering the options reshuffle every
  // time a shot is logged with a different value, and "the second one down" is a
  // different facet on the next visit.
  const stable = (values: string[]) =>
    [...values].sort((a, b) => a.localeCompare(b));

  const site = useMemo(
    () => facet(stable(suggestionsFor(shots, "injectionSite")), query.filter.site),
    [shots, query.filter.site]
  );
  const position = useMemo(
    () =>
      facet(
        stable(suggestionsFor(shots, "injectionSitePosition")),
        query.filter.position
      ),
    [shots, query.filter.position]
  );
  const ester = useMemo(
    () =>
      facet(stable(suggestionsFor(shots, "testosteroneEster")), query.filter.ester),
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
    // "Clear all" is the last thing it does before removing itself — with nothing
    // left to clear the button unmounts, and focus would fall to <body>, sending
    // the next Tab back to the top of the document. Hand focus to the Filters
    // toggle beside it: it always survives, it is the control that owns what was
    // just cleared, and its badge vanishing is the confirmation a screen-reader
    // user needs. Same care as the delete and "Load more" hand-offs above; no
    // deferral needed, since this button is removed by its own click rather than
    // by a dialog closing on top of it.
    filtersToggleRef.current?.focus();
  };

  // Deleting unmounts the row holding the focused button, which would drop focus
  // to <body> and strand a keyboard or screen-reader user at the top of a long
  // list. Hand focus to the neighbouring row (or the count line, when the list
  // empties) — the same care the sheet and "Load more" already take.
  const handleDelete = (id: string) => {
    // After removal, this index holds what was the next row down.
    focusRowAt.current = page.items.findIndex((s) => s.id === id);
    setPendingDelete(null);
    onDeleteShot(id);
  };

  return (
    // tabIndex -1 so this can actually receive focus when the delete confirm
    // falls back to it (its row having vanished underneath). Without it,
    // `section.focus()` is a silent no-op and focus lands on <body> — the same
    // trap the row and heading targets avoid by carrying tabIndex themselves.
    <section className="history" ref={sectionRef} tabIndex={-1}>
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
            ref={filtersToggleRef}
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
          {/* "Clear all", not "Clear": the search field already has a native ✕
              that clears only the text, so an ambiguous label would read as a
              second control for the same job. Two affordances with distinct
              scopes — clear the query, clear everything — is the standard
              faceted-search arrangement; what matters is that the wider one says
              so. */}
          {(activeFacets > 0 || query.text !== "") && (
            <button type="button" className="link-button" onClick={clearAll}>
              Clear all
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
                  value={site.value}
                  onChange={(e) => setFilter({ site: e.target.value })}
                >
                  <option value="">Any</option>
                  {site.options.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Position
                <select
                  value={position.value}
                  onChange={(e) => setFilter({ position: e.target.value })}
                >
                  <option value="">Any</option>
                  {position.options.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                Type of T
                <select
                  value={ester.value}
                  onChange={(e) => setFilter({ ester: e.target.value })}
                >
                  <option value="">Any</option>
                  {ester.options.map((v) => (
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
              onDelete={(id) =>
                setPendingDelete(page.items.find((s) => s.id === id) ?? null)
              }
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
            focusRowAt.current = page.items.length;
            setLimit((current) => current + PAGE_SIZE);
          }}
        >
          Load more
        </button>
      )}

      {pendingDelete && (
        <Modal
          labelledBy="delete-shot-title"
          onClose={() => setPendingDelete(null)}
          initialFocusRef={cancelDeleteRef}
          fallbackFocusRef={sectionRef}
        >
          <h3 id="delete-shot-title">Delete this shot?</h3>
          <p className="dialog-text">
            The entry from <b>{pendingDelete.date}</b> will be removed from this
            device. There is no undo, and no copy anywhere else.
          </p>
          <div className="dialog-actions">
            <button
              ref={cancelDeleteRef}
              type="button"
              className="secondary-button"
              onClick={() => setPendingDelete(null)}
            >
              Keep it
            </button>
            <button
              type="button"
              className="dialog-danger"
              onClick={() => handleDelete(pendingDelete.id)}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
};
