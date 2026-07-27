import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JourneySettings } from "../JourneySettings";
import { ProfileProvider } from "../../context/ProfileContext";
import { STORAGE_KEYS } from "../../storageKeys";

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
  JSON.parse(localStorage.getItem(STORAGE_KEYS.profile) as string);

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

  it("allows a future start date (planning to start T later)", () => {
    renderPanel();
    // No `max` cap — a future date is a legitimate, planned start.
    expect(dateInput().getAttribute("max")).toBeNull();
    fireEvent.change(dateInput(), { target: { value: "2099-01-01" } });
    expect(stored()).toEqual({ startDate: "2099-01-01" });
  });

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
