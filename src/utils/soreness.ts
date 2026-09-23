// src/utils/soreness.ts
import { SORENESS_DURATIONS } from "../types/shot";
import type { SorenessDuration } from "../types/shot";

/**
 * Only offer an answer that is already true or false.
 *
 * Every duration needs a certain amount of time to have passed before anyone
 * can judge it, and they all clear the same bar: three days. "Not sore" is not
 * safe on day 1 (soreness can start on day 2), and "a day or two" cannot be
 * known until day 3 either. Below that the duration question is not asked at
 * all — an answer that cannot yet be true is worse than a coarse one, because
 * it gets skipped or guessed, and a guess charts as confidently as a fact.
 */
export const SORENESS_FLOOR_DAYS = 3;

/** Past this, the recall is not worth the field. */
export const SORENESS_STALE_DAYS = 28;

/** The gap at which "a week or more" becomes answerable. */
const WEEK = 7;

/**
 * What the log form may ask about the previous shot, given the gap in days.
 *
 * The LUMP question has no floor: "is there a lump now?" is present tense and
 * answerable on any day, so a short cadence still gets asked that one alone.
 */
export function previousShotQuestions(gapDays: number | null): {
  durations: SorenessDuration[];
  lump: boolean;
} {
  if (gapDays === null || gapDays > SORENESS_STALE_DAYS) {
    return { durations: [], lump: false };
  }
  // A SAME-DAY second shot is asked nothing at all. The lump question is
  // present tense, which is why it has no three-day floor — but "has it
  // absorbed?" about a depot injected hours ago answers itself, and "yes"
  // would chart as a finding rather than as the non-event it is. A split dose
  // is a real protocol, so this is reachable rather than theoretical.
  if (gapDays < 1) return { durations: [], lump: false };
  if (gapDays < SORENESS_FLOOR_DAYS) return { durations: [], lump: true };
  return {
    durations: SORENESS_DURATIONS.filter(
      (d) => d !== "week-plus" || gapDays >= WEEK,
    ),
    lump: true,
  };
}

/**
 * In the group, under the question that supplies the frame ("How long was it
 * sore?"). Short because the question already said what is being measured.
 */
const SHORT: Record<SorenessDuration, string> = {
  none: "Not sore",
  "day-or-two": "A day or two",
  "several-days": "Several days",
  "week-plus": "A week or more",
};

/**
 * Standing ALONE — a History row, a CSV cell — where "Several days" on its own
 * says several days of what. Two functions rather than one for the same reason
 * `offDaysLabel` and `offDaysShortLabel` are two.
 */
const STANDALONE: Record<SorenessDuration, string> = {
  none: "Not sore",
  "day-or-two": "Sore a day or two",
  "several-days": "Sore several days",
  "week-plus": "Sore a week or more",
};

export const sorenessShortLabel = (v: SorenessDuration): string => SHORT[v];
export const sorenessLabel = (v: SorenessDuration): string => STANDALONE[v];

/** The row/CSV summary of both answers, or null when neither was given. */
export function settledSummary(
  soreness: SorenessDuration | undefined,
  lump: boolean | undefined,
): string | null {
  const parts: string[] = [];
  if (soreness !== undefined) parts.push(STANDALONE[soreness]);
  if (typeof lump === "boolean") parts.push(lump ? "lump" : "no lump");
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The form's view of what a shot already has on record.
 *
 * The block seeds from these, which is what makes a cleared answer mean
 * something: without seeding, "the user did not touch this question" and "the
 * user cleared it" both arrive as `undefined`, and the store cannot tell them
 * apart — so answering one question wiped the other one's stored answer, and
 * nothing on screen ever showed that an answer existed to lose.
 */
export function storedSoreness(
  shot: { afterSoreness?: SorenessDuration } | null | undefined,
): SorenessDuration | "" {
  const value = shot?.afterSoreness;
  return value !== undefined && SORENESS_DURATIONS.includes(value) ? value : "";
}

export function storedLump(
  shot: { afterLump?: boolean } | null | undefined,
): "" | "yes" | "no" {
  if (typeof shot?.afterLump !== "boolean") return "";
  return shot.afterLump ? "yes" : "no";
}
