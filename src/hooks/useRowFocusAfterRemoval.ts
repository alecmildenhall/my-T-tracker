// src/hooks/useRowFocusAfterRemoval.ts
// Where focus goes when the row holding it stops existing.
//
// Owned once, for the same reason the delete confirm is (`useDeleteShotConfirm`):
// History and the Home teaser show the same rows, offer the same Delete behind
// the same dialog, and had two different answers to what happens afterwards.
// History aimed at the row that took the deleted one's place; the teaser, which
// gained Delete later, passed no `onDeleted` at all and dropped focus onto the
// whole <section> — so a screen reader announced the entire panel instead of the
// row now under your finger, for the same act, one tab away.
//
// Deferred to an effect rather than run inline, because the triggers destroy the
// element that had focus: a confirmed delete unmounts the row AND the dialog,
// whose own focus-restore would otherwise run last and win. Effects run after
// the removed children's cleanup, so this is the final word.
import { useEffect, useRef } from "react";
import type React from "react";
import { handOffFocus } from "../utils/focus";

export function useRowFocusAfterRemoval(
  listRef: React.RefObject<HTMLElement | null>,
  /** Where to land when the list has no row left to take — the count line in
   *  History, the section on Home. */
  fallbackRef: React.RefObject<HTMLElement | null>
): {
  /** Aim at a row index; the next render hands focus there. */
  aimAt: (index: number) => void;
} {
  /** Row index to focus once the next render lands. null when the render was
   *  not caused by a removal (or by "Load more", which aims at the first newly
   *  revealed row). */
  const focusRowAt = useRef<number | null>(null);

  useEffect(() => {
    const at = focusRowAt.current;
    focusRowAt.current = null;
    if (at === null) return;
    const rows = listRef.current?.querySelectorAll<HTMLElement>("li");
    // Deleting the last row leaves nothing at that index; fall back to the
    // previous row, then to the fallback, rather than dropping to <body>.
    handOffFocus(rows?.[at], rows?.[at - 1], fallbackRef);
  });

  return {
    aimAt: (index: number) => {
      // A `findIndex` miss returns -1, and passing that through would make it a
      // SECOND value meaning "no aim" alongside null — the overloading rule this
      // codebase pays for most. It is reachable: `deleteShot` is a filter, so it
      // reports success for an id that was already gone (another tab deleting
      // the same shot, or a backup import landing, while the confirm is open),
      // and the caller's findIndex then misses. `rows?.[-1]` is undefined so the
      // old behaviour was survivable rather than wrong — focus fell to the
      // fallback — but "survivable" is how the sentinel bugs here always start.
      if (index < 0) return;
      focusRowAt.current = index;
    },
  };
}
