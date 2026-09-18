// src/components/CadencePicker.tsx
import React, { useLayoutEffect, useRef, useState } from "react";
import { WEEKDAYS, weekdayLabel } from "../utils/weekday";
import type { Weekday } from "../utils/weekday";
import { MAX_INTERVAL_DAYS, isValidIntervalDays } from "../types/profile";
import type { Profile, ScheduleMode } from "../types/profile";
import { describeWeeklySchedule } from "../utils/describeSchedule";
import { intervalProblem } from "../utils/intervalMessage";

/**
 * "How do you time your shots?" — the whole cadence setting, in one component
 * used by both the first-run card and Settings.
 *
 * Shared rather than written twice, and that is not tidiness. These two
 * surfaces have already drifted apart once on an identical question (the
 * optional start date, where blur and the escape hatch answered an emptied
 * field opposite ways) and the fix was to give the decision one home. This is
 * the same shape with more moving parts, so it gets the same treatment up
 * front.
 *
 * Three named rhythms rather than two fields that switch each other off. The
 * mode is a stored answer, so every state is something the user picked —
 * including not tracking, which would otherwise be an absence indistinguishable
 * from a form nobody filled in.
 *
 * NOTHING is pre-selected. A default rhythm is the frozen-value harm the
 * roadmap already rules out for `intervalDays`, with a weekday attached: press
 * Done without noticing and every later shot is measured against a schedule you
 * never chose, unrepairably, because lateness freezes at log time.
 */
export interface CadencePickerProps {
  /** Namespaces ids and the radio group, so two instances never collide. */
  idPrefix: string;
  profile: Pick<Profile, "shotDays" | "intervalDays" | "scheduleMode">;
  onChange: (patch: Partial<Profile>) => void;
}

/**
 * Whether two day sets hold the same days — BY VALUE, never by identity.
 *
 * `normalizeKnownFields` rebuilds this array on every profile write
 * (`[...new Set(...)]`), so a reference check called every unrelated write an
 * external change. Measured against the real store: select a rhythm, type 2 in
 * the weeks box, tap a day — the box emptied and nothing was stored. On iOS
 * that is the ordinary path, since Safari does not focus a <button> on tap, so
 * no blur fires and the typed value has not been committed yet.
 *
 * The unit tests could not see it: their harness merges patches with
 * `{...prev, ...patch}`, which preserves array identity where the real store
 * does not. A stand-in for the store that differs in the one dimension the code
 * depends on — the proxy shape this project keeps paying for.
 *
 * Order-insensitive on purpose. Stored sets are canonically ordered, so this
 * only matters for a hand-edited file, where "same days, different order" is
 * still the same schedule and re-syncing would discard typing for nothing.
 */
function sameDays(a: Weekday[] | undefined, b: Weekday[] | undefined): boolean {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && x.every((d) => y.includes(d));
}

/** The number the box shows for a stored interval, in the unit of the mode. */
function draftFor(mode: ScheduleMode | undefined, intervalDays?: number) {
  if (!isValidIntervalDays(intervalDays)) return "";
  if (mode !== "grid") return String(intervalDays);
  // Weeks only when the stored value divides cleanly. A 10-day interval carried
  // in from the rolling rhythm is not 1.43 weeks; the box starts empty and asks.
  return intervalDays % 7 === 0 ? String(intervalDays / 7) : "";
}

