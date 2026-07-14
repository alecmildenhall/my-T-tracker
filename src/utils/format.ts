// src/utils/format.ts
// Small display-formatting helpers shared across UI panels.

/** "1 entry" / "N entries" — singular vs plural label for a shot count. */
export function pluralizeEntries(n: number): string {
  return n === 1 ? "1 entry" : `${n} entries`;
}
