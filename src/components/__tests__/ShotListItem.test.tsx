import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShotListItem } from "../ShotListItem";
import type { ShotEntry } from "../../types/shot";

const pill = () => document.querySelector(".shot-list-item__pill");

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
