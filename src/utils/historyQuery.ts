// src/utils/historyQuery.ts
// The History screen's *query state* — what the user is currently asking for —
// kept separate from the component that renders it so it stays pure and
// unit-testable (and so the view file exports only components).
//
// This is the UI-facing companion to shotQuery.ts: that module answers a query,
// this one describes the one the screen is holding.
import type { ShotFilter } from "./shotQuery";
import { PAIN_LEVELS, isPainLevel, type PainLevel } from "../types/shot";
import { painLabel } from "./painLabel";

/** How many shots each "Load more" press reveals. */
export const PAGE_SIZE = 20;

/**
 * The pain levels offered as filter options.
 *
 * This list used to carry `min`/`max` and bucket a 0–10 score, written that way
 * in anticipation of the chips — which is why the filter vocabulary did not have
 * to change when the input did. Now that pain IS the ordinal, the numbers are
 * gone and the parenthesised ranges with them: "Mild (1–3)" describes a scale
 * nothing stores any more.
 */
export const PAIN_BANDS: { id: PainLevel; label: string }[] = PAIN_LEVELS.map(
  (id) => ({ id, label: painLabel(id) }),
);

/**
 * Everything the History screen is currently asking for. Lifted to App so a trip
 * to Home and back keeps the filter you were using; deliberately **not**
 * persisted to storage, so a fresh launch never opens into a stale filtered view
 * (predictable, and it never leaves a revealing filter on screen).
 *
 * `painBand` mirrors `filter.pain` so the <select> has a value to render. That
 * used to earn its keep: pain was a derived `painMin`/`painMax` pair, and the
 * bounds alone could not distinguish "no band" from a band spanning the same
 * range. With an ordinal they carry exactly the same fact, kept in step only by
 * `withPainBand` being the sole writer — two carriers for one meaning, which is
 * the shape this codebase's style guide opens by warning about. Benign while
 * nothing else writes pain into the filter; the select could read
 * `filter.pain ?? ""` directly and retire the field. Left as one change at a
 * time, and written down so the next person does not have to re-derive that it
 * is redundant rather than load-bearing.
 *
 * The page window is deliberately NOT here: it's local to the History screen.
 * Only *what you asked for* is worth carrying across a trip to Home, and keeping
 * it local lets the screen reset its own window during render when the settled
 * search changes — React only permits that for a component's own state.
 */
export interface HistoryQuery {
  text: string;
  filter: ShotFilter;
  painBand: string;
}

export const emptyHistoryQuery: HistoryQuery = {
  text: "",
  filter: {},
  painBand: "",
};

/**
 * How many facets are actively narrowing the list — the badge on the Filters
 * toggle. Filters collapse out of sight, so this count is what keeps a narrowed
 * list from looking like an inexplicably short one.
 */
export function countActiveFacets(query: HistoryQuery): number {
  const f = query.filter;
  return [
    f.dateFrom,
    f.dateTo,
    f.site,
    f.position,
    f.ester,
    query.painBand,
  ].filter((v) => v !== undefined && v !== "").length;
}

/** The query with a pain level applied (or cleared, for the "Any" option).
 *
 *  `id` is whatever the <select> produced, so it is validated rather than cast:
 *  "Any" is the empty string, and anything unrecognised clears the facet rather
 *  than filtering on a level that does not exist. */
export function withPainBand(query: HistoryQuery, id: string): HistoryQuery {
  const level = isPainLevel(id) ? id : undefined;
  return {
    ...query,
    painBand: level ?? "",
    filter: { ...query.filter, pain: level },
  };
}
