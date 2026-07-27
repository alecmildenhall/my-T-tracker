import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Greeting } from "../Greeting";
import { ShotsProvider } from "../../context/ShotsContext";
import { ProfileProvider } from "../../context/ProfileContext";
import { STORAGE_KEYS } from "../../storageKeys";
import type { ShotEntry } from "../../types/shot";

// Greeting reads both stores from context, so mount it under both providers.
const renderGreeting = () =>
  render(
    <ShotsProvider>
      <ProfileProvider>
        <Greeting />
      </ProfileProvider>
    </ShotsProvider>
  );

const seedProfile = (p: Record<string, unknown>) =>
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(p));
const seedShots = (shots: ShotEntry[]) =>
  localStorage.setItem(STORAGE_KEYS.shots, JSON.stringify(shots));

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe("Greeting", () => {
  it("welcomes a brand-new user (no name, no shots)", () => {
    renderGreeting();
    expect(screen.getByText("Welcome :)")).toBeInTheDocument();
  });

  it("greets a returning user by name", () => {
    seedProfile({ preferredName: "Lou" });
    seedShots([{ id: "s1", date: "2026-06-01" }]);
    renderGreeting();
    expect(screen.getByText("Hi, Lou~")).toBeInTheDocument();
  });

  it("renders as a paragraph with the greeting class (not a heading)", () => {
    renderGreeting();
    const el = screen.getByText("Welcome :)");
    expect(el.tagName).toBe("P");
    expect(el).toHaveClass("greeting");
  });

  it("celebrates a milestone based on the mount-time date", () => {
    // The component snapshots today at mount (useState lazy init). With the clock
    // on the 1-year anniversary, a matching start date must surface the milestone
    // greeting — and outrank the returning greeting even though shots exist.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00")); // local noon, TZ-safe
    seedProfile({ preferredName: "Lou", startDate: "2025-07-26" });
    seedShots([{ id: "s1", date: "2026-06-01" }]);
    renderGreeting();
    expect(
      screen.getByText("Congrats on 1 year on T, Lou!")
    ).toBeInTheDocument();
  });

  it("renders no non-ASCII glyph (guards against emoji tofu) even for a milestone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00"));
    seedProfile({ preferredName: "Lou", startDate: "2025-07-26" });
    renderGreeting();
    const el = document.querySelector(".greeting");
    // eslint-disable-next-line no-control-regex
    expect(el?.textContent).toMatch(/^[\x00-\x7F]*$/);
  });
});
