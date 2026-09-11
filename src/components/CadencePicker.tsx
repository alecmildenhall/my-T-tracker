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
    profile.shotDays !== lastSeen.shotDays
  ) {
    setLastSeen(profile);
    setMode(profile.scheduleMode);
    setDays(profile.shotDays ?? []);
    setNumDraft(draftFor(profile.scheduleMode, profile.intervalDays));
  }

  const unit: "day" | "week" = mode === "grid" ? "week" : "day";
  /**
   * An error only once the field has been TOUCHED.
   *
   * Selecting a rhythm reveals an empty box, and reporting "Enter how many
   * weeks" on it instantly puts `role="alert"` and `aria-invalid` on a field
   * nobody has typed in — announcing a failure for not having answered yet. The
   * empty branch of `intervalProblem` is a prompt, not a validation result.
   */
  const [touched, setTouched] = useState(false);
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
      <p className="cadence__question" id={`${idPrefix}-cadence-label`}>
        How do you time your shots?
      </p>
      <p className="field-hint" id={`${idPrefix}-cadence-hint`}>
        Track how on time your shots are.
      </p>

      <div
        role="radiogroup"
        aria-labelledby={`${idPrefix}-cadence-label`}
        aria-describedby={`${idPrefix}-cadence-hint`}
      >
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
              <p className="cadence__summary">{sentence}</p>
            )}
            {days.length === 0 && !problem && (
              <p className="cadence__summary cadence__summary--warn">
                Pick at least one day — otherwise there is nothing to plan your
                shots against.
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
              inputRef={numRef}
              value={numDraft}
              unit="days"
              max={MAX_INTERVAL_DAYS}
              problem={problem}
              onChange={(v) => { setTouched(true); setNumDraft(v); }}
              onCommit={() => commitNumRef.current()}
            />
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
      </div>
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
  inputRef,
  value,
  unit,
  max,
  problem,
  onChange,
  onCommit,
}: {
  idPrefix: string;
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
          aria-describedby={problem ? errorId : undefined}
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
