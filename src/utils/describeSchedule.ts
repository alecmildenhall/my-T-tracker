// src/utils/describeSchedule.ts
import { WEEKDAYS, weekdayLabel } from "./weekday";
import type { Weekday } from "./weekday";

/**
 * The user's weekly rhythm as a sentence, or null when there is nothing to say.
 *
 * This exists because the weekly rhythm is the one place the control holds two
 * facts at once — which days are on, and a number whose unit is WEEKS while
 * storage is days. Typing `2` and reading "every other week" is what stops that
 * unit being misread, which it has been before: the interval box once showed a
 * placeholder saying "2 weeks" while quietly holding 14.
 *
 * Deliberately NOT written for the other two rhythms. "Every 10 days" and "not
 * tracking" already say themselves on screen, and echoing them would spend the
 * app's success colour on a non-event.
 *
 * One day reads as a habit and gets its full name — "Tuesdays" — because
 * abbreviating produces "Tues" and "Mons". Several read as a list, where the
 * short forms keep the line on one row at 320px.
 */
export function describeWeeklySchedule(
  shotDays: Weekday[],
  intervalDays: number | undefined,
): string | null {
  const days = WEEKDAYS.filter((d) => shotDays.includes(d));
  if (days.length === 0) return null;
  if (typeof intervalDays !== "number" || intervalDays % 7 !== 0) return null;
  const weeks = intervalDays / 7;
  if (weeks < 1) return null;

  const names =
    days.length === 1
      ? `${weekdayLabel(days[0])}s`
      : `${days.slice(0, -1).map(shortLabel).join(", ")} & ${shortLabel(
          days[days.length - 1],
        )}`;

  // "every other week" rather than "every 2 weeks": it is how people say it,
  // and it cannot be misread as a count of shots.
  const every =
    weeks === 1 ? "every week" : weeks === 2 ? "every other week" : `every ${weeks} weeks`;
  return `${names}, ${every}.`;
}

function shortLabel(day: Weekday): string {
  return weekdayLabel(day).slice(0, 3);
}
