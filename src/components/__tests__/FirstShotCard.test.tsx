import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FirstShotCard } from "../FirstShotCard";
import { ProfileProvider } from "../../context/ProfileContext";
import { STORAGE_KEYS } from "../../storageKeys";

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
  });
});
