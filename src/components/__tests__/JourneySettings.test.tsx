import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JourneySettings } from "../JourneySettings";
import { ProfileProvider } from "../../context/ProfileContext";
import { STORAGE_KEYS } from "../../storageKeys";
import { expectFocusSomewhereUseful } from "../../test/focus";
import { expectVisibleFocusRing } from "../../test/focusRing";

beforeEach(() => localStorage.clear());

/** Rendered with the heading above it, as Settings does — that heading is where
 *  "Remove start date" hands focus. */
const renderPanel = () => {
  const headingRef = React.createRef<HTMLHeadingElement>();
  return render(
    <ProfileProvider>
      {/* The class matters: it is what carries the focus ring, so a bare <h2>
          here would test a heading the app never renders. */}
      <h2 className="settings-section__title" ref={headingRef} tabIndex={-1}>
        Your journey
      </h2>
      <JourneySettings headingRef={headingRef} />
    </ProfileProvider>,
  );
};

/**
 * The panel inside a provider that OUTLIVES it, with a switch to take just the
 * panel away — which is what changing tab does. Unmounting the whole tree
 * (provider included) is not the same event: the store would be gone too, so a
 * commit on the way out could not land and the test would be measuring its own
 * scaffolding.
 */
const renderRemovablePanel = () => {
  const Harness = ({ shown }: { shown: boolean }) => (
    <ProfileProvider>{shown && <JourneySettings />}</ProfileProvider>
  );
  const view = render(<Harness shown />);
  // Re-rendered with the panel gone, rather than driven by a captured setter:
  // assigning to a closure during render is a side effect in render, which lint
  // rightly refuses.
  return { removePanel: () => view.rerender(<Harness shown={false} />) };
};

const dateInput = () =>
  screen.getByLabelText("Testosterone start date") as HTMLInputElement;
const nameInput = () =>
  screen.getByLabelText("Preferred name") as HTMLInputElement;
const shotDaySelect = () =>
  screen.getByLabelText(
    "Which day do you usually take it?",
  ) as HTMLSelectElement;
