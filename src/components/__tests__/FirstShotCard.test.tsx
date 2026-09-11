import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FirstShotCard } from "../FirstShotCard";
import { ProfileProvider } from "../../context/ProfileContext";
import { STORAGE_KEYS } from "../../storageKeys";
import { expectVisibleFocusRing } from "../../test/focusRing";
import { expectFocusSomewhereUseful } from "../../test/focus";
import { CONFIRM_MS } from "../../utils/timing";
import { SHEET_EXIT_MS } from "../Modal";

beforeEach(() => localStorage.clear());

const seedProfile = (profile: Record<string, unknown>) =>
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));

const storedProfile = () =>
  JSON.parse(localStorage.getItem(STORAGE_KEYS.profile) ?? "{}");

const renderCard = () =>
  render(
    <ProfileProvider>
      <FirstShotCard onGoToSettings={vi.fn()} onDone={vi.fn()} />
    </ProfileProvider>,
  );

const startField = () =>
  screen.getByLabelText("When did you start T?") as HTMLInputElement;

describe("FirstShotCard — the start date", () => {
  it("clears a stored start date when the field is emptied", () => {
    // It used to restore instead, so the native picker's own "Reset" emptied
    // the field and blur put the value straight back — a platform control that
    // visibly did nothing. And this card has no "Remove start date", so an
    // answer given here could not be taken back AT ALL, while name and interval
    // both cleared. `commitDateDraft` carries the reasoning and the measured
    // `badInput` behaviour that makes it safe.
    seedProfile({ startDate: "2024-03-15" });
    renderCard();

    fireEvent.change(startField(), { target: { value: "" } });
    fireEvent.blur(startField());

    expect(storedProfile().startDate).toBeUndefined();
    expect(startField().value).toBe("");
  });

  it("still saves a real date typed into the field", () => {
    renderCard();

    fireEvent.change(startField(), { target: { value: "2025-06-01" } });
    fireEvent.blur(startField());

    expect(storedProfile().startDate).toBe("2025-06-01");
  });

  it("offers Remove start date, which does not depend on the platform", () => {
    // The guaranteed path. iOS's picker has its own Reset and WebKit either
    // fires no change event for it or one carrying the previous value, so the
    // blur handler is a best effort that cannot be verified from here. This
    // control needs none of that — and without it, an answer given on this card
    // could not be taken back at all, on the one screen someone meets before
    // they know Settings exists.
    seedProfile({ startDate: "2024-03-15" });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Remove start date" }));

    expect(storedProfile().startDate).toBeUndefined();
    expect(startField().value).toBe("");
  });

  it("offers Remove as soon as the date is entered, not after blur", () => {
    // It used to render on the committed profile, which only updates on blur —
    // so entering a date and looking at it showed nothing until you tapped
    // away. The pain and off-days Clears key to their drafts and appear on the
    // tap; this matches them.
    renderCard();
    fireEvent.change(startField(), { target: { value: "2025-06-01" } });
    // No blur.
    expect(
      screen.getByRole("button", { name: "Remove start date" }),
    ).toBeInTheDocument();
  });

  // The condition is `isRealDate(draft)` rather than `draft !== ""`, so the
  // control cannot flash on and off between segments as someone types. That is
  // NOT tested here, and a test that looked like it was has been removed: a
  // date input's value sanitization turns "2025-06" into "" (measured in jsdom
  // and in Chromium), so the assertion passed under either condition and a
  // mutation to `!== ""` broke nothing. Partial input needs a real browser —
  // see the browser pass, which types segment by segment.

  it("does not let the press blur the field out from under itself", () => {
    // The control renders while the date field still has focus, so pressing it
    // used to blur the field first — which committed, re-rendered, and left the
    // mouseup on a different node, so the click never fired. Measured in a
    // browser: the event sequence was ["blur"] alone and the date survived.
    // `preventDefault` on mousedown stops focus moving, so there is no blur to
    // race. Asserting the DEFAULT is prevented, since jsdom will happily
    // dispatch a click either way and would pass without it.
    renderCard();
    fireEvent.change(startField(), { target: { value: "2025-06-01" } });
    const remove = screen.getByRole("button", { name: "Remove start date" });

    const prevented = !fireEvent.mouseDown(remove);
    expect(prevented).toBe(true);
  });

  it("removes a date that was entered but never committed", () => {
    // The case keying to the draft creates. The profile never got this value,
    // so clearing it changes nothing there and no sync fires — without the
    // draft being cleared explicitly, the date would sit in the field with no
    // way left to remove it.
    renderCard();
    fireEvent.change(startField(), { target: { value: "2025-06-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove start date" }));

    expect(startField().value).toBe("");
    expect(storedProfile().startDate).toBeUndefined();
    expect(
      screen.queryByRole("button", { name: "Remove start date" }),
    ).not.toBeInTheDocument();
  });

  it("offers no Remove control when there is no date to remove", () => {
    renderCard();
    expect(
      screen.queryByRole("button", { name: "Remove start date" }),
    ).not.toBeInTheDocument();
  });

  it("hands focus on when Remove takes itself away", () => {
    // It renders only while a start date is set, so pressing it deletes the
    // control under the user's finger. And NOT back to the date field: focusing
    // an `input[type=date]` from a click handler is what throws the iOS picker
    // up again, immediately after an action whose point was to have no date.
    seedProfile({ startDate: "2024-03-15" });
    renderCard();

    const remove = screen.getByRole("button", { name: "Remove start date" });
    remove.focus();
    fireEvent.click(remove);

    expectFocusSomewhereUseful("removing the start date");
    expect(document.activeElement).not.toBe(document.body);
    // And a ring on whatever it landed on — a hand-off target with none is a
    // keyboard user losing their place silently.
    expectVisibleFocusRing("after removing the start date");
  });

  // There is no "the field holds a non-date" case to test here, and there used
  // to be one that passed for the wrong reason. A date input's value
  // sanitization rejects anything that is not a valid date string, so
  // "2024-02-30" never reaches the handler — measured on the real control and
  // in jsdom, both turn it into "". That test was exercising the EMPTY path
  // while claiming to exercise the non-date one, which is why inverting the
  // empty behaviour broke it. The mid-edit path it was reaching for is a
  // `badInput` case, unreachable through `fireEvent`, and is covered where the
  // decision actually lives — see `dateDraft.test.ts`.
});

