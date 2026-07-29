// src/utils/shotQuery.ts
// Slice A of the History & Charts epic: the client-side data-access / selector
// layer. This is the app's "internal API" over the shot list — screens consume
// these pure selectors, never a raw array or storage directly. It is NOT a
// network backend (the no-network privacy model is untouched); it's the
// ports/adapters seam that keeps a future opt-in encrypted sync a store swap
// rather than a screen rewrite.
//
// Three distinct operations, deliberately named so each says what it reads:
//   - filterShots    — structured, field-scoped constraints (date range, site,
//                       position, pain band, ester). Faceted matching: a shot
//                       either satisfies a facet or it doesn't.
//   - searchShotText  — fuzzy free-text over the human-written fields (notes,
//                       mood). One string, substring match, case-insensitive.
//   - queryShots      — the composition: filter → search → sort → paginate,
//                       returning a result envelope ({ items, total, hasMore }).
//
// You *filter* by fields, *search* by text, and a *query* wraps both. Each
// function is pure (no storage, no dates-from-now) so the whole layer is unit-
// testable; `today`-style ambient state never leaks in here.
import type { ShotEntry } from "../types/shot";
import type { CivilDate } from "./civilDate";
import { normalizeValue } from "./suggestions";
import { isBlank } from "./strings";
import { compareShotsChrono } from "./sortShots";

/** Newest-first (the History/Home default) or oldest-first (clinical log order). */
export type SortOrder = "newest" | "oldest";

/**
 * Structured, field-scoped constraints — facets ONLY, never free text. Every
 * field is optional; an omitted field is "no constraint on this facet". A shot
 * must satisfy *all* present constraints (AND across facets). Free-text search
 * deliberately does NOT live here — it's `searchShotText`, composed at the
 * `ShotQuery` level — so there is exactly one home for text matching.
 */
export interface ShotFilter {
  /** Inclusive lower date bound (YYYY-MM-DD). Compared lexically — valid for
   *  civil dates. A `CivilDate` so callers parse untrusted input at the boundary. */
  dateFrom?: CivilDate;
  /** Inclusive upper date bound (YYYY-MM-DD). */
  dateTo?: CivilDate;
  /** Injection site, matched case-insensitively (exact, trimmed). */
  site?: string;
  /** Injection position, matched case-insensitively (exact, trimmed). */
  position?: string;
  /** Testosterone ester, matched case-insensitively (exact, trimmed). */
  ester?: string;
  /** Inclusive minimum pain score. A shot with no painScore never matches a pain bound. */
  painMin?: number;
  /** Inclusive maximum pain score. */
  painMax?: number;
}

/**
 * A whole request over the shot list: the structured `filter`, the free-text
 * `text`, ordering, and a page window. All optional — an empty query returns
 * every shot, newest-first, unpaginated.
 */
export interface ShotQuery {
  filter?: ShotFilter;
  /** Free-text search over notes + mood (see searchShotText). */
  text?: string;
  /** Result ordering; defaults to "newest". */
  sort?: SortOrder;
  /** Page window into the matched+sorted results. Omit for all matches. */
  page?: { offset: number; limit: number };
}

/** The result envelope from `queryShots`: the page of items plus the counts a
 *  "Load more" control needs. `total` is the match count BEFORE pagination. */
export interface ShotPage {
  items: ShotEntry[];
  /** How many shots matched filter+search, before the page window was applied. */
  total: number;
  /** Whether shots remain past the current page window. */
  hasMore: boolean;
}

/** True when `field` is present and equals `value` case-insensitively (trimmed).
 *  A missing field never matches a set facet — filtering by site excludes shots
 *  with no site, as faceted filtering should. */
function fieldMatches(field: string | undefined, value: string): boolean {
  return field !== undefined && normalizeValue(field) === normalizeValue(value);
}

/**
 * Keep the shots that satisfy every present facet in `filter`. Pure predicate
 * matching on structured fields — no text search, no sorting, no pagination.
 * An empty (or absent) filter returns every shot.
 *
 * A blank facet value (undefined, "", or whitespace) means "no constraint",
 * mirroring `searchShotText("")`. This matters because a filter UI conventionally
 * binds its "Any" option to "" — treating "" as a real constraint would compare
 * `shot.date > ""` (true for all) and silently return an empty list. String
 * facets go through `isBlank`; the numeric pain bounds only skip on `undefined`
 * (a real 0 bound is meaningful).
 */
