import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FirstShotCard } from "../FirstShotCard";
import { ProfileProvider } from "../../context/ProfileContext";
import { STORAGE_KEYS } from "../../storageKeys";
import { expectVisibleFocusRing } from "../../test/focusRing";
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
  it("does not delete a stored start date when the field is left empty", () => {
    // An empty date input cannot separate "I cleared this" from "I am retyping
    // and the segments are incomplete" — both report "". Blur does not
    // distinguish them, it picks one, and this card picked the destructive one:
    // the milestone base gone, with no undo and no "Remove start date" control
    // here to have meant it with. The identical field in Settings already
    // refused exactly this, in a comment, and the two disagreed.
    seedProfile({ startDate: "2024-03-15" });
    renderCard();

    fireEvent.change(startField(), { target: { value: "" } });
    fireEvent.blur(startField());

    expect(storedProfile().startDate).toBe("2024-03-15");
    // And the field shows what is actually stored, rather than a blank the
    // profile does not agree with.
    expect(startField().value).toBe("2024-03-15");
  });

  it("still saves a real date typed into the field", () => {
    renderCard();

    fireEvent.change(startField(), { target: { value: "2025-06-01" } });
    fireEvent.blur(startField());

    expect(storedProfile().startDate).toBe("2025-06-01");
  });

  it("restores the stored value when the field holds a non-date", () => {
    // Note it is 30 February and not year 0202: a start date is deliberately
    // UNBOUNDED — it is a fact about someone's life and the app has no standing
    // to call it too long ago — so `0202-03-15` is accepted here on purpose,
    // unlike a shot date. Only something the calendar rejects is restored.
    seedProfile({ startDate: "2024-03-15" });
    renderCard();

    fireEvent.change(startField(), { target: { value: "2024-02-30" } });
    fireEvent.blur(startField());

    expect(storedProfile().startDate).toBe("2024-03-15");
    expect(startField().value).toBe("2024-03-15");
  });
});

