import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShotListItem } from "../ShotListItem";
import type { ShotEntry } from "../../types/shot";

const pill = () => document.querySelector(".shot-list-item__pill");

const meta = () => document.querySelector(".shot-list-item__meta");

describe("ShotListItem — the detail line's separators", () => {
  const row = (over: Partial<ShotEntry>) =>
    render(<ShotListItem shot={{ id: "a", date: "2026-09-15", ...over }} />);

  it("puts no separator before a lone detail", () => {
    // The bug this exists for. Every field used to carry its own leading " • ",
    // so whenever the first one was absent the separator had nothing to
    // separate from: a shot logged with an off-days answer and no dose read
    // "• Off days: …", bullet first. Found by using the app, not reading it.
    row({ offDays: "right-after" });
    expect(meta()!.textContent).toBe("Off days: Right after the previous shot");
    expect(meta()!.textContent!.trimStart().startsWith("•")).toBe(false);
  });

  it("puts no separator before a lone detail that is not the first field", () => {
    // Any of them can be the only one present, so the rule cannot depend on
    // which field it is.
    row({ carrierOil: "sesame" });
    expect(meta()!.textContent).toBe("Oil: sesame");
  });

  it("separates details from each other, once", () => {
    row({ doseMg: 50, injectionSite: "thigh", offDays: "none" });
    expect(meta()!.textContent).toBe(
      "Dose: 50 mg • Site: thigh • Off days: Not really",
    );
  });

  it("keeps a zero dose, which is a real value", () => {
    // `doseMg` is checked with `!== undefined`, never truthiness — 0 is a dose
    // somebody recorded, and the rule this codebase states by name.
    row({ doseMg: 0 });
    expect(meta()!.textContent).toBe("Dose: 0 mg");
  });

  it("renders no detail line at all when there is nothing to say", () => {
    row({});
    expect(meta()).toBeNull();
  });

  it("ignores an off-days value the enum does not contain", () => {
    // Storage is lenient, so a legacy value reaches here; an unchecked lookup
    // would render "Off days: " with nothing after it, as pain once did.
    row({ offDays: "a bit rough" } as unknown as Partial<ShotEntry>);
    expect(meta()).toBeNull();
  });
});

describe("ShotListItem — the pain pill", () => {
  it("shows the level as words", () => {
    render(
      <ShotListItem shot={{ id: "a", date: "2026-08-05", pain: "moderate" }} />,
    );
    expect(pill()).toHaveTextContent("Pain: Moderate");
  });

  it("shows nothing when no pain was recorded", () => {
    // Distinct from "None", which is an answer and does render.
    render(<ShotListItem shot={{ id: "a", date: "2026-08-05" }} />);
    expect(pill()).toBeNull();

    render(
      <ShotListItem shot={{ id: "b", date: "2026-08-06", pain: "none" }} />,
    );
    expect(screen.getByText("Pain: None")).toBeInTheDocument();
  });

  it("shows nothing for a level the enum does not contain", () => {
    // Storage is deliberately lenient — `sanitizeShots` vets only a non-blank
    // id and date — so a devtools edit or a value from a newer build reaches
    // here. A presence check let it through to an unchecked label lookup, and
    // the row rendered a pill reading "Pain: " with nothing after it. This is
    // the guard the `typeof painScore === "number"` it replaced actually was.
    const junk = {
      id: "a",
      date: "2026-08-05",
      pain: "agony",
    } as unknown as ShotEntry;
    render(<ShotListItem shot={junk} />);
    expect(pill()).toBeNull();
  });
});