const heading = () => screen.getByRole("heading", { name: "Your journey" });
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
      JSON.stringify({ startDate: "2025-01-15", preferredName: "Lou" }),
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
      JSON.stringify({ startDate: "2025-01-15", preferredName: "Lou" }),
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
      JSON.stringify({ startDate: "2020-01-01" }),
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
      JSON.stringify({ startDate: "2020-01-01" }),
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
      screen.queryByRole("button", { name: "Remove start date" }),
    ).not.toBeInTheDocument();
  });

  it("offers no Remove control when there is no start date to remove", () => {
    renderPanel();
    expect(
      screen.queryByRole("button", { name: "Remove start date" }),
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
      JSON.stringify({ startDate: "2020-01-01" }),
    );
    renderPanel();
    const remove = screen.getByRole("button", { name: "Remove start date" });
    remove.focus();
    expect(remove).toHaveFocus();

    fireEvent.click(remove);

    expect(
      screen.queryByRole("button", { name: "Remove start date" }),
    ).not.toBeInTheDocument();
    expectFocusSomewhereUseful("after removing the start date");
    // The HEADING, not the date field. Focusing an input[type=date] from inside
    // a click handler is what makes iOS Safari and Android Chrome throw up the
    // date wheel — covering half the phone with a picker immediately after an
    // action whose whole point was to not have a date. ShotForm's "Clear form"
    // documented that hazard and avoided it; this control walked into it.
    expect(heading()).toHaveFocus();
    expect(dateInput()).not.toHaveFocus();
    // ...and the ring is actually painted there. A hand-off target with no rule
    // in the stylesheet's focus allowlist moves a keyboard user silently, which
    // is the half of this the project's own browser-pass checklist calls out and
    // jsdom cannot see — so it is asserted against the real stylesheet.
    expectVisibleFocusRing("after removing the start date");
  });

  it("still hands focus somewhere useful with no heading to aim at", () => {
    // The panel renders standalone too. The date field is a poor target but a
    // far better one than <body>, so it stays as the fallback — handOffFocus
    // verifies each candidate rather than assuming the first one takes.
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: "2020-01-01" }),
    );
    render(
      <ProfileProvider>
        <JourneySettings />
      </ProfileProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove start date" }));
    expectFocusSomewhereUseful("after removing with no heading");
  });

  it("commits a picked date when the app is backgrounded without blurring", () => {
    // On a phone you can open the field, spin the wheel, then switch apps —
    // blur never fires. With blur as the only commit path the date was silently
    // dropped while the field looked filled in the whole time, and silent loss
    // is the failure this app treats as severe.
    renderPanel();
    fireEvent.change(dateInput(), { target: { value: "1998-07-04" } });
    expect(stored()).toBeNull(); // nothing yet

    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    fireEvent(document, new Event("visibilitychange"));

    expect(stored()).toEqual({ startDate: "1998-07-04" });
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  it("commits a picked date when the panel goes away", () => {
    // Changing tab destroys this panel, which on a phone is a likelier exit than
    // blurring the field.
    const { removePanel } = renderRemovablePanel();
    fireEvent.change(dateInput(), { target: { value: "2001-09-11" } });
    expect(stored()).toBeNull();

    removePanel();

    expect(stored()).toEqual({ startDate: "2001-09-11" });
  });

  it("commits nothing on the way out when the draft is half-typed", () => {
    // The transit values stay out of storage on every path, not just on blur —
    // `0002` is not a date anyone meant.
    const { removePanel } = renderRemovablePanel();
    fireEvent.change(dateInput(), { target: { value: "0002-03-15" } });
    removePanel();
    expect(stored()).toBeNull();
  });

  it("puts the saved date back when a half-typed one is abandoned", () => {
    // Otherwise the field is left showing a value nothing holds.
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: "2020-01-01" }),
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
      JSON.stringify({ shotDay: "friday" }),
    );
    renderPanel();
    expect(shotDaySelect().value).toBe("friday");
    fireEvent.change(shotDaySelect(), { target: { value: "" } });
    expect(localStorage.getItem(STORAGE_KEYS.profile)).toBe("{}");
  });
});

describe("JourneySettings — the interval's unit", () => {
  /*
   * The unit used to live ONLY in the placeholder ("Every ___ days"), which
   * disappears as soon as there is a value — and the commonest action on this
   * screen, tapping the "2 weeks" chip, is exactly what puts one there. So the
   * last unit anyone had read said WEEKS while the box quietly held 14. Three
   * cues, and the only one naming days was the one that vanished.
   */
  it("names the unit in the label, where it cannot disappear", () => {
    renderPanel();
    // Not a placeholder and not only a suffix: a suffix is aria-hidden, so the
    // label is the only place a screen reader can learn the unit.
    expect(
      screen.getByLabelText("How many days between your shots?"),
    ).toBeInTheDocument();
  });

  it("shows the unit beside the value, and hides it from the accessible name", () => {
    renderPanel();
    const unit = document.querySelector(".interval-field__unit")!;
    expect(unit.textContent).toBe("days");
    // Decoration: the label already says it, so announcing it twice is noise.
    expect(unit.getAttribute("aria-hidden")).toBe("true");
    expect(
      screen.getByLabelText("How many days between your shots?"),
    ).toHaveAccessibleName("How many days between your shots?");
  });

  it("keeps no placeholder holding the unit", () => {
    // The regression that matters: putting it back in the placeholder would
    // look identical while empty and lose the unit the moment you answer.
    renderPanel();
    const box = screen.getByLabelText(
      "How many days between your shots?",
    ) as HTMLInputElement;
    expect(box.placeholder).toBe("");
  });

  it("still shows the unit once a chip has filled the box", () => {
    // The exact moment the old design failed.
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "2 weeks" }));
    const box = screen.getByLabelText(
      "How many days between your shots?",
    ) as HTMLInputElement;
    expect(box.value).toBe("14");
    expect(document.querySelector(".interval-field__unit")!.textContent).toBe(
      "days",
    );
  });
});

