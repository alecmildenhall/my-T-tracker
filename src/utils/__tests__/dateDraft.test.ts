import { describe, it, expect } from "vitest";
import { commitDateDraft } from "../dateDraft";

describe("commitDateDraft", () => {
  it("saves a real date", () => {
    expect(commitDateDraft("2025-06-01", false)).toEqual({
      action: "set",
      date: "2025-06-01",
    });
  });

  it("clears a field that was emptied on purpose", () => {
    // The whole point of the change: the native picker's "Reset" empties the
    // field, and this used to restore the stored value so the button appeared
    // to do nothing.
    expect(commitDateDraft("", false)).toEqual({ action: "clear" });
  });

  it("restores a field that is only part-way typed", () => {
    // The case the old design refused to distinguish, and the reason it refused
    // to clear at all. Measured in Chromium: a month typed with no year reports
    // value "" AND `badInput` true, where a field emptied outright reports ""
    // with `badInput` false. Unreachable through `fireEvent`, which is why it
    // is tested here rather than in a component.
    expect(commitDateDraft("", true)).toEqual({ action: "restore" });
  });

  it("restores rather than clearing when a value is unparseable", () => {
    // Belt and braces: a date input's own sanitization means a non-date never
    // reaches here (measured — "2024-02-30" becomes ""), but the decision must
    // not depend on that being true of every engine forever.
    expect(commitDateDraft("2024-02-30", false)).toEqual({ action: "restore" });
    expect(commitDateDraft("not-a-date", false)).toEqual({ action: "restore" });
  });

  it("never clears on anything but a genuinely empty, well-formed field", () => {
    // The guarantee that keeps this safe: clearing is the narrow case, not the
    // fallback. Anything uncertain restores.
    for (const [draft, bad] of [
      ["", true],
      ["2024-02-30", false],
      ["2024-02-30", true],
      ["x", false],
      ["2025-06-01", true],
    ] as const) {
      expect(commitDateDraft(draft, bad).action).not.toBe("clear");
    }
  });

  it("prefers a real date even if the field also reports bad input", () => {
    // A complete value wins: whatever the engine thinks of the segments, there
    // is a date here and the user meant it.
    expect(commitDateDraft("2025-06-01", true)).toEqual({
      action: "set",
      date: "2025-06-01",
    });
  });
});