export function filterShots(
  shots: ShotEntry[],
  filter: ShotFilter = {}
): ShotEntry[] {
  return shots.filter((shot) => {
    if (!isBlank(filter.dateFrom) && shot.date < filter.dateFrom!) return false;
    if (!isBlank(filter.dateTo) && shot.date > filter.dateTo!) return false;
    if (!isBlank(filter.site) && !fieldMatches(shot.injectionSite, filter.site!))
      return false;
    if (
      !isBlank(filter.position) &&
      !fieldMatches(shot.injectionSitePosition, filter.position!)
    )
      return false;
    if (
      !isBlank(filter.ester) &&
      !fieldMatches(shot.testosteroneEster, filter.ester!)
    )
      return false;
    // Number.isFinite, not `!== undefined`: a filter UI binding painMin to
    // Number(input) yields NaN on a blank/unparsable field, and `painScore < NaN`
    // is always false — so a NaN bound would silently pass every shot rather than
    // disable the facet. Treat a non-finite bound as "no constraint", same as a
    // blank string facet above.
    if (Number.isFinite(filter.painMin)) {
      if (shot.painScore === undefined || shot.painScore < filter.painMin!)
        return false;
    }
    if (Number.isFinite(filter.painMax)) {
      if (shot.painScore === undefined || shot.painScore > filter.painMax!)
        return false;
    }
    return true;
  });
}

/**
 * Keep the shots whose free-text fields (notes, mood) contain `text` as a
 * case-insensitive substring. A blank or whitespace-only query is a no-op that
 * returns every shot. This is the ONLY place free text is matched — structured
 * facets belong to `filterShots`.
 */
export function searchShotText(shots: ShotEntry[], text: string): ShotEntry[] {
  const needle = normalizeValue(text);
  if (needle === "") return shots;
  return shots.filter(
    (shot) =>
      normalizeValue(shot.notes ?? "").includes(needle) ||
      normalizeValue(shot.mood ?? "").includes(needle)
  );
}

/** A sorted copy of `shots` (never mutates the input). "newest" negates the
 *  ascending chronological comparator; "oldest" uses it directly (the order the
 *  export uses for a clinical log). */
export function sortShots(
  shots: ShotEntry[],
  order: SortOrder = "newest"
): ShotEntry[] {
  const sign = order === "newest" ? -1 : 1;
  return [...shots].sort((a, b) => sign * compareShotsChrono(a, b));
}

/**
 * The most recent `n` shots, newest-first — the Home teaser's source. `n <= 0`
 * yields an empty list; asking for more than exist simply returns all of them.
 */
export function takeRecent(shots: ShotEntry[], n: number): ShotEntry[] {
  if (n <= 0) return [];
  return sortShots(shots, "newest").slice(0, n);
}

/**
 * Slice a page window out of an already-ordered list, returning the envelope a
 * "Load more" control needs. `total` is the length of `shots` (the full matched
 * set), so callers pass the post-filter/post-search list here. A negative offset
 * clamps to 0. A non-positive limit yields no items AND `hasMore: false` — a
 * zero-width window makes no progress, so reporting "more remain" would strand a
 * "Load more" that advances by `limit`.
 */
export function paginate(
  shots: ShotEntry[],
  page?: { offset: number; limit: number }
): ShotPage {
  const total = shots.length;
  // Copy on the no-page path too, so every selector uniformly returns a fresh
  // array — a consumer that sorts/splices page.items in place never mutates the
  // caller's source list.
  if (!page) return { items: [...shots], total, hasMore: false };
  const offset = Math.max(0, page.offset);
  const limit = Math.max(0, page.limit);
  const items = shots.slice(offset, offset + limit);
  return { items, total, hasMore: limit > 0 && offset + limit < total };
}

/**
 * The composing selector: apply the structured `filter`, then free-text `text`,
 * then order, then take the requested page. Screens call this one — it's the
 * single entry point that guarantees the pipeline order (a filter narrows before
 * search, `total` counts the full match set, pagination comes last).
 */
export function queryShots(shots: ShotEntry[], query: ShotQuery = {}): ShotPage {
  const filtered = filterShots(shots, query.filter);
  const searched =
    query.text !== undefined ? searchShotText(filtered, query.text) : filtered;
  const ordered = sortShots(searched, query.sort);
  return paginate(ordered, query.page);
}
