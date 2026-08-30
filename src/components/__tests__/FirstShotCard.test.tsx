import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FirstShotCard } from "../FirstShotCard";
import { ProfileProvider } from "../../context/ProfileContext";
import { STORAGE_KEYS } from "../../storageKeys";
import { expectVisibleFocusRing } from "../../test/focusRing";

beforeEach(() => localStorage.clear());

const seedProfile = (profile: Record<string, unknown>) =>
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));

const storedProfile = () =>
  JSON.parse(localStorage.getItem(STORAGE_KEYS.profile) ?? "{}");

const renderCard = () =>
  render(
    <ProfileProvider>
      <FirstShotCard onGoToSettings={vi.fn()} />
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

    const interval = screen.getByPlaceholderText(
      "Every ___ days",
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
    const box = screen.getByPlaceholderText(
      "Every ___ days",
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
    const box = screen.getByPlaceholderText(
      "Every ___ days",
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