describe("JourneySettings — how often", () => {
  const intervalField = () =>
    screen.getByLabelText(
      "How many days between your shots?",
    ) as HTMLInputElement;
  const shotDay = () =>
    screen.getByLabelText(
      "Which day do you usually take it?",
    ) as HTMLSelectElement;

  it("saves a typed interval on blur, not on every keystroke", () => {
    renderPanel();
    fireEvent.change(intervalField(), { target: { value: "1" } });
    // Nothing written at all: a half-typed "1" must not become an interval of
    // one day, which is a valid value and would freeze onto the next shot.
    expect(stored()?.intervalDays).toBeUndefined();
    fireEvent.change(intervalField(), { target: { value: "14" } });
    fireEvent.blur(intervalField());
    expect(stored().intervalDays).toBe(14);
  });

  it("fills the field from a quick pick", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "1 week" }));
    expect(intervalField().value).toBe("7");
    expect(stored().intervalDays).toBe(7);
  });

  it("clearing the field removes the interval rather than storing zero", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "2 weeks" }));
    fireEvent.change(intervalField(), { target: { value: "" } });
    fireEvent.blur(intervalField());
    expect(stored().intervalDays).toBeUndefined();
  });

  it("refuses a value the schedule cannot use, and shows what is saved", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "1 week" }));
    fireEvent.change(intervalField(), { target: { value: "0" } });
    fireEvent.blur(intervalField());
    expect(stored().intervalDays).toBe(7);
    expect(intervalField().value).toBe("7"); // snapped back, never disagrees
  });

  it("greys out shot day for a non-weekly interval, and says why", () => {
    renderPanel();
    fireEvent.change(intervalField(), { target: { value: "10" } });
    fireEvent.blur(intervalField());

    expect(shotDay()).toBeDisabled();
    expect(
      screen.getByText(/No shot day with a non-weekly interval/i),
    ).toBeInTheDocument();
  });

  it("disables shot day WITHOUT clearing it, so a corrected interval brings it back", () => {
    // The whole point of disabling rather than clearing: someone who mistypes
    // 10 for 14 should not have to remember which day they had chosen.
    renderPanel();
    fireEvent.change(shotDay(), { target: { value: "wednesday" } });
    fireEvent.change(intervalField(), { target: { value: "10" } });
    fireEvent.blur(intervalField());
    expect(shotDay()).toBeDisabled();
    expect(stored().shotDay).toBe("wednesday"); // still stored

    fireEvent.change(intervalField(), { target: { value: "14" } });
    fireEvent.blur(intervalField());
    expect(shotDay()).not.toBeDisabled();
    expect(shotDay().value).toBe("wednesday");
  });
});

describe("JourneySettings — the interval must not discard the schedule anchor", () => {
  it("leaves the anchor alone when the interval did not change", () => {
    // setIntervalDays clears the anchor deliberately, because changing your
    // cadence re-declares the schedule. Committing unconditionally on blur made
    // an idle focus/blur — or tapping the chip already lit — throw the frozen
    // anchor away, after which the next save re-derived it from the earliest
    // shot and could move the grid phase by up to 7 days.
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({
        shotDay: "wednesday",
        intervalDays: 14,
        scheduleAnchor: "2026-01-07",
      }),
    );
    renderPanel();
    const box = screen.getByLabelText("How many days between your shots?");

    fireEvent.focus(box);
    fireEvent.blur(box);
    expect(stored().scheduleAnchor).toBe("2026-01-07");

    fireEvent.click(screen.getByRole("button", { name: "2 weeks" }));
    expect(stored().scheduleAnchor).toBe("2026-01-07");
  });

  it("clears it when the interval really changes", () => {
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({
        shotDay: "wednesday",
        intervalDays: 14,
        scheduleAnchor: "2026-01-07",
      }),
    );
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "1 week" }));
    expect(stored().scheduleAnchor).toBeUndefined();
    expect(stored().intervalDays).toBe(7);
  });
});
