import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JourneySettings } from "../JourneySettings";
import { ProfileProvider } from "../../context/ProfileContext";
import { STORAGE_KEYS } from "../../storageKeys";
import { expectFocusSomewhereUseful } from "../../test/focus";

beforeEach(() => localStorage.clear());

const renderPanel = () =>
  render(
    <ProfileProvider>
      <JourneySettings />
    </ProfileProvider>
  );

const dateInput = () =>
  screen.getByLabelText("Testosterone start date") as HTMLInputElement;
const nameInput = () =>
  screen.getByLabelText("Preferred name") as HTMLInputElement;
const shotDaySelect = () =>
  screen.getByLabelText("Shot day") as HTMLSelectElement;
const stored = () =>
  JSON.parse(localStorage.getItem(STORAGE_KEYS.profile) ?? "null");

describe("JourneySettings", () => {
  it("starts blank when no profile is set", () => {
    renderPanel();
    expect(dateInput().value).toBe("");
    expect(nameInput().value).toBe("");
  });

  it("reflects an existing profile", () => {
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: "2025-01-15", preferredName: "Lou" })
    );
    renderPanel();
    expect(dateInput().value).toBe("2025-01-15");
    expect(nameInput().value).toBe("Lou");
  });

  it("persists edits to the profile store", () => {
    renderPanel();
    fireEvent.change(dateInput(), { target: { value: "2024-11-02" } });
    // The date commits when you LEAVE the field, not per keystroke — see the
    // typing test below for why. The name is a text input: it reports exactly
    // what was typed, with no transit values, so it saves as you go.
    fireEvent.blur(dateInput());
    fireEvent.change(nameInput(), { target: { value: "Sam" } });
    expect(stored()).toEqual({ startDate: "2024-11-02", preferredName: "Sam" });
  });

  it("clearing a field removes it from storage (not stored as empty)", () => {
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: "2025-01-15", preferredName: "Lou" })
    );
    renderPanel();
    fireEvent.change(nameInput(), { target: { value: "" } });
    expect(stored()).toEqual({ startDate: "2025-01-15" });
    expect(nameInput().value).toBe("");
  });

  it("takes any real date, near or far, with no range of its own", () => {
    // Deliberately UNBOUNDED, unlike the log sheet's date — and the absence of a
    // `max` is part of the contract, not an oversight. A start date is a fact
    // someone is reporting about their own life; a shot date is a value the app
    // has cause to sanity-check. Binding both to one rule is how this was first
    // written, and it applied the shot rule here by accident.
    renderPanel();
    expect(dateInput().getAttribute("max")).toBeNull();
    expect(dateInput().getAttribute("min")).toBeNull();

    // Far future: planning ahead, however far.
    fireEvent.change(dateInput(), { target: { value: "2099-01-01" } });
    fireEvent.blur(dateInput());
    expect(stored()).toEqual({ startDate: "2099-01-01" });

    // Long ago: someone else's history is not ours to argue with.
    fireEvent.change(dateInput(), { target: { value: "1972-03-08" } });
    fireEvent.blur(dateInput());
    expect(stored()).toEqual({ startDate: "1972-03-08" });
  });

  it("survives typing a year digit by digit, without erasing what is saved", () => {
    // The regression this exists for, measured in a real browser: the field was
    // unusable by keyboard. A date input reports a value only when all three
    // segments are filled and Chromium auto-fills the rest, so typing the year
    // of 2021 walks through 0002 → 0020 → 0202. Committing every keystroke wrote
    // `undefined` for the incomplete ones, the controlled value snapped to "",
    // and the whole field blanked — taking the saved date with it. The year
    // could not be typed at all.
    //
    // Years 0–99 are the trap: `Date.UTC` remaps them into the 1900s, so the
    // round-trip in civilDateParts fails and they are not real dates.
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: "2020-01-01" })
    );
    renderPanel();

    // The transient empty a date input reports the moment you start retyping —
    // the keystroke that used to erase the saved date outright.
    fireEvent.change(dateInput(), { target: { value: "" } });
    expect(stored().startDate).toBe("2020-01-01");

    // `0202` is the one that matters and the one an earlier guard let through:
    // years 0–99 are remapped into the 1900s by Date.UTC and fail the
    // round-trip, so they read as unreal — but year 202 SURVIVES it. Saving on
    // each keystroke therefore wrote a third-century start date to the profile
    // mid-word, and blur would not undo it, because it is a real date.
    for (const partial of ["0002-03-15", "0020-03-15", "0202-03-15"]) {
      fireEvent.change(dateInput(), { target: { value: partial } });
      // Still on screen — the field shows what was typed...
      expect(dateInput().value).toBe(partial);
      // ...and nothing is saved until the field is left.
      expect(stored().startDate).toBe("2020-01-01");
    }

    fireEvent.change(dateInput(), { target: { value: "2021-03-15" } });
    fireEvent.blur(dateInput());
    expect(dateInput().value).toBe("2021-03-15");
    expect(stored().startDate).toBe("2021-03-15");
  });

  it("commits on leaving the field, not on every keystroke", () => {
    renderPanel();
    fireEvent.change(dateInput(), { target: { value: "1998-07-04" } });
    expect(stored?.()).toBeNull(); // nothing written yet
    fireEvent.blur(dateInput());
    expect(stored()).toEqual({ startDate: "1998-07-04" });
  });

  it("removes the start date only through its own control", () => {
    // An empty date input means two things it cannot separate — "I cleared this"
    // and "I am retyping, the segments are incomplete" — and both report "".
    // Blur does not separate them either; it just picks one, destructively. So
    // emptiness never deletes, and removing has its own carrier: a control the
    // user presses on purpose.
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: "2020-01-01" })
    );
    renderPanel();

    // Emptying the field and leaving it does NOT delete the saved date...
    fireEvent.change(dateInput(), { target: { value: "" } });
    fireEvent.blur(dateInput());
    expect(stored().startDate).toBe("2020-01-01");
    expect(dateInput().value).toBe("2020-01-01"); // and the field says so

    // ...pressing Remove does.
    fireEvent.click(screen.getByRole("button", { name: "Remove start date" }));
    expect(stored().startDate).toBeUndefined();
    expect(dateInput().value).toBe("");
    // And it retires with the value, so there is nothing to press twice.
    expect(
      screen.queryByRole("button", { name: "Remove start date" })
    ).not.toBeInTheDocument();
  });

  it("offers no Remove control when there is no start date to remove", () => {
    renderPanel();
    expect(
      screen.queryByRole("button", { name: "Remove start date" })
    ).not.toBeInTheDocument();
  });

  it("hands focus on when Remove takes itself away", () => {
    // The control only exists while a start date is set, and pressing it clears
    // that — so it removes itself. Without a hand-off, a keyboard or
    // screen-reader user is dropped to <body> with nothing announced and the
    // next Tab restarting from the top of the document. CLAUDE.md calls this
    // class non-negotiable, and every other self-removing control here already
    // does it.
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: "2020-01-01" })
    );
    renderPanel();
    const remove = screen.getByRole("button", { name: "Remove start date" });
    remove.focus();
    expect(remove).toHaveFocus();

    fireEvent.click(remove);

    expect(
      screen.queryByRole("button", { name: "Remove start date" })
    ).not.toBeInTheDocument();
    expectFocusSomewhereUseful("after removing the start date");
    expect(dateInput()).toHaveFocus();
  });

  it("puts the saved date back when a half-typed one is abandoned", () => {
    // Otherwise the field is left showing a value nothing holds.
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: "2020-01-01" })
    );
    renderPanel();
    fireEvent.change(dateInput(), { target: { value: "0002-03-15" } });
    fireEvent.blur(dateInput());
    expect(dateInput().value).toBe("2020-01-01");
    expect(stored().startDate).toBe("2020-01-01");
  });

  // No test here for an impossible date like "2025-02-30": an input[type=date]
  // cannot hold one. Setting it leaves the value EMPTY, in jsdom and in browsers
  // alike, which this field reads as a clear (on blur) — so such a test would be
  // asserting the clearing path under a misleading name. The reachable case for
  // the isRealDate guard is the low-year partials (0002…, 0020…), covered above.

  it("defaults shot day to 'No shot day' and persists a chosen weekday", () => {
    renderPanel();
    expect(shotDaySelect().value).toBe("");
    fireEvent.change(shotDaySelect(), { target: { value: "wednesday" } });
    expect(stored()).toEqual({ shotDay: "wednesday" });
  });

  it("clearing shot day back to 'No shot day' removes it from storage", () => {
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ shotDay: "friday" })
    );
    renderPanel();
    expect(shotDaySelect().value).toBe("friday");
    fireEvent.change(shotDaySelect(), { target: { value: "" } });
    expect(localStorage.getItem(STORAGE_KEYS.profile)).toBe("{}");
  });
});