export function CadencePicker({
  idPrefix,
  profile,
  onChange,
}: CadencePickerProps) {
  const [mode, setMode] = useState<ScheduleMode | undefined>(
    profile.scheduleMode,
  );
  const [days, setDays] = useState<Weekday[]>(profile.shotDays ?? []);
  const [numDraft, setNumDraft] = useState(() =>
    draftFor(profile.scheduleMode, profile.intervalDays),
  );
  const numRef = useRef<HTMLInputElement>(null);

  /**
   * An error only once the field has been TOUCHED.
   *
   * Selecting a rhythm reveals an empty box, and reporting "Enter how many
   * weeks" on it instantly puts `role="alert"` and `aria-invalid` on a field
   * nobody has typed in — announcing a failure for not having answered yet. The
   * empty branch of `intervalProblem` is a prompt, not a validation result.
   */
  const [touched, setTouched] = useState(false);

  /**
   * Follow the profile when it changes from OUTSIDE this control, which both
   * implementations this replaced did and I dropped.
   *
   * Not cosmetic. `useLocalStorage` subscribes to cross-tab `storage` events,
   * and DataManagement — which restores a backup over the whole profile —
   * renders on this very screen. Without this the control kept showing the old
   * cadence, and worse, the unmount commit then wrote it BACK over the restored
   * one and cleared the freshly restored anchor with it. The start date beside
   * it already follows, so the panel disagreed with itself too.
   *
   * Adjusted during render, React's documented pattern for state that follows
   * changing props, and the same shape ShotForm and the old cards use.
   */
  const [lastSeen, setLastSeen] = useState(profile);
  if (
    profile.scheduleMode !== lastSeen.scheduleMode ||
    profile.intervalDays !== lastSeen.intervalDays ||
    !sameDays(profile.shotDays, lastSeen.shotDays)
  ) {
    // PER FIELD, never all three together. Re-syncing everything whenever
    // anything changed meant this control undid its own work: tapping a day
    // writes `shotDays`, the profile comes back changed, and the number box was
    // reset along with it — discarding a typed interval that had not been
    // committed yet. On iOS that is the ordinary path, since Safari does not
    // focus a <button> on tap, so tapping a day fires no blur.
    //
    // Each piece follows only its own source, so a change to one cannot disturb
    // what is half-typed in another.
    if (profile.scheduleMode !== lastSeen.scheduleMode) {
      setMode(profile.scheduleMode);
    }
    if (!sameDays(profile.shotDays, lastSeen.shotDays)) {
      setDays(profile.shotDays ?? []);
    }
    // BOTH inputs, because `draftFor` reads both: the stored value is always
    // days, and the box shows weeks in the grid rhythm. Following only
    // `intervalDays` meant an external change of rhythm alone left the old
    // number under the new unit — a restore of {rolling, 14} as {grid, 14}
    // showed "14" beside "weeks" and summarised "every 14 weeks" for a
    // fortnightly cadence, then committed 98 over the freshly restored backup
    // on the way out, clearing its anchor with it.
    //
    // This is the mirror of the bug the per-field sync was introduced to fix,
    // and the pair is the lesson: a derived value has to follow EVERY input it
    // derives from, and no more than those.
    if (
      profile.intervalDays !== lastSeen.intervalDays ||
      profile.scheduleMode !== lastSeen.scheduleMode
    ) {
      setNumDraft(draftFor(profile.scheduleMode, profile.intervalDays));
      setTouched(false);
      // Untouched again: what the box now holds came from outside, not from
      // this person. Without it, restoring a backup whose cadence cannot be
      // shown in the current unit — {grid, 10}, where 10 is not a whole number
      // of weeks — empties the box while `touched` stays true, and an alert
      // announces "Enter how many weeks" about a field they never typed in.
    }
    setLastSeen(profile);
  }

  const unit: "day" | "week" = mode === "grid" ? "week" : "day";
  const problem =
    mode === "none" || mode === undefined || !touched
      ? null
      : intervalProblem(numDraft, unit);

  /**
   * Commit the number. Kept in a ref and run from a LAYOUT cleanup as well as
   * on blur, because on a phone you can type a cadence and switch apps without
   * ever blurring the field — and silent loss is the failure this app treats as
   * severe. Layout, not passive: a passive cleanup sees a detached ref, where a
   * layout one can still ask the live control for its `validity`.
   */
  const commitNumRef = useRef(() => {});
  useLayoutEffect(() => {
    commitNumRef.current = () => {
      const el = numRef.current;
      const value = el ? el.value : numDraft;
      // No `validity.badInput` check, deliberately, and it is worth saying why
      // since every other field here has one. A number input reports value ""
      // for unparseable text as well as for empty — "-", "1e" and "1.2.3" all
      // sanitize to "" — so `intervalProblem` already refuses both, and a
      // `badInput` branch could never be the deciding factor. Mutation-tested:
      // removing it turns nothing red, which is the honest reason it is gone
      // rather than kept as reassurance.
      //
      // What DOES matter is that neither is treated as "deliberately cleared".
      // Committing an empty box wiped the cadence and the frozen anchor with it.
      if (intervalProblem(value, unit)) return;
      const n = Number(value.trim());
      const intervalDays = unit === "week" ? n * 7 : n;
      if (intervalDays !== profile.intervalDays) onChange({ intervalDays });
    };
  });
  useLayoutEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") commitNumRef.current();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      commitNumRef.current();
    };
  }, []);

  const pickMode = (next: ScheduleMode) => {
    setMode(next);
    setNumDraft(draftFor(next, profile.intervalDays));
    setTouched(false);
    // The newly revealed box has not been typed in, whatever happened in the
    // one before it. Without this, erring in the rolling box and then switching
    // rhythms greeted you with "Enter how many weeks" on a field you had never
    // seen — the exact thing `touched` exists to prevent. A committed 10-day
    // interval does it too, with no typo involved: `draftFor` returns "" because
    // 10 is not a whole number of weeks.
    // The mode is stored the moment it is picked, even before the rest is
    // filled in — that is what lets someone come back to a half-answered
    // setting and find their own choice still selected. `shotDays` and
    // `intervalDays` are deliberately left alone: switching rhythm and
    // switching back returns what you had rather than asking again, and
    // `effectiveScheduleMode` already refuses to plan from a grid with no days.
    onChange({ scheduleMode: next });
  };

  const toggleDay = (day: Weekday) => {
    const next = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day];
    setDays(next);
    onChange({ shotDays: next });
  };

  const sentence = describeWeeklySchedule(
    days,
    numDraft.trim() === "" ? undefined : Number(numDraft) * 7,
  );

  return (
    <div className="cadence">
      {/* A FIELDSET, not `role="radiogroup"`. ARIA permits a radiogroup only
          radios as children, and the revealed blocks put seven `aria-pressed`
          day buttons, a number input, a chip group and an error inside it — so
          posinset/setsize and arrow navigation were computed over content that
          is not part of the group. A fieldset is the native grouping and
          permits any content, while the radios remain one group to AT through
          the `name` they share. */}
      <fieldset className="cadence__rhythms">
        <legend className="cadence__question">
          When do you take your shots?
        </legend>
        <p className="field-hint" id={`${idPrefix}-cadence-hint`}>
          Track how on time your shots are.
        </p>
        <ModeRow
          idPrefix={idPrefix}
          value="grid"
          current={mode}
          label="On certain days"
          sub="Pick one or more days of the week"
          onPick={pickMode}
        />
        {mode === "grid" && (
          <div className="cadence__reveal">
            {/* `aria-pressed` buttons, NOT the `aria-current` the interval chips
                below use. They look alike and mean different things — "this is
                on" versus "this is the current one in a set" — and copying the
                chip markup sitting right there would ship a screen-reader bug. */}
            <div
              className="cadence__days"
              role="group"
              aria-label="Days you take your shot"
            >
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  className="cadence__day"
                  aria-pressed={days.includes(day)}
                  aria-label={weekdayLabel(day)}
                  onClick={() => toggleDay(day)}
                >
                  {weekdayLabel(day).charAt(0)}
                </button>
              ))}
            </div>
            <NumberRow
              idPrefix={idPrefix}
              hintId={`${idPrefix}-cadence-hint`}
              inputRef={numRef}
              value={numDraft}
              unit="week(s)"
              max={52}
              problem={problem}
              onChange={(v) => { setTouched(true); setNumDraft(v); }}
              onCommit={() => commitNumRef.current()}
            />
            <div className="suggestion-chips suggestion-chips--tight" role="group" aria-label="Common intervals">
              {[1, 2].map((w) => (
                <button
                  key={w}
                  type="button"
                  // `.chip--active` is the ONLY rule that paints a selected
                  // chip; there is no `[aria-current]` selector. Setting just
                  // the attribute left a user on a weekly cadence seeing
                  // neither chip lit, and tapping one changing nothing visible.
                  // My browser pass read `aria-current` and called it done —
                  // measuring the attribute rather than the paint.
                  className={`chip${numDraft.trim() === String(w) ? " chip--active" : ""}`}
                  aria-current={numDraft.trim() === String(w) ? true : undefined}
                  onClick={() => {
                    setNumDraft(String(w));
                    if (w * 7 !== profile.intervalDays)
                      onChange({ intervalDays: w * 7 });
                  }}
                >
                  {w === 1 ? "Weekly" : "Every 2 weeks"}
                </button>
              ))}
            </div>
            {sentence && !problem && (
              <p className="cadence__summary cadence__summary--info">{sentence}</p>
            )}
            {/* Both halves of an incomplete grid, not just the days. A grid
                needs days AND a whole number of weeks; with either missing,
                `effectiveScheduleMode` returns "none" and no shot ever gets a
                planned date. Only the days half was covered, so choosing days
                and leaving the number empty went silent — no sentence, no
                warning, no error, since an untouched box raises none. The panel
                this component replaced carried the mirror notice and it was
                lost in the move.

                The interval is checked through `describeWeeklySchedule`
                returning null rather than by re-testing the number here: one
                statement of "is this a usable weekly rhythm", so the warning
                and the sentence cannot disagree about it. */}
            {/* Neutral, not red. These describe what you will GET, not what
                you did wrong — and days with no interval is a legitimate
                end state rather than a mistake: `shotDaysInEffect` keeps the
                shot-day greeting working without any cadence at all. Styled as
                an error, that state nagged on every visit about a choice
                somebody had made. The information stays; the alarm goes. */}
            {!problem && !sentence && (
              <p className="cadence__summary cadence__summary--info">
                {days.length === 0
                  ? "Pick a day to plan your shots against."
                  : "Add how many weeks to plan your shot dates."}
              </p>
            )}
          </div>
        )}

        <ModeRow
          idPrefix={idPrefix}
          value="rolling"
          current={mode}
          label="Every so many days"
          sub="Counting from your last shot"
          onPick={pickMode}
        />
        {mode === "rolling" && (
          <div className="cadence__reveal">
            <NumberRow
              idPrefix={idPrefix}
              hintId={`${idPrefix}-cadence-hint`}
              inputRef={numRef}
              value={numDraft}
              unit="days"
              max={MAX_INTERVAL_DAYS}
              problem={problem}
              onChange={(v) => { setTouched(true); setNumDraft(v); }}
              onCommit={() => commitNumRef.current()}
            />
            {/* No "add a number" notice here: it restated the empty box beside
                it, on both surfaces, and was removed on request. The state it
                described is still real — "Every so many days" with no
                `intervalDays` stores `scheduleMode: "rolling"`,
                `effectiveScheduleMode` returns "none", and no shot gets a
                planned date — so don't read the silence as "this is complete".
                If it ever needs saying again, say it somewhere the empty field
                isn't already saying it. */}
          </div>
        )}

        <ModeRow
          idPrefix={idPrefix}
          value="none"
          current={mode}
          label="I’d rather not track this"
          sub="No planned dates, no tracking lateness"
          onPick={pickMode}
        />
      </fieldset>
    </div>
  );
}

