// src/utils/id.ts
/**
 * Generate a locally-unique id for a shot.
 *
 * String ids are required — they're generated on-device with no server to hand
 * out sequential numbers, and they keep records collision-free across the
 * planned offline/multi-device sync (see ShotEntry).
 *
 * Prefers a real UUID via the Web Crypto API. That's only available in a secure
 * context (https/localhost), so the fallback adds a random suffix to the
 * timestamp — otherwise two shots logged in the same millisecond could collide.
 */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `shot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
