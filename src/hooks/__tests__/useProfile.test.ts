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
      })
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
      JSON.stringify({ startDate: "", preferredName: "Lou", theme: "dark" })
    );
    const { result } = renderHook(() => useProfile());
    expect(result.current.profile).toEqual({ preferredName: "Lou", theme: "dark" });
  });

  it("keeps unknown fields when updating a known one", () => {
    localStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify({ theme: "dark" })
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
      })
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
      JSON.stringify({ startDate: "2025-01-15", preferredName: "Lou" })
    );
    const { result } = renderHook(() => useProfile());
    act(() => result.current.replaceProfile({}));
    expect(result.current.profile).toEqual({});
    expect(stored()).toEqual({});
  });

  it("replaceProfile drops a blank field rather than storing it", () => {
    const { result } = renderHook(() => useProfile());
    act(() =>
      result.current.replaceProfile({ startDate: "2025-01-15", preferredName: "  " })
    );
    expect(result.current.profile).toEqual({ startDate: "2025-01-15" });
  });
});
