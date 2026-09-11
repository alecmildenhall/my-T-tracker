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

  it("removes the start date two ways: emptying the field, and Remove", () => {
    // Emptying used to restore, on the reasoning that an empty date input
    // cannot separate "I cleared this" from "I am mid-retype" — both report "".
    // The ambiguity is real and `badInput` resolves it, which `commitDateDraft`
    // measures; the visible consequence of the old behaviour was that the iOS
    // picker's "Reset" appeared to do nothing at all.
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: "2020-01-01" }),
    );
    renderPanel();

    // Emptying the field and leaving it now clears...
    fireEvent.change(dateInput(), { target: { value: "" } });
    fireEvent.blur(dateInput());
    expect(stored().startDate).toBeUndefined();
    expect(dateInput().value).toBe("");

    // ...and so does Remove, which stays because it is the explicit path and
    // the one a keyboard user can find without guessing.
    fireEvent.change(dateInput(), { target: { value: "2020-01-01" } });
    fireEvent.blur(dateInput());
    expect(stored().startDate).toBe("2020-01-01");
    fireEvent.click(screen.getByRole("button", { name: "Remove start date" }));
    expect(stored().startDate).toBeUndefined();
    expect(dateInput().value).toBe("");
    // And it retires with the value, so there is nothing to press twice.
    expect(
      screen.queryByRole("button", { name: "Remove start date" }),
    ).not.toBeInTheDocument();
  });

  it("offers Remove as soon as the date is entered, not after blur", () => {
    // Keyed to the committed profile it appeared only after blur — a visible
    // lag on the control that undoes what you just typed.
    renderPanel();
    fireEvent.change(dateInput(), { target: { value: "1998-07-04" } });
    expect(
      screen.getByRole("button", { name: "Remove start date" }),
    ).toBeInTheDocument();
  });

  it("does not let the press blur the field out from under itself", () => {
    // Same race as the card's copy, same guard — see the note there.
    renderPanel();
    fireEvent.change(dateInput(), { target: { value: "1998-07-04" } });
    const remove = screen.getByRole("button", { name: "Remove start date" });
    expect(!fireEvent.mouseDown(remove)).toBe(true);
  });

  it("removes a date that was entered but never committed", () => {
    // The profile never got this value, so clearing it changes nothing there
    // and the draft sync never fires. Without clearing the draft explicitly the
    // date would sit in the field with no way left to remove it — which is why
    // a line this test's predecessor called redundant is now load-bearing.
    renderPanel();
    fireEvent.change(dateInput(), { target: { value: "1998-07-04" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove start date" }));

    expect(dateInput().value).toBe("");
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

  
  it("does NOT treat a HALF-TYPED date as a deletion on the way out", () => {
    // An empty `<input type="date">` reports `""` for "I cleared this" AND for
    // "I am mid-retype", and the hatch used to assert `badInput: false` -- a
    // guess wearing a check's clothes, which picked the branch that deletes.
    // Measured before the fix: stored date gone after a tab change, while the
    // same state on blur restored it.
    //
    // This comment used to add "on unmount React has already detached the ref".
    // That was true of the passive effect the hatch used to be and is false now
    // that it is a layout one, which is precisely why it reads the live control.
    // Note this particular case cannot tell the two apart -- `badInput` is
    // stubbed true, and `commitDateDraft` returns "restore" from either source
    // -- so the effect type is pinned by its NEIGHBOURS ("clears when the LAST
    // segments go" and "commits a CLEARED date when the panel goes away"), both
    // of which fail if it is reverted.
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: "2020-01-01" }),
    );
    const { removePanel } = renderRemovablePanel();
    // Stub BEFORE the change: the fact is only observable at the moment it
    // happens, and stubbing afterwards passes for the wrong reason.
    Object.defineProperty(dateInput(), "validity", {
      configurable: true,
      value: { badInput: true },
    });
    fireEvent.change(dateInput(), { target: { value: "" } });
    removePanel();

    expect(stored().startDate).toBe("2020-01-01");
  });

  /**
   * Set what the control reports WITHOUT firing an event -- which is not a
   * contrivance, it is what the real control does. A date input fires `input`
   * only when its `value` changes, and once the value is `""` it stays `""`
   * while the remaining segments are typed or deleted, so `badInput` flips with
   * no event and no render. Anything that samples it into a ref is stale from
   * that moment, in whichever direction the user moved.
   */
  const setBadInput = (el: HTMLInputElement, badInput: boolean) =>
    Object.defineProperty(el, "validity", {
      configurable: true,
      value: { badInput },
    });

  it("clears when the LAST segments go, though no event announced it", () => {
    // Half-typed (renders, value "" ) and then emptied outright (no event).
    // A sampled answer is stuck on "mid-edit" and restores, resurrecting a date
    // the user deliberately removed -- the bug this whole area was fixed for,
    // one keystroke further along.
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: "2020-01-01" }),
    );
    const { removePanel } = renderRemovablePanel();
    setBadInput(dateInput(), true);
    fireEvent.change(dateInput(), { target: { value: "" } });
    setBadInput(dateInput(), false); // segments cleared; value never moved
    removePanel();

    expect(stored().startDate).toBeUndefined();
  });

  it("restores when retyping STARTS after a clear, though no event announced it", () => {
    // The mirror, and the one that loses data: cleared (renders, badInput
    // false), then a segment typed (no event). A sampled answer is stuck on
    // "deliberate" and deletes a date the user was part-way through re-entering.
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: "2020-01-01" }),
    );
    const { removePanel } = renderRemovablePanel();
    setBadInput(dateInput(), false);
    fireEvent.change(dateInput(), { target: { value: "" } });
    setBadInput(dateInput(), true); // retyping began; value never moved
    removePanel();

    expect(stored().startDate).toBe("2020-01-01");
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

  it("commits a CLEARED date when the panel goes away", () => {
    // The hatch could only ever say "set". Once an emptied field started meaning
    // "clear", that made it disagree with blur — measured before the fix:
    // emptying the field and switching tab put the old date straight back, and
    // the field showed it again on return.
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: "2024-03-15" }),
    );
    const { removePanel } = renderRemovablePanel();
    fireEvent.change(dateInput(), { target: { value: "" } });
    // No blur — the user changes tab instead.
    removePanel();

    expect(stored().startDate).toBeUndefined();
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

  
  });
