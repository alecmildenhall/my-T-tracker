import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProfile } from "../useProfile";
import { STORAGE_KEYS } from "../../storageKeys";

beforeEach(() => localStorage.clear());

const stored = () =>
  JSON.parse(localStorage.getItem(STORAGE_KEYS.profile) as string);

describe("useProfile", () => {
  it("defaults to an empty profile", () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current.profile).toEqual({});
  });

  it("sets and persists the start date", () => {
    const { result } = renderHook(() => useProfile());
    act(() => result.current.setStartDate("2025-01-15"));
    expect(result.current.profile.startDate).toBe("2025-01-15");
    expect(stored()).toEqual({ startDate: "2025-01-15" });
  });

  it("sets and persists a preferred name, keeping internal spaces", () => {
    const { result } = renderHook(() => useProfile());
    act(() => result.current.setPreferredName("Lou Smith"));
    expect(result.current.profile.preferredName).toBe("Lou Smith");
  });

  it("clearing a field removes it (never stored as an empty string)", () => {
    const { result } = renderHook(() => useProfile());
    act(() =>
      result.current.updateProfile({
        startDate: "2025-01-15",
        preferredName: "Lou",
      }),
    );

    act(() => result.current.setPreferredName(""));
    expect(result.current.profile).toEqual({ startDate: "2025-01-15" });

    act(() => result.current.setStartDate(undefined));
    expect(result.current.profile).toEqual({});
    expect(stored()).toEqual({});
  });

  it("treats a whitespace-only value as unset", () => {
    const { result } = renderHook(() => useProfile());
    act(() => result.current.setPreferredName("   "));
    expect(result.current.profile.preferredName).toBeUndefined();
  });

  it("sets, persists, and clears the shot day", () => {
    const { result } = renderHook(() => useProfile());
    act(() => result.current.setSchedule({ shotDays: ["wednesday"] }));
    expect(result.current.profile.shotDays).toEqual(["wednesday"]);
    expect(stored()).toEqual({ shotDays: ["wednesday"] });
    act(() => result.current.setSchedule({ shotDays: undefined }));
    expect(result.current.profile.shotDays).toBeUndefined();
  });

  it("drops an invalid shot day from storage (enum, not free text)", () => {
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ shotDay: "someday", preferredName: "Lou" }),
    );
    const { result } = renderHook(() => useProfile());
    expect(result.current.profile).toEqual({ preferredName: "Lou" });
  });

  it("coerces a corrupt (non-object) stored value to empty", () => {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify("nope"));
    const { result } = renderHook(() => useProfile());
    expect(result.current.profile).toEqual({});
  });

  it("drops blank known fields but preserves unknown ones (forward-compat)", () => {
    // startDate is blank -> dropped; preferredName kept; a field a future build
    // might add (theme) is preserved rather than stripped on read/rewrite.
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: "", preferredName: "Lou", theme: "dark" }),
    );
    const { result } = renderHook(() => useProfile());
    expect(result.current.profile).toEqual({
      preferredName: "Lou",
      theme: "dark",
    });
  });

  it("keeps unknown fields when updating a known one", () => {
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ theme: "dark" }),
    );
    const { result } = renderHook(() => useProfile());
    act(() => result.current.setStartDate("2025-03-01"));
    expect(stored()).toEqual({ theme: "dark", startDate: "2025-03-01" });
  });

  it("falls back to empty on malformed JSON", () => {
    localStorage.setItem(STORAGE_KEYS.profile, "{ not json");
    const { result } = renderHook(() => useProfile());
    expect(result.current.profile).toEqual({});
  });

  it("replaceProfile overwrites the whole profile (backup restore)", () => {
    const { result } = renderHook(() => useProfile());
    act(() => result.current.setPreferredName("Old Name"));
    act(() =>
      result.current.replaceProfile({
        startDate: "2024-03-01",
        preferredName: "New Name",
      }),
    );
    expect(result.current.profile).toEqual({
      startDate: "2024-03-01",
      preferredName: "New Name",
    });
    expect(stored()).toEqual({
      startDate: "2024-03-01",
      preferredName: "New Name",
    });
  });

  it("replaceProfile with {} clears an existing profile", () => {
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ startDate: "2025-01-15", preferredName: "Lou" }),
    );
    const { result } = renderHook(() => useProfile());
    act(() => result.current.replaceProfile({}));
    expect(result.current.profile).toEqual({});
    expect(stored()).toEqual({});
  });

  it("replaceProfile drops a blank field rather than storing it", () => {
    const { result } = renderHook(() => useProfile());
    act(() =>
      result.current.replaceProfile({
        startDate: "2025-01-15",
        preferredName: "  ",
      }),
    );
    expect(result.current.profile).toEqual({ startDate: "2025-01-15" });
  });
});

describe("useProfile — re-declaring the schedule clears its anchor", () => {
  // The anchor is frozen against ACCIDENTAL movement — backdating a remembered
  // shot, deleting the oldest one — and not against the user. Changing either
  // half of the cadence is a deliberate re-declaration, so it repoints.
  //
  // Without this, a weekly user switching to fortnightly kept a grid on the old
  // phase and every fortnightly shot read "taken 7 days before", forever and
  // frozen — and it could not be repaired, since re-picking a shot day
  // re-derives from the earliest shot, which is still on the old phase.
  it("clears it when the shot day changes", () => {
    const { result } = renderHook(() => useProfile());
    act(() => result.current.setScheduleAnchor("2026-08-05"));
    expect(result.current.profile.scheduleAnchor).toBe("2026-08-05");

    act(() => result.current.setSchedule({ shotDays: ["friday"] }));
    expect(result.current.profile.scheduleAnchor).toBeUndefined();
    expect(result.current.profile.shotDays).toEqual(["friday"]);
  });

  it("clears it when the interval changes", () => {
    const { result } = renderHook(() => useProfile());
    act(() => result.current.setScheduleAnchor("2026-08-05"));

    act(() => result.current.setSchedule({ intervalDays: 14 }));
    expect(result.current.profile.scheduleAnchor).toBeUndefined();
    expect(result.current.profile.intervalDays).toBe(14);
  });
});
