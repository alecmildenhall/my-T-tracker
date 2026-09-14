// src/utils/intervalMessage.ts
import { MAX_INTERVAL_DAYS, MIN_INTERVAL_DAYS } from "../types/profile";

/** What is wrong with a typed interval, in words, or null when nothing is. */
export function intervalProblem(
  raw: string,
  unit: "day" | "week",
): string | null {
  const trimmed = raw.trim();
  if (trimmed === "")
    return `Enter how many ${unit}s, or pick a different option above.`;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return "That isn’t a number.";
  if (n <= 0) return `Shots need to be at least 1 ${unit} apart.`;
  if (!Number.isInteger(n)) {
    // The 3.5 case. The roadmap deferred this message until weekday sets
    // existed, because before them a twice-weekly user had nowhere to be sent —
    // "any copy written now is copy written to be deleted". They have somewhere
    // now, so it points there instead of only refusing.
    return unit === "day"
      ? "Whole days only. For twice a week, choose “On certain days” and pick two."
      : "Whole weeks only.";
  }
  const days = unit === "day" ? n : n * 7;
  if (days > MAX_INTERVAL_DAYS) return "That’s longer than a year apart.";
  if (days < MIN_INTERVAL_DAYS)
    return `Shots need to be at least 1 ${unit} apart.`;
  return null;
}

