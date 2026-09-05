// src/utils/historyQuery.ts
// The History screen's *query state* — what the user is currently asking for —
// kept separate from the component that renders it so it stays pure and
// unit-testable (and so the view file exports only components).
//
// This is the UI-facing companion to shotQuery.ts: that module answers a query,
// this one describes the one the screen is holding.
import type { ShotFilter } from "./shotQuery";
import {
  OFF_DAYS_PATTERNS,
  PAIN_LEVELS,
  isOffDaysPattern,
  isPainLevel,
  type OffDaysPattern,
  type PainLevel,
} from "../types/shot";
import { painLabel } from "./painLabel";
import { offDaysLabel } from "./offDaysLabel";

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

/** The off-days facet's options, derived the same way and for the same reason:
 *  one source for the vocabulary, so the filter can never drift from the chips
 *  in the log sheet. */
export const OFF_DAYS_BANDS: { id: OffDaysPattern; label: string }[] =
  OFF_DAYS_PATTERNS.map((id) => ({ id, label: offDaysLabel(id) }));

/**
 * Everything the History screen is currently asking for. Lifted to App so a trip
 * to Home and back keeps the filter you were using; deliberately **not**
 * persisted to storage, so a fresh launch never opens into a stale filtered view
 * (predictable, and it never leaves a revealing filter on screen).
 *
 * There is no `painBand` beside `filter.pain`, and there used to be. It earned
 * its keep while pain was a derived `painMin`/`painMax` pair, because the bounds
 * alone could not tell "no band" from a band spanning the same range. An ordinal
 * carries that fact by itself, so the mirror became two carriers for one
 * meaning — the shape the style guide opens by warning about — kept in step only
 * by `withPainBand` happening to be the sole writer. It was left in place for a
 * while as "benign while nothing else writes pain into the filter", which is a
 * list of reasons it cannot break, and the guide is explicit that such a list is
 * never complete. The <select> reads `filter.pain ?? ""`.
 *
 * The page window is deliberately NOT here: it's local to the History screen.
 * Only *what you asked for* is worth carrying across a trip to Home, and keeping
 * it local lets the screen reset its own window during render when the settled
 * search changes — React only permits that for a component's own state.
 */
export interface HistoryQuery {
  text: string;
  filter: ShotFilter;
}

export const emptyHistoryQuery: HistoryQuery = {
  text: "",
  filter: {},
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
    f.pain,
    f.offDays,
  ].filter((v) => v !== undefined && v !== "").length;
}

/** The query with a pain level applied (or cleared, for the "Any" option).
 *
 *  `id` is whatever the <select> produced, so it is validated rather than cast:
 *  "Any" is the empty string, and anything unrecognised clears the facet rather
 *  than filtering on a level that does not exist. */
export function withPainBand(query: HistoryQuery, id: string): HistoryQuery {
  const level = isPainLevel(id) ? id : undefined;
  return { ...query, filter: { ...query.filter, pain: level } };
}

/** The query with an off-days pattern applied (or cleared, for "Any").
 *
 *  Validated rather than cast, exactly as `withPainBand` is: `id` is whatever
 *  the <select> produced, so anything unrecognised clears the facet instead of
 *  filtering on a value that does not exist. */
export function withOffDaysBand(
  query: HistoryQuery,
  id: string,
): HistoryQuery {
  const pattern = isOffDaysPattern(id) ? id : undefined;
  return { ...query, filter: { ...query.filter, offDays: pattern } };
}