describe("FirstShotCard — leaving without blurring", () => {
  /*
   * The card is removed while the PROVIDER stays mounted — the shape
   * `renderRemovablePanel` already uses for the Settings copy. Unmounting the
   * whole tree instead looks equivalent and is not: the provider is what writes
   * to storage, so tearing it down in the same commit means the hatch's write
   * has nowhere to land, and the test fails for a reason that has nothing to do
   * with the hatch. Measured, both ways.
   */
  const renderRemovableCard = () => {
    const Harness = ({ shown }: { shown: boolean }) => (
      <ProfileProvider>
        {shown && <FirstShotCard onGoToSettings={vi.fn()} onDone={vi.fn()} />}
      </ProfileProvider>
    );
    const view = render(<Harness shown />);
    return { removeCard: () => view.rerender(<Harness shown={false} />) };
  };

  it("carries a cleared start date out with it", () => {
    // Same gap as the Settings copy, and the two are explicitly meant to agree
    // on this question: they agreed on blur and diverged on backgrounding,
    // because this hatch could only express "set".
    seedProfile({ startDate: "2024-03-15" });
    const { removeCard } = renderRemovableCard();
    fireEvent.change(startField(), { target: { value: "" } });
    removeCard();

    expect(storedProfile().startDate).toBeUndefined();
  });

  
  it("does NOT carry out a HALF-TYPED date as a deletion", () => {
    // The mirror of the test above, and the one that matters more, because it
    // fails the other way: an empty `<input type="date">` reports `""` for both
    // "I cleared this" and "I am mid-retype", so the hatch cannot tell them
    // apart from the draft alone. It used to assert `badInput: false` when the
    // element was already detached -- not a check, a guess -- and the guess
    // chose the destructive branch. Measured before the fix: a stored start
    // date was gone after a tab change, while the SAME state on blur restored
    // it correctly.
    seedProfile({ startDate: "2020-01-01" });
    const { removeCard } = renderRemovableCard();
    // Ordering is load-bearing: the fact has to be true AT the change, which is
    // the only moment it is observable. Stubbing it afterwards measures a field
    // that was well-formed while the handler ran, and passes vacuously.
    Object.defineProperty(startField(), "validity", {
      configurable: true,
      value: { badInput: true },
    });
    fireEvent.change(startField(), { target: { value: "" } });
    removeCard();

    expect(storedProfile().startDate).toBe("2020-01-01");
  });

  /** Set what the control reports without firing an event — see the twin in
   *  JourneySettings.test.tsx for why that is the realistic case. */
  const setBadInput = (el: HTMLInputElement, badInput: boolean) =>
    Object.defineProperty(el, "validity", {
      configurable: true,
      value: { badInput },
    });

  it("clears when the last segments go, though no event announced it", () => {
    seedProfile({ startDate: "2020-01-01" });
    const { removeCard } = renderRemovableCard();
    setBadInput(startField(), true);
    fireEvent.change(startField(), { target: { value: "" } });
    setBadInput(startField(), false); // emptied outright; value never moved
    removeCard();

    expect(storedProfile().startDate).toBeUndefined();
  });

  it("restores when retyping starts after a clear, though no event announced it", () => {
    // The losing direction: a sampled answer deletes a date being re-entered.
    seedProfile({ startDate: "2020-01-01" });
    const { removeCard } = renderRemovableCard();
    setBadInput(startField(), false);
    fireEvent.change(startField(), { target: { value: "" } });
    setBadInput(startField(), true); // retyping began; value never moved
    removeCard();

    expect(storedProfile().startDate).toBe("2020-01-01");
  });

  it("still carries an entered date out with it", () => {
    // The behaviour the hatch exists for, which the clear must not cost.
    const { removeCard } = renderRemovableCard();
    fireEvent.change(startField(), { target: { value: "2025-06-01" } });
    removeCard();

    expect(storedProfile().startDate).toBe("2025-06-01");
  });

  it("writes nothing when there was nothing to change", () => {
    // It runs from an effect cleanup, so an unconditional write hit the profile
    // on every navigation away — and on a full device that raised the storage
    // banner for an edit nobody made.
    const { removeCard } = renderRemovableCard();
    removeCard();
    expect(localStorage.getItem(STORAGE_KEYS.profile)).toBeNull();
  });
});


