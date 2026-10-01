import { describe, it, expect, beforeEach } from "vitest";
import { toJson } from "../exportData";
import { parseBackup } from "../importData";
import { pickShotFields } from "../backupDto";
import type { ShotEntry } from "../../types/shot";

beforeEach(() => {
  localStorage.clear();
});

/**
 * The allowlist trap, for the two fields slice B½ adds.
 *
 * `pickShotFields` is an allowlist on BOTH the export and import paths, so a
 * field missing from it does not fail loudly — it silently does not survive a
 * backup. These two can never be regenerated either: the shot they describe is
 * in the past, and nothing will ask about it again.
 */
describe("how the site settled survives a backup", () => {
  const shots: ShotEntry[] = [
    {
      id: "a",
      date: "2026-07-01",
      afterSoreness: "several-days",
      afterLump: true,
    },
    // `false` is an answer — "no lump" — not an absence.
    { id: "b", date: "2026-07-08", afterSoreness: "none", afterLump: false },
    // Never asked: both fields absent, and they must stay absent rather than
    // coming back as "none"/"no".
    { id: "c", date: "2026-07-15" },
  ];

  it("round-trips every answer, including 'no'", () => {
    const result = parseBackup(toJson(shots));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.shots).toHaveLength(3);
    expect(result.shots[0]).toMatchObject({
      afterSoreness: "several-days",
      afterLump: true,
    });
    expect(result.shots[1]).toMatchObject({
      afterSoreness: "none",
      afterLump: false,
    });
    expect(result.shots[2]).not.toHaveProperty("afterSoreness");
    expect(result.shots[2]).not.toHaveProperty("afterLump");
  });

  it("drops a value the enum does not recognise rather than exporting it", () => {
    // Storage is deliberately lenient — `sanitizeShots` vets only a non-blank
    // id and date — so a hand-edited or legacy value reaches the DTO. Writing
    // it into the file would produce a backup this app's own importer refuses,
    // which is the worst thing this product can produce.
    const picked = pickShotFields({
      id: "x",
      date: "2026-07-01",
      afterSoreness: "ages" as ShotEntry["afterSoreness"],
      afterLump: "yes" as unknown as boolean,
    });

    expect(picked).not.toHaveProperty("afterSoreness");
    expect(picked).not.toHaveProperty("afterLump");
  });
});
