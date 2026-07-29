// src/utils/historyQuery.ts
// The History screen's *query state* — what the user is currently asking for —
// kept separate from the component that renders it so it stays pure and
// unit-testable (and so the view file exports only components).
//
// This is the UI-facing companion to shotQuery.ts: that module answers a query,
// this one describes the one the screen is holding.
import type { ShotFilter } from "./shotQuery";

/** How many shots each "Load more" press reveals. */
export const PAGE_SIZE = 20;

/**
 * Pain expressed as bands rather than a 0–10 numeric range. This is how symptom
 * trackers let people filter intensity, and it lines up with the None/Mild/
 * Moderate/Severe chips the log form adopts in the next slice — so the filter
 * vocabulary won't change under users when the input does.
 */
export const PAIN_BANDS: {
  id: string;
  label: string;
  min: number;
  max: number;
}[] = [
  { id: "none", label: "None (0)", min: 0, max: 0 },
  { id: "mild", label: "Mild (1–3)", min: 1, max: 3 },
  { id: "moderate", label: "Moderate (4–6)", min: 4, max: 6 },
  { id: "severe", label: "Severe (7–10)", min: 7, max: 10 },
];

/**
 * Everything the History screen is currently asking for. Lifted to App so a trip
 * to Home and back keeps the filter you were using; deliberately **not**
 * persisted to storage, so a fresh launch never opens into a stale filtered view
 * (predictable, and it never leaves a revealing filter on screen).
 *
 * `painBand` is kept alongside the derived `filter.painMin`/`painMax` because the
 * select needs to remember which band is chosen — the numeric bounds alone can't
 * distinguish "no band" from a band that happens to span the same range.
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
  return [f.dateFrom, f.dateTo, f.site, f.position, f.ester, query.painBand].filter(
    (v) => v !== undefined && v !== ""
  ).length;
}

/** The query with a pain band applied (or cleared, for the "Any" option). */
export function withPainBand(query: HistoryQuery, id: string): HistoryQuery {
  const band = PAIN_BANDS.find((b) => b.id === id);
  return {
    ...query,
    painBand: id,
    filter: { ...query.filter, painMin: band?.min, painMax: band?.max },
  };
}