describe("FirstShotCard — Done", () => {
  it("confirms on the button before it calls back", () => {
    // The card originally had no dismiss control: it vanished once a shot
    // existed, so there was nothing to store. Then it had one that acted on the
    // frame it was pressed — which is what the sheet used to do, and what
    // CONFIRM_MS exists to stop: a surface that goes at its fastest moment
    // reads as dropped rather than dismissed.
    vi.useFakeTimers();
    try {
      const onDone = vi.fn();
      render(
        <ProfileProvider>
          <FirstShotCard onGoToSettings={vi.fn()} onDone={onDone} />
        </ProfileProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      // The ✓ shows and nothing has been dismissed yet.
      expect(onDone).not.toHaveBeenCalled();
      const button = screen.getByRole("button", { name: "Done" });
      expect(button).toHaveAttribute("aria-disabled", "true");
      // `aria-disabled`, not `disabled` — a disabled focused button blurs to
      // <body> for the whole beat.
      expect(button).not.toBeDisabled();
      // And the glyph stays out of the accessible name.
      expect(button).toHaveAccessibleName("Done");

      act(() => void vi.advanceTimersByTime(CONFIRM_MS));
      expect(onDone).not.toHaveBeenCalled();
      expect(
        document.querySelector(".first-shot-card--leaving"),
      ).not.toBeNull();

      act(() => void vi.advanceTimersByTime(SHEET_EXIT_MS));
      expect(onDone).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the dismissal when the card unmounts mid-beat", () => {
    // The beat owns what the card LOOKS like, never whether the press counted.
    // Home unmounts when you leave it, so a tab tap or a back swipe inside the
    // 440ms window used to clear the timer and lose the dismissal outright —
    // after the ✓ had already been shown, which is the app appearing to forget
    // something you watched it acknowledge.
    vi.useFakeTimers();
    try {
      const onDone = vi.fn();
      const { unmount } = render(
        <ProfileProvider>
          <FirstShotCard onGoToSettings={vi.fn()} onDone={onDone} />
        </ProfileProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Done" }));
      act(() => void vi.advanceTimersByTime(CONFIRM_MS));
      expect(onDone).not.toHaveBeenCalled();

      unmount();
      expect(onDone).toHaveBeenCalledTimes(1);

      // And the cleared timer stays cleared — no second call arrives late.
      act(() => void vi.advanceTimersByTime(SHEET_EXIT_MS * 4));
      expect(onDone).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not commit a dismissal nobody asked for", () => {
    // The mirror of the test above: unmounting for any OTHER reason — a shot
    // logged in another tab, an import arriving — must not dismiss the card.
    vi.useFakeTimers();
    try {
      const onDone = vi.fn();
      const { unmount } = render(
        <ProfileProvider>
          <FirstShotCard onGoToSettings={vi.fn()} onDone={onDone} />
        </ProfileProvider>,
      );
      unmount();
      expect(onDone).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("completes the beat across a parent re-render", () => {
    // `onDone` is an inline arrow at App's call site, so holding it as an effect
    // dependency re-armed the timer at its FULL duration every render — and
    // this card writes the profile on blur, which App consumes. The ✓ would sit
    // there indefinitely under a re-rendering parent.
    vi.useFakeTimers();
    try {
      const onDone = vi.fn();
      const Parent = ({ tick }: { tick: number }) => (
        <ProfileProvider>
          <FirstShotCard
            onGoToSettings={vi.fn()}
            onDone={() => onDone(tick)}
          />
        </ProfileProvider>
      );
      const { rerender } = render(<Parent tick={0} />);
      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      // Each render lands PART-WAY through a beat, which is the only placement
      // that can see the bug: re-arming a timer at its full duration is still
      // satisfied by a full-duration advance, so a render before the advance
      // proves nothing.
      act(() => void vi.advanceTimersByTime(CONFIRM_MS / 2));
      rerender(<Parent tick={1} />);
      act(() => void vi.advanceTimersByTime(CONFIRM_MS / 2));
      expect(
        document.querySelector(".first-shot-card--leaving"),
      ).not.toBeNull();

      act(() => void vi.advanceTimersByTime(SHEET_EXIT_MS / 2));
      rerender(<Parent tick={2} />);
      act(() => void vi.advanceTimersByTime(SHEET_EXIT_MS / 2));

      expect(onDone).toHaveBeenCalledTimes(1);
      // The LATEST callback ran, not the one captured when Done was pressed.
      expect(onDone).toHaveBeenCalledWith(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cannot be pressed twice into two dismissals", () => {
    vi.useFakeTimers();
    try {
      const onDone = vi.fn();
      render(
        <ProfileProvider>
          <FirstShotCard onGoToSettings={vi.fn()} onDone={onDone} />
        </ProfileProvider>,
      );
      const button = screen.getByRole("button", { name: "Done" });
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      // Two advances, not one: the exit timer is scheduled by the effect that
      // runs after the confirm timer's state update, so it does not exist yet
      // while the first is still being flushed.
      act(() => void vi.advanceTimersByTime(CONFIRM_MS));
      act(() => void vi.advanceTimersByTime(SHEET_EXIT_MS));
      expect(onDone).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks the whole card optional, in the element screen readers convey", () => {
    // The one word that decides whether someone feels obliged to fill any of
    // this in. <strong> rather than <em> because bold beats italics for
    // legibility — slanted shapes slow word recognition, worst for the readers
    // most likely to need the reassurance — and because <strong> carries
    // importance to a screen reader where <b> is styling only.
    render(
      <ProfileProvider>
        <FirstShotCard onGoToSettings={vi.fn()} onDone={vi.fn()} />
      </ProfileProvider>,
    );
    // One word. Emphasis is contrast, so bolding more of the sentence spends
    // it; "All" scopes the claim perfectly well unbolded beside it.
    const emphasised = screen.getByText("optional");
    expect(emphasised.tagName).toBe("STRONG");
    expect(emphasised.textContent).toBe("optional");
  });

  it("carries no caption under Done", () => {
    // It repeated the intro's "revisit anytime in Settings" and otherwise said
    // what a button labelled Done already means.
    render(
      <ProfileProvider>
        <FirstShotCard onGoToSettings={vi.fn()} onDone={vi.fn()} />
      </ProfileProvider>,
    );
    expect(screen.queryByText(/hides this card/i)).toBeNull();
  });
});
