// src/utils/greeting.ts
// Resolves the single message for the log-view greeting slot. Pure and civil-date
// based (today passed in) so it's fully unit-testable. Priority, highest first:
//
//   1. milestone   — a celebration is active (see currentMilestone)
//   2. shot day    — today is the user's chosen shot-day weekday
//   3. first-time  — no shots logged yet (brand-new user)
//   4. returning   — everyday greeting
//
// A milestone deliberately outranks shot day: it's the rarer, bigger landmark, so
// on the rare day both land the milestone eclipses the weekly shot-day nudge. Shot
// day is fully optional — with no shotDay set there is no shot-day greeting at all
// (we never guess a day from logged shots).
//
// Every state is name-optional: the preferred name only personalises the copy, it
// is never required. Punctuation carries the tone (celebratory "!", warm "~" / ":)")
// deliberately no emoji: it renders as a missing-glyph box on systems without an
// emoji font, so the copy stays plain text that renders identically everywhere.
import type { Profile } from "../types/profile";
import { currentMilestone } from "./milestones";
import { todayLocalISO } from "./datetime";
import { toCivilDate, type CivilDate } from "./civilDate";
import { weekdayOf } from "./weekday";

/**
 * The greeting to show right now. `hasLoggedShots` distinguishes a brand-new user
 * (welcome) from a returning one; a milestone outranks both so a first-day
 * anniversary still gets the full celebration. `today` defaults to today's local
 * date.
 *
 * The preferred name is already normalized to non-blank-or-absent at the profile
 * boundary (useProfile's normalizeKnownFields, via isBlank, on read/write/import),
 * so a plain falsy check suffices here and `""`/undefined fall through to the
 * no-name copy. We deliberately do NOT re-run nonBlankString on it — that boundary
 * owns the rule, and re-checking would be redundant double-sanitization.
 */
export function resolveGreeting(
  profile: Profile,
  hasLoggedShots: boolean,
  today: CivilDate = todayLocalISO()
): string {
  const name = profile.preferredName;

  // Parse the untrusted stored start date once, here at the boundary. A missing
  // or (from a hand-edit) impossible value becomes undefined, so the milestone
  // engine only ever sees a real CivilDate — no re-validation downstream.
  const startDate = profile.startDate
    ? toCivilDate(profile.startDate) ?? undefined
    : undefined;
  const milestone = currentMilestone(startDate, today);
  if (milestone) {
    return name
      ? `Congrats on ${milestone.label} on T, ${name}!`
      : `Congrats on ${milestone.label} on T!`;
  }

  if (profile.shotDay && weekdayOf(today) === profile.shotDay) {
    return name ? `Happy shot day, ${name}!` : "Happy shot day!";
  }

  if (!hasLoggedShots) {
    return name ? `Welcome, ${name} :)` : "Welcome :)";
  }

  return name ? `Hi, ${name}~` : "Hi there~";
}