function ModeRow({
  idPrefix,
  value,
  current,
  label,
  sub,
  onPick,
}: {
  idPrefix: string;
  value: ScheduleMode;
  current: ScheduleMode | undefined;
  label: string;
  sub: string;
  onPick: (m: ScheduleMode) => void;
}) {
  return (
    <label
      htmlFor={`${idPrefix}-cadence-${value}`}
      className={`cadence__row${current === value ? " cadence__row--on" : ""}`}
    >
      <input
        id={`${idPrefix}-cadence-${value}`}
        type="radio"
        name={`${idPrefix}-cadence-mode`}
        value={value}
        checked={current === value}
        onChange={() => onPick(value)}
      />
      <span className="cadence__row__mark" aria-hidden="true" />
      {/* The visible label is a DIRECT child of the <label>, not wrapped one
          level deeper for layout. Nesting it put the text out of reach of the
          accessible-name check, which is a good proxy for putting it out of
          reach of anything else reading the label. */}
      <span className="cadence__row-text">
        {label}
        <span className="cadence__row-sub">{sub}</span>
      </span>
    </label>
  );
}

function NumberRow({
  idPrefix,
  hintId,
  inputRef,
  value,
  unit,
  max,
  problem,
  onChange,
  onCommit,
}: {
  idPrefix: string;
  hintId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  unit: string;
  max: number;
  problem: string | null;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  const errorId = `${idPrefix}-cadence-error`;
  return (
    <>
      <div className="interval-field">
        every{" "}
        <input
          id={`${idPrefix}-cadence-number`}
          className="interval-field__input"
          ref={inputRef}
          type="number"
          min={1}
          max={max}
          step={1}
          inputMode="numeric"
          value={value}
          aria-label={`How many ${unit.replace("(s)", "s")} between your shots`}
          aria-invalid={problem ? true : undefined}
          // BOTH ids, and the hint is not optional. On main this sentence was
          // wired into the interval input and the shot-day select; the move
          // here left its id referenced by nothing, so a screen-reader user
          // focusing the box no longer heard what the field was for. The error
          // is appended rather than substituted, because "what is this" does
          // not stop being useful when something is also wrong with it.
          aria-describedby={problem ? `${hintId} ${errorId}` : hintId}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
        />
        <span className="interval-field__unit" aria-hidden="true">
          {unit}
        </span>
      </div>
      {/* Refused OUT LOUD. This used to put the saved value back and say
          nothing, so the field appeared to reject your typing for no reason —
          the silent-failure class this project treats as severe. */}
      {problem && (
        <p className="field-error" id={errorId} role="alert">
          {problem}
        </p>
      )}
    </>
  );
}
