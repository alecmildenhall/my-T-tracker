// src/utils/greeting.ts
// Resolves the single message for the log-view greeting slot. Pure and civil-date
// based (today passed in) so it's fully unit-testable. Priority, highest first:
//
//   1. milestone   — a celebration is active (see currentMilestone)
//   2. first-time  — no shots logged yet (brand-new user)
//   3. returning   — everyday greeting
//
// Every state is name-optional: the preferred name only personalises the copy, it
// is never required. Punctuation carries the tone (celebratory "!", warm "~" / ":)")
// deliberately no emoji: it renders as a missing-glyph box on systems without an
// emoji font, so the copy stays plain text that renders identically everywhere.
import type { Profile } from "../types/profile";
import { currentMilestone } from "./milestones";
import { todayLocalISO } from "./datetime";

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
  today: string = todayLocalISO()
): string {
  const name = profile.preferredName;

  const milestone = currentMilestone(profile.startDate, today);
  if (milestone) {
    return name
      ? `Congrats on ${milestone.label} on T, ${name}!`
      : `Congrats on ${milestone.label} on T!`;
  }

  if (!hasLoggedShots) {
    return name ? `Welcome, ${name} :)` : "Welcome :)";
  }

  return name ? `Hi, ${name}~` : "Hi there~";
}
