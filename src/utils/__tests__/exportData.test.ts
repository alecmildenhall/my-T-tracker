import { describe, it, expect } from "vitest";
import { buildBackup, toJson, toCsv, escapeCsvCell } from "../exportData";
import { APP_NAME, APP_VERSION, FORMAT_VERSION } from "../../appMeta";
import type { ShotEntry } from "../../types/shot";

let counter = 0;
const shot = (over: Partial<ShotEntry>): ShotEntry => ({
  id: `shot-${counter++}`,
  date: "2026-07-12",
  ...over,
});

describe("buildBackup", () => {
  it("wraps shots in a versioned envelope with app metadata", () => {
    const backup = buildBackup([shot({ doseMg: 50 })]);
    expect(backup.app).toBe(APP_NAME);
    expect(backup.formatVersion).toBe(FORMAT_VERSION);
    expect(backup.appVersion).toBe(APP_VERSION);
    expect(typeof backup.exportedAt).toBe("string");
    expect(backup.shots).toHaveLength(1);
  });

  it("orders shots chronologically (oldest first), tie-broken by time", () => {
    const backup = buildBackup([
      shot({ date: "2026-07-10", time: "18:00" }),
      shot({ date: "2026-07-12" }),
      shot({ date: "2026-07-10", time: "08:00" }),
    ]);
    expect(backup.shots.map((s) => `${s.date} ${s.time ?? ""}`.trim())).toEqual([
      "2026-07-10 08:00",
      "2026-07-10 18:00",
      "2026-07-12",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [shot({ date: "2026-07-12" }), shot({ date: "2026-07-10" })];
    const snapshot = input.map((s) => s.id);
    buildBackup(input);
    expect(input.map((s) => s.id)).toEqual(snapshot);
  });
});

describe("toJson", () => {
  it("produces parseable JSON of the envelope", () => {
    const parsed = JSON.parse(toJson([shot({ mood: "good" })]));
    expect(parsed.app).toBe(APP_NAME);
    expect(parsed.shots[0].mood).toBe("good");
  });
});

describe("escapeCsvCell", () => {
  it("returns an empty string for undefined", () => {
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("passes plain values through unchanged", () => {
    expect(escapeCsvCell("thigh")).toBe("thigh");
    expect(escapeCsvCell(50)).toBe("50");
  });

  it("quotes and doubles embedded quotes (RFC 4180)", () => {
    expect(escapeCsvCell('he said "ow"')).toBe('"he said ""ow"""');
  });

  it("quotes values containing commas or newlines", () => {
    expect(escapeCsvCell("left, upper")).toBe('"left, upper"');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralises formula-injection leading characters", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell("+cmd")).toBe("'+cmd");
    expect(escapeCsvCell("-2")).toBe("'-2");
    expect(escapeCsvCell("@ref")).toBe("'@ref");
  });

  it("quotes a cell that is both a formula and contains a comma", () => {
    // guard prefix first, then RFC quoting wraps the whole thing
    expect(escapeCsvCell("=1,2")).toBe("\"'=1,2\"");
  });

  it("neutralises a formula hidden behind leading whitespace", () => {
    expect(escapeCsvCell(" =cmd")).toBe("' =cmd");
    expect(escapeCsvCell("\t=cmd")).toBe("'\t=cmd");
  });

  it("does not prefix benign leading whitespace", () => {
    expect(escapeCsvCell("  hello world")).toBe("  hello world");
  });
});

describe("toCsv", () => {
  it("starts with a UTF-8 BOM and a header row", () => {
    const csv = toCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toContain("date,time,doseMg");
  });

  it("uses CRLF line endings", () => {
    const csv = toCsv([shot({ doseMg: 50 })]);
    expect(csv).toContain("\r\n");
  });

  it("emits one row per shot, chronological, with escaped notes", () => {
    const csv = toCsv([
      shot({ date: "2026-07-12", notes: "hurt, a lot" }),
      shot({ date: "2026-07-10", notes: "fine" }),
    ]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1]).toContain("2026-07-10");
    expect(lines[1].endsWith("fine")).toBe(true);
    expect(lines[2]).toContain('"hurt, a lot"');
  });
});