describe("FirstShotCard — the interval's unit", () => {
  const box = () =>
    screen.getByLabelText("Or every how many days?") as HTMLInputElement;

  it("shows the unit beside the box, where it cannot disappear", () => {
    // It lived only in the placeholder, which goes the moment a chip or a
    // keystroke fills the box — screenshotted on a phone showing a bare "2".
    renderCard();
    expect(document.querySelector(".first-shot-card__unit")!.textContent).toBe(
      "days",
    );
    expect(box().placeholder).toBe("");
  });

  it("still shows it once a quick pick has filled the box", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "2 weeks" }));
    expect(box().value).toBe("14");
    expect(document.querySelector(".first-shot-card__unit")!.textContent).toBe(
      "days",
    );
  });

  it("keeps the unit out of the accessible name", () => {
    // The unit is NOT inside a wrapping <label>, deliberately. When it was, the
    // name computed as "Or every how many days? days" — the duplication that
    // `aria-hidden` is meant to prevent, except the name comes from the label's
    // contents and tools disagree about honouring it there. Associating the
    // label by id puts the unit outside it however that is computed.
    renderCard();
    expect(box()).toHaveAccessibleName("Or every how many days?");
    expect(
      document.querySelector(".first-shot-card__unit")!.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("leaves the group heading unit-neutral, because it covers the chips too", () => {
    // Unlike the Settings copy, where the label is tied to the input alone. Here
    // the heading sits above chips in WEEKS and a box in DAYS, so naming either
    // unit in it would be wrong for the other.
    renderCard();
    expect(
      screen.getByText("How often do you take it?"),
    ).toBeInTheDocument();
  });
});

describe("FirstShotCard — the disabled shot day", () => {
  const notice = () => screen.getByText(/No shot day with a non-weekly/);

  it("explains itself to assistive tech, not just on screen", () => {
    seedProfile({ shotDay: "wednesday", intervalDays: 10 });
    renderCard();

    const select = screen.getByLabelText(
      "Which day do you usually take it?",
    ) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    // Without this a screen reader announces "disabled" and no reason — the one
    // part of the sentence a sighted user gets for free.
    expect(select.getAttribute("aria-describedby")).toContain(
      "first-shot-day-notice",
    );
    expect(notice()).toHaveAttribute("id", "first-shot-day-notice");
  });

  it("hands focus to the notice, never into the number input", () => {
    // The select disables under whatever focus it holds, and the hand-off used
    // to land in the interval box — a number input, which re-raises the numeric
    // keyboard on a phone. The notice is silent and is the sentence explaining
    // why the control went away, which is what should be announced anyway.
    seedProfile({ shotDay: "wednesday", intervalDays: 7 });
    renderCard();

    const interval = screen.getByLabelText(
      "Or every how many days?",
    ) as HTMLInputElement;
    fireEvent.change(interval, { target: { value: "10" } });
    fireEvent.blur(interval);

    expect(document.activeElement).toBe(notice());
    expect(document.activeElement).not.toBe(interval);
    // Landing correctly is half of it. Focus that moves with nothing on screen
    // changing is one of slice B's nine defects (WCAG 2.4.7), and this target
    // was relying on the browser's own ring rather than the app's — found in a
    // browser pass, because a rule existing and a rule painting are different
    // questions and only this half is answerable here.
    expectVisibleFocusRing("shot day disabled by a non-weekly interval");
  });
});

describe("FirstShotCard — the cadence that tracks nothing", () => {
  const needNotice = () => screen.queryByText(/a weekly rhythm needs one/i);

  it("says so when a weekly interval has no shot day", () => {
    // scheduleMode returns "none" for this, so no shot ever gets a planned
    // date — and it was the only silent one. The non-weekly case has always
    // explained itself ("a weekday can't describe every 10 days"), while this,
    // the commoner of the two, said nothing. Because a planned date freezes at
    // save time, every shot logged during the silence stays unmeasurable.
    seedProfile({ intervalDays: 7 });
    renderCard();
    expect(needNotice()).not.toBeNull();
  });

  it("says nothing once a day is set, or when the interval is non-weekly", () => {
    seedProfile({ intervalDays: 7, shotDay: "wednesday" });
    const first = renderCard();
    expect(needNotice()).toBeNull();
    first.unmount();

    // Non-weekly has its own notice; this one must not double up.
    seedProfile({ intervalDays: 10 });
    renderCard();
    expect(needNotice()).toBeNull();
  });
});

describe("FirstShotCard — drafts follow the profile", () => {
  it("does not write a stale draft over a profile changed elsewhere", () => {
    // `useLocalStorage` listens for cross-tab `storage` events, so the profile
    // can change under this card. Without a sync the drafts keep their
    // mount-time values and then WIN, because every exit commits them —
    // including logging the first shot, which unmounts the card. An empty
    // interval draft would call setIntervalDays(undefined) and delete both the
    // cadence and the schedule anchor another tab had just set.
    renderCard(); // mounts with an empty interval draft
    const box = screen.getByLabelText(
      "Or every how many days?",
    ) as HTMLInputElement;
    expect(box.value).toBe("");

    // Another tab writes a cadence, and the store broadcasts it.
    act(() => {
      localStorage.setItem(
        STORAGE_KEYS.profile,
        JSON.stringify({ intervalDays: 14, scheduleAnchor: "2026-08-05" }),
      );
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEYS.profile,
          newValue: localStorage.getItem(STORAGE_KEYS.profile),
          // The hook filters on storageArea, so a synthetic event without it is
          // silently ignored — the listener is real, the event was not.
          storageArea: localStorage,
        }),
      );
    });

    expect(box.value).toBe("14");
    // And the commit on the way out agrees with it rather than clearing it.
    fireEvent.blur(box);
    expect(storedProfile().intervalDays).toBe(14);
    expect(storedProfile().scheduleAnchor).toBe("2026-08-05");
  });

  it("keeps the cadence when the interval box holds unparseable text", () => {
    // A number input reports "" for anything it cannot parse — "1e", "-",
    // "1.2.3" — not just for empty. Reading that as a deliberate clear meant a
    // fumbled keystroke plus a blur deleted the cadence. `validity.badInput`
    // separates the two; jsdom does not implement it, so the flag is passed in
    // explicitly here the way the real blur handler passes it.
    seedProfile({ intervalDays: 14 });
    renderCard();
    const box = screen.getByLabelText(
      "Or every how many days?",
    ) as HTMLInputElement;
    expect(box.value).toBe("14");

    fireEvent.change(box, { target: { value: "" } });
    // `validity` is a read-only getter, so it cannot be passed through the
    // event — it has to be defined on the element, which is also closer to what
    // the browser does. jsdom does not implement badInput, so the real one is
    // always false here and only a browser exercises the true branch.
    Object.defineProperty(box, "validity", {
      value: { badInput: true },
      configurable: true,
    });
    fireEvent.blur(box);

    expect(storedProfile().intervalDays).toBe(14);
    expect(box.value).toBe("14");
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
