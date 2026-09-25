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
 * What may be asked about a shot, given the gap and what that shot already holds.
 *
 * MODE-AGNOSTIC, and that is the point of it existing. The form used to ask
 * `previousShotQuestions` while logging and offer all four unconditionally
 * while editing, on the reasoning that opening a saved shot is a deliberate
 * trip made to record how it went. Sound for a shot from weeks ago, and it
 * never covered the case that broke: log a shot, tap Edit on it, and the sheet
 * asked how long an injection given hours earlier had been sore — offering "a
 * week or more" — while the edit write-back stored whatever was tapped.
 *
 * The floor is a fact about elapsed time, not about which screen you came from.
 * One computation fed by the gap, so the two modes cannot drift apart again.
 *
 * The stored answers are folded in here for the same reason: they were a second
 * expansion living in the component, and the two rules only make sense read
 * together. An answer already on record is always offerable — the gate exists
 * to stop someone GUESSING what the days cannot settle, and has nothing to say
 * about one they already gave.
 *
 * THAT RULE USED TO STOP SHORT OF ITS OWN REASONING, and the earlier version of
 * this comment defended the gap: adding a stored answer to an EMPTY set was
 * called "a different decision", on the grounds that it would resurrect the
 * block where it is withheld on purpose. Withholding the QUESTION is the
 * decision; hiding an answer already given is not, and the two had been
 * collapsed into one `length === 0` check.
 *
 * What that cost: `settledQuestions(40, "week-plus")` returned nothing, so a
 * stored answer on a shot past the stale bound rendered no chips and no Clear
 * while History and the CSV went on showing it — uncorrectable, by any route in
 * the app. Same for a same-day second shot, and for a stored soreness answer at
 * a gap of 1–2 days where only the lump group renders. Before the restructure
 * that collapsed the modes, edit mode offered all four unconditionally and
 * could fix it; the restructure fixed the worse bug (guessing about a shot
 * logged hours ago) and silently took that with it.
 *
 * So: the gap decides what may be ASKED, and the record decides what must
 * remain EDITABLE. When the gap withholds everything but something is on
 * record, the full vocabulary is offered — correcting a mistap is not guessing,
 * and offering only the stored value would make a one-tap fix a
 * clear-and-retype. When the gap asks for something, the stored answer is added
 * to what it asks, exactly as before.
 *
 * The LUMP answer is a parameter for the same reason and not an afterthought:
 * it was frozen by the identical branch, and "on record means editable" is one
 * rule or it is nothing.
 */
export function settledQuestions(
  gapDays: number | null,
  stored: SorenessDuration | "",
  storedLumpAnswer: "" | "yes" | "no" = "",
): { durations: SorenessDuration[]; lump: boolean } {
  const asked = previousShotQuestions(gapDays);
  if (asked.durations.length === 0) {
    // Nothing asked and nothing on record: genuinely nothing to show. This is
    // the case the floor and the stale bound exist for, and it is untouched.
    if (stored === "" && storedLumpAnswer === "") return asked;
    return {
      // Only when a soreness answer is actually on record. A stored LUMP answer
      // must not conjure a duration group the gap cannot settle and nobody
      // filled in — that would be the guessing this gate exists to prevent.
      durations: stored === "" ? asked.durations : [...SORENESS_DURATIONS],
      lump: asked.lump || storedLumpAnswer !== "",
    };
  }
  if (stored === "" || asked.durations.includes(stored)) {
    return { ...asked, lump: asked.lump || storedLumpAnswer !== "" };
  }
  return {
    durations: SORENESS_DURATIONS.filter(
      (d) => asked.durations.includes(d) || d === stored,
    ),
    lump: asked.lump || storedLumpAnswer !== "",
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
