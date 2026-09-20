// src/components/ShotForm.tsx
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  OFF_DAYS_PATTERNS,
  PAIN_LEVELS,
  SORENESS_DURATIONS,
  isOffDaysPattern,
  isPainLevel,
  isSorenessDuration,
  type OffDaysPattern,
  type PainLevel,
  type ShotEntry,
  type SorenessDuration,
} from "../types/shot";
import { painLabel } from "../utils/painLabel";
import {
  offDaysShortLabel,
  offDaysSpokenLabel,
  offDaysStrip,
} from "../utils/offDaysLabel";
import {
  offDaysWindowDays,
  offDaysWindowLabel,
  gapBeforeThisOne,
} from "../utils/offDaysWindow";
import {
  previousShotQuestions,
  sorenessShortLabel,
  storedLump,
  storedSoreness,
} from "../utils/soreness";
import { daysBetweenCivil } from "../utils/milestones";
import type { PreviousShotAnswers } from "../hooks/useShots";
import type { Profile } from "../types/profile";
import { suggestionsFor } from "../utils/suggestions";
import { todayLocalISO, nowHHMM } from "../utils/datetime";
import {
  toShotDate,
  toTakenDate,
  isRealDate,
  isShotDateInRange,
  shotDateRange,
  takenDateRange,
} from "../utils/civilDate";
import { newId } from "../utils/id";
import { SuggestionChips } from "./SuggestionChips";
import { handOffFocus } from "../utils/focus";
import { sortShots } from "../utils/shotQuery";
import {
  anchorReferenceDate,
  effectiveScheduleMode,
  planShot,
  previousShotBefore,
  previousShotDateBefore,
} from "../utils/schedule";

/**
 * The fields worth pre-filling on a new shot: dose, type of T, and carrier oil
 * rarely change between shots, so re-entering them every time is pure friction.
 * Everything else (time, site, position, pain, off days, notes) is genuinely
 * per-shot — site especially, since rotating it is the point.
 *
 * Sourced from the most recent shot rather than remembered in state, so it holds
 * across the sheet closing, a tab switch, or an app reload.
 */
function carryForward(shots: ShotEntry[]): {
  doseMg: string;
  testosteroneEster: string;
  carrierOil: string;
} {
  // This used to hand-roll its own date+time comparison, with a comment saying
  // it deliberately avoided compareShotsChrono because that comparator broke
  // ties on `id` — a random UUID — so the "latest" of two same-day shots was a
  // coin flip, and whatever it picked got pre-filled and saved into the new
  // entry. Routing around the shared comparator left it right here and wrong
  // everywhere else, which is how a just-logged shot ended up missing from the
  // Home teaser. The comparator now reports a tie as a tie and `sortShots`
  // breaks it by the order shots were logged — the same rule this reduce was
  // implementing by hand with `>=`, so there is nothing left to avoid.
  const latest = sortShots(shots, "newest")[0];
  return {
    doseMg: latest?.doseMg !== undefined ? String(latest.doseMg) : "",
    testosteroneEster: latest?.testosteroneEster ?? "",
    carrierOil: latest?.carrierOil ?? "",
  };
}

/**
 * The raw field values of an in-progress new shot, kept verbatim (strings, as
 * typed) so restoring is byte-identical to what the user left behind — including
 * a half-typed number that isn't a valid entry yet.
 */
export interface ShotDraft {
  /** The planned date as the field held it, and the value it would have shown
   *  untouched. Both travel, for the same reason `date` and `dateBaseline` do:
   *  without them, editing only the planned date left the form looking clean,
   *  so ✕ discarded the correction with no confirm — and in the mixed case the
   *  notes came back while the planned date silently reverted, which reads as a
   *  complete restore that quietly dropped a field. */
  plannedFor: string;
  plannedBaseline: string;
  /**
   * The date exactly as the field held it — a snapshot, like every other value
   * here. Never re-derived on restore.
   *
   * This used to follow today: parked on Monday, reopened Wednesday, logged
   * Wednesday. That optimised for the wrong case. A draft only exists once the
   * user has typed something (see `hasUnsavedInput`), so every draft is
   * deliberate work about a *particular shot* — and you log a shot after taking
   * it, so the day the draft was started is the better guess at the day it
   * happened. Someone finishing yesterday's half-filled entry got today's date
   * slipped underneath them, and today looks plausible enough that nothing
   * catches the eye.
   *
   * Freezing prefers the visible failure: a stale date sits in the field where
   * it can be seen and corrected, rather than a wrong one that looks right.
   * Snapshot-and-restore is also the ordinary draft contract everywhere else
   * (mail, notes, docs) — nothing silently rewrites a field you left alone.
   */
  date: string;
  /**
   * The date this form was seeded with — the value the field would still hold if
   * the user never touched it. The date counts as unsaved input exactly when it
   * differs from this.
   *
   * The reference itself is stored, rather than a boolean answer derived from it,
   * because every derived form drifted. A flag is computed against some baseline
   * at the moment it is set and then read much later, against a baseline that may
   * have moved — the sheet outlives a day, or "Clear form" reseeds the field —
   * and the two silently disagree. Keeping the reference means there is only one,
   * it travels with the draft, and whoever asks gets the same answer.
   *
   * For a new shot this is the day the form opened; for an edit, the shot's own
   * stored date; after "Clear form", the day it was cleared.
   */
  dateBaseline: string;
  time: string;
  doseMg: string;
  injectionSite: string;
  injectionSitePosition: string;
  testosteroneEster: string;
  carrierOil: string;
  /** The chosen level, or "" for not recorded — the draft mirrors the form,
   *  and the form's "nothing selected" is distinct from "none". */
  pain: PainLevel | "";
  offDays: OffDaysPattern | "";
  /** How the site settled — about the PREVIOUS shot when logging, about this
   *  one when editing. `""` is "nobody answered", which `undefined` means in
   *  storage and which is not the same as "none"/"no". */
  afterSoreness: SorenessDuration | "";
  afterLump: "" | "yes" | "no";
  /** What the two questions above showed untouched — the subject shot's own
   *  record at the moment this draft was parked. They travel for the same
   *  reason `dateBaseline` does: the value alone cannot distinguish "never
   *  touched" from "cleared on purpose", and the reference they are measured
   *  against can move while a draft sits parked (answer that shot in History
   *  and reopen the sheet). Re-reading the record on restore instead was tried
   *  and is a data-loss bug: the untouched "" then reads as a deliberate clear
   *  and deletes the answer nobody went near. */
  afterSorenessBaseline: SorenessDuration | "";
  afterLumpBaseline: "" | "yes" | "no";
  notes: string;
}

/** A brand-new form: today's date, everything else empty. Carried-forward values
 *  are layered on top by the caller. */
function freshDraft(): ShotDraft {
  return {
    date: todayLocalISO(),
    dateBaseline: todayLocalISO(),
    plannedFor: "",
    plannedBaseline: "",
    time: "",
    doseMg: "",
    injectionSite: "",
    injectionSitePosition: "",
    testosteroneEster: "",
    carrierOil: "",
    pain: "",
    offDays: "",
    afterSoreness: "",
    afterLump: "",
    // A fresh form knows no subject yet, so these are corrected on mount from
    // whatever the subject turns out to hold. Only a PARKED draft's copies are
    // authoritative, and those are the ones that matter.
    afterSorenessBaseline: "",
    afterLumpBaseline: "",
    notes: "",
  };
}

/**
 * What a save attempt actually did.
 *
 * Three outcomes, three values — deliberately not a boolean. A boolean forced
 * "storage refused this" and "I ignored you, the sheet is already closing" to
 * share `false`, and the form can only read that one way: it announced
 * "Couldn't save this shot" over a shot that had just saved perfectly, purely
 * because the second tap of a double-tap landed during the exit animation.
 * See CLAUDE.md — one value, one meaning. `undefined` still reads as `saved`,
 * so a caller that doesn't care (the form renders fine on its own) is unchanged.
 */
export type SaveOutcome =
  /** It reached storage. Clear the form. */
  | "saved"
  /** Storage refused the write. Keep every field and say so. */
  | "refused"
  /** Nothing was attempted. Change nothing on screen — least of all claim a failure. */
  | "ignored";

interface ShotFormProps {
  /** Returns what the save did; see {@link SaveOutcome}. `"refused"` keeps every
   *  field, so a failed write does not also erase what was typed. */
  onAddShot: (
    shot: ShotEntry,
    /** How the PREVIOUS shot settled, answered while logging this one and
     *  written onto that shot rather than this one — see afterSoreness in
     *  types/shot.ts for why it lives there. */
    previous?: PreviousShotAnswers,
  ) => void | SaveOutcome;
  onUpdateShot?: (shot: ShotEntry) => void | SaveOutcome;
  /**
   * Download a backup. Offered inside the sheet when a save fails, because from
   * there Settings is unreachable. Returns whether the download actually
   * started, so a browser that blocks it doesn't leave the button looking dead.
   * Optional only so the form stays renderable on its own in tests; App always
   * supplies it, and an App test proves it.
   */
  onExportBackup?: () => boolean;
  /** True for the beat between a successful save and the sheet leaving: the
   *  submit button confirms in green with a ✓ rather than vanishing instantly. */
  confirming?: boolean;
  editingShot?: ShotEntry | null;
  /** The sheet's heading, so the parent can land focus there on open rather
   *  than on the date field — see the note on the <h2>. */
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
  /** Close the sheet. Never destructive: the parent keeps whatever was entered
   *  and restores it next time this same form is opened, for a new shot or an
   *  edit alike. Renders the ✕ in the top bar — omit it and the bar shows just
   *  the title. */
  onDismiss?: () => void;
  /** Past shots, used to suggest previously-entered values for reuse. */
  shots?: ShotEntry[];
  /** The cadence settings a planned date is worked out from. A prop rather than
   *  context, matching `shots` — the form stays renderable on its own, and with
   *  no profile it simply plans nothing. */
  profile?: Pick<
    Profile,
    "shotDays" | "intervalDays" | "scheduleAnchor" | "scheduleMode"
  >;
  /** Called once, after a successful save, when a schedule grid needed an
   *  anchor and none existed. The parent persists it. */
  onAnchorEstablished?: (date: string) => void;
  /** id for the form's heading, so a containing dialog can point
   *  `aria-labelledby` at it instead of repeating the title. */
  headingId?: string;
  /** An interrupted entry to restore, in either mode — the parent keeps new-shot
   *  and per-shot edit drafts separately and hands over whichever applies. Takes
   *  precedence over `editingShot`'s stored values, and every field of it —
   *  the date included — is restored exactly as it was left. */
  draft?: ShotDraft | null;
  /** Kept pointed at the in-progress values (or null when there is nothing worth
   *  keeping), so the parent can read them at the moment it decides whether a
   *  dismissal keeps or discards. A ref rather than a change callback: the parent
   *  asks, instead of being told and having to remember why. */
  liveDraftRef?: React.RefObject<ShotDraft | null>;
}

/**
 * What the planned-date field starts with — three cases, one meaning each.
 *
 * The `||` chain this replaces was fixed once for the draft branch and left in
 * place on the other, which is the same bug reported twice: `opened.plannedFor`
 * is `initial.plannedFor ?? ""`, so a shot whose planned date the user
 * deliberately cleared and saved came back refilled from today's computation —
 * the form read clean, ✕ dismissed with no confirm, and Save re-froze the value
 * they had removed. It also quietly attached a today's-cadence planned date to
 * any pre-cadence shot merely opened to fix a typo.
 *
 * An edit takes the record VERBATIM, with no fallback: "this shot has no
 * planned date" is a real state and indistinguishable from "logged before there
 * was a cadence", so the app must not guess between them. Only a NEW shot —
 * where the field is not even rendered — gets the computed value.
 */
function initialPlanned(
  draft: ShotDraft | null | undefined,
  editingShot: ShotEntry | null | undefined,
  computed: string | undefined,
): string {
  // A parked draft's planned date only means something for an EDIT, where the
  // field is rendered and the user could have typed it. On a NEW shot the field
  // is never shown, so a carried value is a stale computation nobody can see or
  // correct — and it goes stale exactly when the cadence changes, which is a
  // large part of why someone leaves the sheet in the first place.
  //
  // Measured: a draft parked with no cadence set, restored once one was, saved
  // `plannedFor: undefined` where a fresh form saved the date — while still
  // persisting an anchor, so the grid was fixed by a shot that had no place on
  // it. The mirror case froze the OLD grid's date under a new cadence. By this
  // feature's own design neither can ever be regenerated.
  if (draft && editingShot) return draft.plannedFor;
  if (editingShot) return editingShot.plannedFor ?? "";
  return computed ?? "";
}

/**
 * What is wrong with the date a shot was taken, in words, or null when nothing
 * is — the ONE statement of the rule, read by the blur check and by submit.
 *
 * Extracted rather than duplicated: two copies of a validation rule is how the
 * message and the check drift into disagreeing, which this field has already
 * done once (a message naming a bound the form did not enforce).
 *
 * Ordering matters and the obvious order is wrong. A mistyped year is ALSO in
 * the future — `9999-01-01` satisfies both tests — so checking "after today"
 * first swallows the year typo and answers it with a bound the person never
 * typed. `isShotDateInRange` is what separates them: fail it and the year is
 * implausible on any reading, so name the year; pass it and the date is an
 * ordinary near-future day, so name the rule.
 */
function takenDateProblem(value: string, storedDate?: string): string | null {
  if (toTakenDate(value)) return null;
  // An entry ALREADY stored keeps its date when you edit something else. Import
  // is deliberately not held to the taken-date bound, so a restored backup can
  // contain a future-dated shot — and refusing it here would blame the user for
  // the one field they had not touched, with no way forward but to change their
  // own record. Refusing what is being ENTERED is the rule; refusing what is
  // already there is a dead end.
  if (storedDate !== undefined && value === storedDate && toShotDate(value)) {
    return null;
  }
  // Read fresh rather than at module load, so a session left open across New
  // Year cannot name last year's bound.
  const range = takenDateRange();
  if (value.trim() === "") return "Add the date this shot was taken.";
  if (!isRealDate(value))
    return "Please enter a real calendar date (YYYY-MM-DD).";
  if (!isShotDateInRange(value))
    return `Check the year — dates run from ${range.min} to ${range.max}.`;
  // Describes the rule; does not instruct the person. "Log a shot after taking
  // it — nothing later than today" was two orders in one line, and the first of
  // them lectured someone about how to use the app while they were mid-task.
  // The other messages here stay imperative on purpose: "Add the date" and
  // "Check the year" tell you what to DO about a mistake, which is what WCAG's
  // error-suggestion guidance asks for. This one was telling you how to live.
  //
  // "today" leads and the date follows in parentheses: naming only the date read
  // as a fixed rule — "so it is always 2026-09-12?" — when the bound moves with
  // the day. ISO in the parenthetical because that is the format the app shows
  // everywhere else; ShotListItem warns against inventing a second one.
  return `Shots dated later than today (${range.max}) are invalid.`;
}

export const ShotForm: React.FC<ShotFormProps> = ({
  profile = {},
  onAnchorEstablished,
  onAddShot,
  onUpdateShot,
  onExportBackup,
  confirming = false,
  editingShot,
  onDismiss,
  shots = [],
  headingId,
  draft,
  liveDraftRef,
  headingRef: externalHeadingRef,
}) => {
  // Values that genuinely stay the same shot-to-shot start pre-filled from the
  // last shot, so their field is already filled and their chip already selected.
  // Reading them from history (rather than holding them in component state
  // between saves) means they also survive closing the form, switching tabs, and
  // reloading the app — the form is now a sheet that unmounts on every save, so
  // in-component stickiness would silently do nothing.
  // Per render, not per module load: it reads the clock, and a sheet in a session
  // left open across New Year would otherwise bound the picker to last year.
  // The date TAKEN stops at today; "Planned for" is allowed to be ahead. Same
  // control, different questions — one range for both is what let a future shot
  // become the schedule's anchor.
  /** The scrolling part of the sheet — taken back to the top on a blocked save. */
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Send the user to the field NAMED, not to whichever is first.
   *
   * Every blocked field is its own button, because one button spanning "date
   * and the dose" always jumped to the date — so tapping the word "dose" took
   * you somewhere else, which is worse than not offering the jump.
   *
   * The control is found through the error id it already points at via
   * `aria-describedby`, so this uses an association the markup keeps anyway.
   *
   * `handOffFocus`, never a bare `.focus()` — it verifies the result, which is
   * the rule this codebase settled after nine focus defects.
   */
  const focusProblem = (describedBy: string) => {
    const field = scrollRef.current?.querySelector<HTMLElement>(
      `[aria-describedby~="${describedBy}"]`,
    );
    if (field) handOffFocus(field);
  };

  const takenRange = takenDateRange();
  const plannedRange = shotDateRange();
  const carried = useMemo(() => carryForward(shots), [shots]);
  // Held in a ref so resetForm can stay identity-stable: if it changed whenever
  // `shots` changed, the editing-sync effect below would re-run and wipe fields
  // mid-typing.
  const carriedRef = useRef(carried);
  useEffect(() => {
    carriedRef.current = carried;
  });

  // Seeded from `editingShot` when there is one. The form mounts fresh each time
  // the sheet opens, so initialising to today + carried values and letting the
  // sync effect below correct them would paint one frame of the wrong shot —
  // today's date and the last shot's dose, flashing before the real values.
  // Precedence: the shot being edited, then a restored draft, then a fresh form
  // (today + carried-forward values). A draft only ever applies to a new shot.
  const initial = editingShot;
  // What the form would show with no draft: the shot being edited, or a fresh
  // form. Kept separately from `start` so "has unsaved input" always compares
  // against the underlying record, even when a draft was restored on top — which
  // is what lets a restored draft re-publish itself instead of reading as clean.
  const opened: ShotDraft = useMemo(
    () =>
      initial
        ? {
            date: initial.date,
            dateBaseline: initial.date,
            plannedFor: initial.plannedFor ?? "",
            // The record's own value is what it opened with, so an untouched
            // reopen reads as clean even though the app might now compute a
            // different planned date.
            plannedBaseline: initial.plannedFor ?? "",
            time: initial.time ?? "",
            doseMg: initial.doseMg?.toString() ?? "",
            injectionSite: initial.injectionSite ?? "",
            injectionSitePosition: initial.injectionSitePosition ?? "",
            testosteroneEster: initial.testosteroneEster ?? "",
            carrierOil: initial.carrierOil ?? "",
            // Validated, not trusted. `sanitizeShots` is deliberately lenient
            // — it vets only a non-blank id and date and passes every other
            // field through — so a stored `pain: "agony"` (a devtools edit, a
            // value from a newer build, a hand-repaired store) reaches here.
            // Seeded raw it checked no chip, sat invisible, and was written
            // straight back on save: a shot the app's own importer rejects,
            // which the README calls the worst outcome this product can
            // produce. "Four chips cannot produce an invalid value" is true of
            // the chips and was never true of the seed.
            pain: isPainLevel(initial.pain) ? initial.pain : "",
            // Validated, not cast: storage is lenient, so a value predating
            // the enum (or a hand-edited backup) reaches here, and seeding it
            // unchecked would put a phantom into a group where no chip matches
            // and the Clear control is the only way out.
            offDays: isOffDaysPattern(initial.offDays) ? initial.offDays : "",
            // Seeded from the shot being EDITED, where these describe that shot
            // itself. Validated like the rest — storage is lenient, so a value
            // predating the enum reaches here.
            afterSoreness: isSorenessDuration(initial.afterSoreness)
              ? initial.afterSoreness
              : "",
            afterLump:
              typeof initial.afterLump === "boolean"
                ? initial.afterLump
                  ? "yes"
                  : "no"
                : "",
            // When editing, the subject IS this shot, so its record is the
            // baseline — known here, unlike on a fresh form.
            afterSorenessBaseline: isSorenessDuration(initial.afterSoreness)
              ? initial.afterSoreness
              : "",
            afterLumpBaseline:
              typeof initial.afterLump === "boolean"
                ? initial.afterLump
                  ? "yes"
                  : "no"
                : "",
            notes: initial.notes ?? "",
          }
        : { ...freshDraft(), ...carried },
    // Mount-time seed only; the component is remounted (via `key`) when the shot
    // being edited changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // A restored draft wins over both, and is restored as-is — no field is
  // re-derived, the date included. See ShotDraft.date.
  const start: ShotDraft = useMemo(
    () => draft ?? opened,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [date, setDate] = useState<string>(start.date);

  // The recall window the off-days question is asking about. Recomputed as the
  // date changes, so backdating an entry re-measures rather than keeping a span
  // from the date it was opened with.
  const liveOffDaysSpan = useMemo(
    () => offDaysWindowLabel(offDaysWindowDays(shots, date, editingShot?.id)),
    [shots, date, editingShot?.id],
  );

  /**
   * Frozen for the ✓ beat, because the sheet must not change under its own
   * confirmation.
   *
   * The same defect the post-save field reset was deleted for, arriving by a
   * different route: not a reset, but a recomputation. Saving a NEW shot puts it
   * into `shots` with the date on screen, and `previousShotDateBefore` counts a
   * same-day shot as the one before — right for the schedule — so the shot
   * became its own predecessor, the gap read 0, and the span went away. It
   * blinked out under "✓ Saved" while the sheet sat there for ~440ms. Measured.
   *
   * Frozen on `confirming` rather than fixed by excluding the new id, because
   * the rule generalises: anything in this sheet derived from `shots` would do
   * the same thing at the same moment, and one guard covers all of them. The
   * ref is written from an effect, so on the render where `confirming` flips it
   * still holds the last value from before the save — which is the one to show.
   */
  const spanBeforeConfirm = useRef(liveOffDaysSpan);
  useEffect(() => {
    if (!confirming) spanBeforeConfirm.current = liveOffDaysSpan;
  }, [confirming, liveOffDaysSpan]);
  const offDaysSpan = confirming ? spanBeforeConfirm.current : liveOffDaysSpan;

  /**
   * Which shot "how did it settle" is about, and which answers the time elapsed
   * can actually settle.
   *
   * Two different subjects. Logging asks about the PREVIOUS shot, because this
   * one has not settled yet — you find out over the following days. Editing a
   * saved shot asks about that shot itself, whose interval closed long ago.
   *
   * The elapsed days are what decide the offered answers: nobody can say "a week
   * or more" three days on. `previousShotQuestions` owns that rule; here we only
   * work out how long it has been, from the previous shot to this one's date
   * when logging, and from the shot to today when editing.
   */
  const liveSettledAsk = useMemo(() => {
    const none = {
      durations: [] as SorenessDuration[],
      lump: false,
      shotId: undefined as string | undefined,
      subject: null as ShotEntry | null,
      heading: "",
      sub: "",
    };
    const subject = editingShot
      ? { shot: editingShot, elapsed: daysBetweenCivil(editingShot.date, todayLocalISO()) }
      : (() => {
          const prev = previousShotBefore(date, shots);
          return prev ? { shot: prev, elapsed: daysBetweenCivil(prev.date, date) } : null;
        })();
    if (!subject) return none;
    // The elapsed guard is a LOGGING guard, and applying it to both modes was a
    // data-loss bug. NaN covers a half-typed date and a negative gap covers a
    // date typed before the previous shot: both are real states of this field
    // while logging, and both are reasons to ask nothing. Editing uses `elapsed`
    // for NEITHER — the questions are unconditional and the sub-line omits the
    // gap — so gating edit mode on it bought nothing and cost the answers.
    //
    // A shot dated in the FUTURE made `subject` null while editing, so the block
    // hid, both baselines seeded to "", and the unconditional write-back below
    // then replaced the stored answers with `undefined`, wholesale and silently,
    // with nothing on screen having shown they existed. Import is deliberately
    // not held to the taken-date bound (see `takenDateProblem`), so a restored
    // backup reaches this without anyone hand-editing storage.
    if (!editingShot && (!Number.isFinite(subject.elapsed) || subject.elapsed < 0)) {
      return none;
    }
    const site = [subject.shot.injectionSitePosition, subject.shot.injectionSite]
      .filter(Boolean)
      .join(" ");
    // EDITING asks unconditionally, and that is not the gate being abandoned.
    // The gate governs what to ask UNPROMPTED while logging, where offering an
    // answer the days so far cannot settle invites a guess. Opening a saved
    // shot is a deliberate trip made to record how it went, so the one screen
    // built for the job must not sit silent — and the two modes looked
    // arbitrary side by side, because the number they turn on (the gap when
    // logging, days since the shot when editing) is nowhere on screen.
    const asks = editingShot
      ? { durations: [...SORENESS_DURATIONS], lump: true }
      : previousShotQuestions(subject.elapsed);
    return {
      ...asks,
      shotId: subject.shot.id,
      subject: subject.shot,
      heading: editingShot ? "How this shot settled" : "Your previous shot",
      sub: [
        subject.shot.date,
        site || null,
        // The shared phrase, not a second copy of the rule: this line and the
        // off-days line above describe the SAME gap, and the local template
        // read "1 days before this one" the day after a shot.
        editingShot ? null : gapBeforeThisOne(subject.elapsed),
      ]
        .filter(Boolean)
        .join(" \u00b7 "),
    };
  }, [editingShot, date, shots]);

  /**
   * Frozen for the ✓ beat, for the same reason `offDaysSpan` is: the sheet must
   * not change under its own confirmation. Measured before this — on a
   * successful save the sub-line flipped to the shot just logged ("0 days
   * before this one") and the duration group vanished, taking the chip the user
   * had just tapped with it, while "✓ Saved" was still on screen.
   */
  const askBeforeConfirm = useRef(liveSettledAsk);
  useEffect(() => {
    if (!confirming) askBeforeConfirm.current = liveSettledAsk;
  }, [confirming, liveSettledAsk]);
  const settledAsk = confirming ? askBeforeConfirm.current : liveSettledAsk;

  /** What the app works out this shot was meant to be, given today's settings. */
  const plan = useMemo(
    () =>
      planShot({
        date,
        previousShotDate: previousShotDateBefore(date, shots, editingShot?.id),
        // NOT excluding the shot being edited: it is still part of the history
        // the grid is aligned to, and excluding it meant which shot you happened
        // to open decided where an unestablished anchor landed — on a
        // fortnightly grid, a 7-day different schedule, then frozen. The
        // exclusion is right for `previousShotDateBefore`, where a shot must not
        // be its own predecessor, and wrong here.
        anchorFrom: anchorReferenceDate(date, shots, takenRange.max),
        profile,
      }),
    // `takenRange.max` is today as a plain string, so this recomputes when the
    // day rolls over and not otherwise — which is what we want, since it is the
    // cutoff deciding whether a stored shot counts as "not yet taken".
    [date, shots, editingShot?.id, profile, takenRange.max],
  );

  /**
   * The planned date as SHOWN, and the value it would show untouched.
   *
   * Two pieces, not one, and for the reason the date field learned the hard
   * way: "has the user edited this?" cannot be derived from the value alone. A
   * planned date is always populated, so emptiness is no tell; comparing
   * against today's computation is no tell either, since correcting it TO the
   * computed value would read as untouched. So the baseline travels alongside,
   * and edited means simply "differs from it". Change the shot's date and an
   * untouched planned date follows; an edited one stays put.
   */
  // `draft ? draft.x : …`, never `start.plannedFor || …`. The `||` treated a
  // deliberately EMPTIED planned date — a legitimate "" meaning "this shot has
  // none" — as absent, and fell back to today's computation: the value the user
  // deleted reappeared on reopen, the form read clean so ✕ discarded without a
  // confirm, and Save wrote it back. That is the overloaded-"" sentinel class
  // CLAUDE.md calls the most expensive bug here, and it defeated the exact case
  // ShotDraft.plannedFor was added to carry. Whether a draft exists is the
  // question; the value inside it is taken verbatim.
  const [plannedDraft, setPlannedDraft] = useState<string>(
    initialPlanned(draft, editingShot, plan.plannedFor),
  );
  /** The shot date `plannedBaseline` was worked out for. */
  const [plannedForDate, setPlannedForDate] = useState<string>(start.date);
  /**
   * What the field would show untouched — the value it OPENED with, restored
   * from the draft when there is one.
   *
   * Both obvious seeds are wrong, and each was shipped in turn. Seeding from the
   * stored value made draft and baseline equal on the first render, which is the
   * condition the sync below fires on, so reopening a shot repainted its frozen
   * planned date from today's settings. Seeding from the computation instead
   * fixed that and broke the other side: every historical shot whose frozen date
   * no longer matches today's cadence — which is the normal case, and the whole
   * point of freezing — read as edited before anyone touched it, parking a draft
   * on an untouched dismissal.
   *
   * The seed was never the bug. The SYNC was: it fired on any disagreement,
   * including the one present on arrival. It is keyed to the shot's date now, so
   * it runs when the date moves and never on mount.
   */
  /**
   * Whether the "Planned for" field is offered at all.
   *
   * Editing alone was not the right condition, and the comment beside the field
   * already claimed this one: with no cadence set there is nothing to show and
   * nothing to correct, so an empty date input labelled "Planned for" and
   * hinted "Worked out from how often you inject" invited a value the app would
   * never compute — which then rendered in History and in the CSV a provider
   * reads. A shot that ALREADY carries a frozen planned date still gets the
   * field even with no cadence, because correcting or clearing it is exactly
   * what it is for.
   *
   * Frozen for the sheet's lifetime, deliberately. The condition now depends on
   * the profile, which a cross-tab storage event can change at any moment — and
   * a field that unmounts from under the focus it holds strands focus on <body>
   * inside a dialog, where the Tab trap cannot re-engage. `useState` with an
   * initializer answers once, at open, like `editingShot` did by nature.
   */
  const [showsPlannedField] = useState(
    () =>
      Boolean(editingShot) &&
      (Boolean(editingShot?.plannedFor) ||
        // A parked draft counts too. Dismiss the sheet with a planned date
        // typed, clear the cadence in Settings, then reopen the same shot: the
        // draft restores that value while the field it belongs to would be
        // gone, so it would be saved from an input the user cannot see — and if
        // it were out of range, the error would block Save while its message
        // was never rendered. The field is where a planned date is corrected,
        // so a pending one is a reason to show it, not to hide it.
        Boolean(draft?.plannedFor.trim()) ||
        effectiveScheduleMode(profile) !== "none"),
  );
  // Seeded by the same rule as the draft above, and it has to be: they are
  // compared to answer "has the user edited this?", so seeding them from
  // different places is how that question starts answering wrongly. A restored
  // new-shot draft gets today's computation in both, which reads as untouched —
  // which it is, the field having never been on screen.
  const [plannedBaseline, setPlannedBaseline] = useState<string>(
    draft && editingShot
      ? draft.plannedBaseline
      : initialPlanned(undefined, editingShot, plan.plannedFor),
  );
  const computed = plan.plannedFor ?? "";
  // On a NEW shot, changing the date moves an untouched planned date with it —
  // nothing is frozen yet, so following is the only sensible thing to do.
  //
  // On a SAVED one, nothing follows. The planned date was frozen at log time
  // and only the user may change it, through the field below. Following was a
  // silent rewrite of history triggered by an unrelated edit: open an old shot
  // to fix a typo in its date, and the field repainted from TODAY's settings —
  // onto the new grid if the cadence had changed, and to empty if the cadence
  // had since been cleared, whereupon Save stored `undefined` and destroyed a
  // value backupDto.ts states can never be regenerated. Freezing at log time is
  // what makes that permanent rather than self-correcting, so the guard has to
  // be here.
  if (plannedForDate !== date) {
    setPlannedForDate(date);
    if (!editingShot) {
      if (plannedDraft === plannedBaseline) setPlannedDraft(computed);
      // The baseline moves with the draft, or the pair falls out of step and
      // the "has the user edited this?" question starts answering wrongly.
      setPlannedBaseline(computed);
    }
  }
  const [dateBaseline, setDateBaseline] = useState<string>(start.dateBaseline);
  // The sheet's landing spot. Owned by the parent when it supplies one, because
  // Modal needs it as `initialFocusRef` — see the note on the <h2> below.
  const ownHeadingRef = useRef<HTMLHeadingElement>(null);
  const headingRef = externalHeadingRef ?? ownHeadingRef;
  /**
   * Seeded from the restored draft, not started empty.
   *
   * A dismissed sheet keeps everything you typed, so reopening it used to bring
   * back a date the form had already refused with nothing left saying so —
   * the message gone, the field looking ordinary, and the refusal waiting to be
   * rediscovered at Save.
   *
   * DERIVED rather than stored, which is why it survives at all: the error is a
   * fact about the value, so re-asking the same question of the restored value
   * is both simpler than persisting it and incapable of disagreeing with it. A
   * fresh sheet is pre-filled with today and so starts silent, as it should.
   */
  const [dateError, setDateError] = useState<string | null>(() =>
    takenDateProblem(start.date, editingShot?.date),
  );
  const [plannedError, setPlannedError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const [doseError, setDoseError] = useState<string | null>(null);

  /**
   * Whether Save has actually been pressed and refused.
   *
   * This WAS redundant, and stopped being so the moment the date started
   * validating on blur. While errors could only come from the submit handler,
   * "an error is showing" meant "a save was refused" — so the flag was a second
   * value for a fact the errors already carried, and mutation-testing proved it
   * by staying green when it was removed. Blur breaks that equivalence: you can
   * now have an error without ever having pressed the button, and the summary
   * greeted that with "Not saved yet" about a save nobody attempted.
   *
   * Worth keeping the story attached rather than just the flag: the same
   * reasoning gives opposite answers before and after an unrelated-looking
   * change, and a comment claiming redundancy would now be actively wrong.
   */
  const [saveAttempted, setSaveAttempted] = useState(false);
  /**
   * Which fields a refused save is waiting on — live, so fixing one drops it.
   *
   * Each carries the id of its own error message, which is how its control is
   * found: the field already points at that id through `aria-describedby`, so
   * this rides an association the markup maintains anyway rather than adding a
   * ref per field for the summary to keep in step.
   */
  const blockedFields = [
    dateError ? { label: "date", describedBy: "date-error" } : null,
    doseError ? { label: "dose", describedBy: "dose-error" } : null,
    plannedError
      ? { label: "planned date", describedBy: "planned-error" }
      : null,
  ].filter((f): f is { label: string; describedBy: string } => f !== null);
  const [time, setTime] = useState<string>(start.time);
  const [doseMg, setDoseMg] = useState<string>(start.doseMg);
  const [injectionSite, setInjectionSite] = useState<string>(
    start.injectionSite,
  );
  const [injectionSitePosition, setInjectionSitePosition] = useState<string>(
    start.injectionSitePosition,
  );
  const [testosteroneEster, setTestosteroneEster] = useState<string>(
    start.testosteroneEster,
  );
  const [carrierOil, setCarrierOil] = useState<string>(start.carrierOil);
  const [pain, setPain] = useState<PainLevel | "">(start.pain);
  /** Where Clear hands focus when it removes itself — see its onClick. */
  const firstPainChipRef = useRef<HTMLInputElement>(null);
  const firstOffDaysChipRef = useRef<HTMLInputElement>(null);
  const [offDays, setOffDays] = useState<OffDaysPattern | "">(start.offDays);
  const firstSorenessChipRef = useRef<HTMLInputElement>(null);
  /**
   * What these two fields show untouched: whatever the subject shot already has
   * on record, so an existing answer is visible and changeable rather than
   * invisible and silently replaceable.
   *
   * The REFERENCE is kept, never a "has it changed" answer derived from it —
   * the rule `dateBaseline` records, and this pair is what skipping it cost.
   * Seeding the fields from the record while the dirty check still measured
   * them against an empty form made an untouched sheet read as dirty: "Clear
   * form" appeared on a form nobody had touched, and dismissing it parked a
   * draft nobody typed.
   *
   * Unlike `dateBaseline` these do NOT travel in the draft, and the difference
   * is the point. Today moves while a sheet sits parked, so the date's
   * reference has to be carried or it drifts out from under the comparison. A
   * record CAN move under a parked draft, which is exactly why the baseline
   * travels with it.
   *
   * An earlier version re-read the baseline live on every mount, arguing that a
   * carried reference would go stale if the subject were answered elsewhere
   * meanwhile. That reasoning covered only the case where the draft held the
   * user's own tap, where value and moved baseline still agree. A review found
   * the other branch and a repro confirmed it: park a draft while the previous
   * shot is unanswered, answer that shot in History, reopen and save — the
   * untouched "" is measured against a baseline that has since moved, reads as
   * a deliberate clear, and deletes the answer nobody went near.
   *
   * So the reference travels, which is what `dateBaseline` already does and for
   * this reason exactly: one reference, moving with the value it belongs to,
   * that nothing else can disagree with.
   */
  const [afterSorenessBaseline, setAfterSorenessBaseline] = useState<
    SorenessDuration | ""
  >(() =>
    draft ? draft.afterSorenessBaseline : storedSoreness(settledAsk.subject),
  );
  const [afterLumpBaseline, setAfterLumpBaseline] = useState<"" | "yes" | "no">(
    () => (draft ? draft.afterLumpBaseline : storedLump(settledAsk.subject)),
  );
  // Held in a ref for the reason `carriedRef` is: resetForm must stay
  // identity-stable, and these move whenever the subject does.
  const settledBaselineRef = useRef({
    soreness: afterSorenessBaseline,
    lump: afterLumpBaseline,
  });
  useEffect(() => {
    settledBaselineRef.current = {
      soreness: afterSorenessBaseline,
      lump: afterLumpBaseline,
    };
  });
  // A restored draft wins, because that is work the user did — including the
  // work of CLEARING an answer. Tested on `draft` itself, never
  // `start.afterSoreness || …`: "" is both a legitimate restored value and
  // falsy, so `||` handed the record a win over a deliberate clear, which is
  // the opposite of what the line it sat on claimed to do.
  const [afterSoreness, setAfterSoreness] = useState<SorenessDuration | "">(
    () => (draft ? start.afterSoreness : afterSorenessBaseline),
  );
  const [afterLump, setAfterLump] = useState<"" | "yes" | "no">(
    () => (draft ? start.afterLump : afterLumpBaseline),
  );
  /**
   * The answers are about a subject that can MOVE — backdating a new entry
   * changes which shot "the previous one" is. Without this, an answer tapped
   * about Tuesday's glute shot was written onto a thigh shot from a month
   * earlier: the sub-line updated, nothing re-asked, and the row a rotation
   * chart reads was the wrong one.
   *
   * Adjusted during render, the way this codebase syncs state to props
   * elsewhere, and keyed on the subject's id rather than on a boolean "has it
   * changed" — the id IS the reference, and a derived flag is what drifts.
   *
   * NO SUBJECT IS NOT A NEW SUBJECT. Clearing the date field — one keystroke of
   * an ordinary correction — resolves to no shot at all for a render or two,
   * and treating that as a change re-seeded from `null` and wiped the answer
   * just tapped. Permanently: finishing the date brings back the same id, so
   * there is no further change to sync, and nothing puts it back. The
   * last-known id is therefore held across the gap, and only a different KNOWN
   * shot re-seeds.
   */
  const [lastSubjectId, setLastSubjectId] = useState(settledAsk.shotId);
  if (settledAsk.shotId !== undefined && settledAsk.shotId !== lastSubjectId) {
    setLastSubjectId(settledAsk.shotId);
    setAfterSoreness(storedSoreness(settledAsk.subject));
    setAfterLump(storedLump(settledAsk.subject));
    // The baseline moves with the value it is the reference for, or the two
    // fall out of step and "has the user entered something?" starts answering
    // wrongly — the failure `plannedBaseline` documents a few lines above.
    setAfterSorenessBaseline(storedSoreness(settledAsk.subject));
    setAfterLumpBaseline(storedLump(settledAsk.subject));
  }
  /**
   * A pick the elapsed gap can no longer settle goes back to what is on record.
   *
   * Re-dating a new entry from a 10-day gap to a 2-day one withdraws the whole
   * duration group, and the "week or more" tapped a moment ago would otherwise
   * still be saved — storing the one answer `previousShotQuestions` exists to
   * withhold. Reset to the STORED value, never blindly to "": clearing a value
   * that merely matches the record would erase the previous shot's real answer,
   * which is the same defect by another door.
   */
  // NO SUBJECT IS NOT AN UNANSWERABLE GAP — the same distinction the sync above
  // turns on, and missing it here defeated that fix rather than adding to it.
  // A cleared date resolves to no shot, so `durations` is empty and `lump` is
  // false, and without this guard that reads as "every answer just became
  // unanswerable" and resets the chip the user tapped. Retyping the date brings
  // the subject back but not the answer, so an ordinary date correction ate it.
  // An unknown question withdraws nothing; only a KNOWN gap can.
  const subjectKnown = settledAsk.shotId !== undefined;
  if (
    !editingShot &&
    subjectKnown &&
    afterSoreness !== "" &&
    afterSoreness !== afterSorenessBaseline &&
    !settledAsk.durations.includes(afterSoreness)
  ) {
    setAfterSoreness(afterSorenessBaseline);
  }
  if (
    !editingShot &&
    subjectKnown &&
    afterLump !== "" &&
    afterLump !== afterLumpBaseline &&
    !settledAsk.lump
  ) {
    setAfterLump(afterLumpBaseline);
  }
  const [notes, setNotes] = useState<string>(start.notes);

  // Suggestions derived from past entries — one tap to reuse a value you've
  // logged before. Shot history is the single source; nothing extra is stored.
  const suggestions = useMemo(
    () => ({
      dose: suggestionsFor(shots, "doseMg").slice(0, 6),
      site: suggestionsFor(shots, "injectionSite").slice(0, 6),
      position: suggestionsFor(shots, "injectionSitePosition").slice(0, 6),
      ester: suggestionsFor(shots, "testosteroneEster").slice(0, 6),
      oil: suggestionsFor(shots, "carrierOil").slice(0, 6),
    }),
    [shots],
  );

  // A fresh, empty "Log a Shot" form. The single source of truth for what the
  // default form looks like, so the editing-sync effect and Cancel can't drift.
  // Stable (setters are stable), so it's safe in the effect's dependency list.
  const resetForm = useCallback(() => {
    // Or a save refused earlier keeps its summary alive: a LATER error raised by
    // blur alone would re-show "Not saved yet." for a save nobody attempted,
    // which is the exact condition this flag exists to prevent.
    setSaveAttempted(false);
    setDate(todayLocalISO());
    // Reseeded, so the baseline moves with it. Leaving the baseline behind is
    // what let a form cleared after midnight treat a genuine backdate as no
    // change at all, and discard it on dismissal.
    setDateBaseline(todayLocalISO());
    // The planned date resets with everything else, baseline included.
    //
    // Not reachable today — "Clear form" renders only for a NEW shot and the
    // planned field only when EDITING one, so the two never share a screen.
    // Kept because resetForm's contract is "reset every field", and leaving one
    // out is exactly the bug this was added for: an override survived the
    // reset, so the form still read as dirty, the link never disappeared,
    // tapping it again visibly did nothing, and a refused value went on
    // blocking Save from a field the user had cleared.
    setPlannedDraft("");
    setPlannedBaseline("");
    // "" — meaning "computed for no date yet" — NOT today. Setting it to today
    // alongside the date meant the sync below saw no disagreement and never
    // re-seeded, so a shot saved straight after "Clear form" was stored with no
    // planned date at all: silent, invisible (the field is not rendered on a new
    // shot), and by this feature's design impossible to regenerate. Measured: a
    // normal save gave 2026-08-26, one after clearing gave undefined.
    setPlannedForDate("");
    setPlannedError(null);
    setDateError(null);
    setDoseError(null);
    // Clearing is starting over, so the failed-save state goes with the values it
    // referred to — including the button's label.
    setSaveFailed(false);
    setExportFailed(false);
    setTime("");
    setInjectionSite("");
    setInjectionSitePosition("");
    setPain("");
    setOffDays("");
    // The BASELINE, not "" — see the block that seeds these. Blanking them told
    // the save path the user had deliberately cleared the previous shot's
    // answers, so "Clear form" followed by Save DELETED answers nobody had
    // touched. Unrecoverable by this feature's own design: it never asks again
    // about a shot whose interval has closed. Clearing restores what the record
    // says, exactly as the date goes back to today.
    setAfterSoreness(settledBaselineRef.current.soreness);
    setAfterLump(settledBaselineRef.current.lump);
    setNotes("");
    // Carried-forward fields reset to the last shot's values, not to empty.
    const { doseMg, testosteroneEster, carrierOil } = carriedRef.current;
    setDoseMg(doseMg);
    setTestosteroneEster(testosteroneEster);
    setCarrierOil(carrierOil);
    // "Clear form" is the only caller, and clearing makes it vanish (there is
    // nothing left to clear), so without this focus drops to <body> — inside an
    // OPEN dialog, where the Tab trap then cannot re-engage because it only wraps
    // from the first or last focusable.
    //
    // The heading, NOT the first field: that field is <input type="date">, and
    // focusing it from inside a click handler is exactly what makes iOS Safari and
    // Android Chrome throw up the date wheel — so a quiet "Clear form" link at the
    // bottom of the sheet would cover half the screen with a picker nobody asked
    // for. The heading summons no keyboard and no picker, names the region that
    // just changed for a screen reader, and keeps focus inside the trap.
    handOffFocus(headingRef);
    // `headingRef` is now either the parent's ref or this component's own, so it
    // is a value rather than a constant — and resetForm must stay
    // identity-stable, or the editing-sync effect below re-runs and wipes fields
    // mid-typing. Both candidates are refs, so the identity never changes in
    // practice; listing it satisfies the rule without changing behaviour.
  }, [headingRef]);

  // NOTE: there is deliberately no "sync the form to editingShot" effect. The
  // state above is seeded once at mount, and the parent gives this component a
  // key that changes with the shot being edited, so switching shots remounts it
  // with a fresh seed. An effect doing the same job re-ran under StrictMode's
  // development double-invoke and wiped a restored draft; remounting is both
  // simpler and immune to that.

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // The ✓ is showing and the sheet is already leaving: this press is the second
    // half of a double-tap. Blocked here rather than by `disabled`, which would
    // cost the focus this button is holding.
    if (confirming) return;

    // Every field is validated here, and the form carries `noValidate`, so the
    // browser never silently refuses to submit. It used to: a decimal dose or
    // pain score (or a pain score above 10) failed the native `step`/`max`
    // constraints, which cancels the submit event outright — the button appeared
    // to do nothing at all, with no message and nothing saved. Whatever we reject
    // now, we say why, next to the field.
    const parsedDate =
      toTakenDate(date) ??
      (!!editingShot && date === editingShot.date ? toShotDate(date) : null);
    const parsedDose = doseMg === "" ? undefined : Number(doseMg);

    // A FOURTH mistake, and it needs its own words for the reason the other
    // three do. "Check the year" is wrong here: the year is usually fine and the
    // date is a real one — the person has dated a dose to a day that has not
    // happened. Naming the rule ("after it") is what makes it fixable, and it
    // says today's date rather than a bound they would have to work out.
    //
    // Order matters here, and the obvious order is wrong. A mistyped year is
    // ALSO in the future — `9999-01-01` satisfies both tests — so checking
    // "after today" first swallows the year typo and answers it with a bound
    // the person never typed. `isShotDateInRange` is what separates them: fail
    // it and the year is implausible on any reading, so name the year; pass it
    // and the date is an ordinary near-future day, so name the rule.
    const nextDateError = takenDateProblem(date, editingShot?.date);
    // Mirrors the storage schema: a finite, non-negative number. Fractional doses
    // are fine (62.5mg while titrating is ordinary).
    const nextDoseError =
      parsedDose !== undefined &&
      (!Number.isFinite(parsedDose) || parsedDose < 0)
        ? "Dose must be a positive number."
        : null;
    // No pain validation any more, and that is the point rather than an
    // omission: four chips cannot produce a value the schema would refuse. The
    // check that lived here existed only because the native step/max hints were
    // cancelling the submit silently and leaving a dead Save button — a problem
    // the numeric input created and took with it.

    // The planned date takes the SAME rule as the date, and for the same reason:
    // the form is noValidate, so `min`/`max` on the input are hints the browser
    // never enforces. It went through unvalidated, so typing 9999-01-01 stored
    // it — and the three boundaries then disagreed about a value the user could
    // see: pickShotFields drops it from the backup, toCsv blanks the cell, and
    // History renders it. A value on screen that silently does not survive your
    // own backup is the failure this feature's comments exist to prevent.
    const parsedPlanned =
      plannedDraft.trim() === "" ? null : toShotDate(plannedDraft);
    // Only blocks the save when the field — and its message — are on screen.
    // The planned input renders for an EDIT only, so an unshowable error would
    // have made Save do nothing at all with nothing said anywhere: the dead
    // button the noValidate comment above exists to prevent.
    // Gated on whether the field is SHOWN, not on whether this is an edit —
    // `showsPlannedField` is the narrower of the two, so keying off `editingShot`
    // could raise an error for an input that is not on screen. That is exactly
    // the dead Save button the noValidate comment above exists to prevent: the
    // submit blocked, and #planned-error never rendered to say why.
    // `plannedBound`, NOT `range`. `range` is the date-TAKEN bound and stops at
    // today; a planned date is allowed to be ahead, and `parsedPlanned` above
    // uses `toShotDate` accordingly. Naming `range` here told the user a planned
    // date cannot be after today, which is false — 2027-01-01 saves — while the
    // picker beside it offered exactly those dates. That is the same defect the
    // comment above records ("1900 to 2027 while the real bound was
    // 2027-08-13"), pointing the other way. Read fresh, for the same reason.
    const plannedBound = shotDateRange();
    const nextPlannedError =
      !showsPlannedField || plannedDraft.trim() === "" || parsedPlanned
        ? null
        : isRealDate(plannedDraft)
          ? `Check the year — dates run from ${plannedBound.min} to ${plannedBound.max}.`
          : "That isn’t a real calendar date.";

    setPlannedError(nextPlannedError);
    setDateError(nextDateError);
    setDoseError(nextDoseError);
    // `!parsedDate` is implied by nextDateError, but stating it narrows the type
    // so the branded CivilDate below can't be null.
    if (nextDateError || nextDoseError || nextPlannedError || !parsedDate) {
      // NOTHING MOVES. The summary appears in the pinned footer, which is
      // already on screen — so there is no jump to make, and the scroll
      // position you chose is kept. Nor does focus move on its own: focusing a
      // date input opens the picker, and the reward for pressing Save should
      // not be a calendar wheel over the message explaining why.
      setSaveAttempted(true);
      return;
    }

    const newShot: ShotEntry = {
      id: editingShot ? editingShot.id : newId(),
      // Store the parsed CivilDate, not the raw input, so the value written to
      // storage is the one the boundary validated — the parser's result is the
      // trust boundary, not just a yes/no gate.
      date: parsedDate,
      time: time || undefined,
      doseMg: parsedDose,
      injectionSite: injectionSite || undefined,
      injectionSitePosition: injectionSitePosition || undefined,
      testosteroneEster: testosteroneEster || undefined,
      carrierOil: carrierOil || undefined,
      pain: pain === "" ? undefined : pain,
      offDays: offDays || undefined,
      // ONLY in edit mode do these describe the shot in front of you. On a new
      // shot they are about the previous one and travel separately, below.
      // Written back unconditionally while editing — including when the block is
      // not rendered because the shot is too old to ask about — because
      // `updateShot` replaces the entry wholesale, so omitting them would wipe
      // an answer the user gave weeks ago.
      afterSoreness:
        editingShot && afterSoreness !== "" ? afterSoreness : undefined,
      afterLump:
        editingShot && afterLump !== "" ? afterLump === "yes" : undefined,
      notes: notes || undefined,
      // Frozen here and never recomputed. An emptied field means "no planned
      // date", which is a real answer rather than a prompt to guess one.
      // The parsed value, like `date` — the parser's result is the trust
      // boundary, not just a yes/no gate. On a new shot the field is not
      // rendered, so this is whatever planShot worked out, range-checked at
      // source.
      plannedFor: parsedPlanned ?? undefined,
    };

    // Against the RECORD, not against "is anything selected". The block seeds
    // from the subject shot, so an untouched question already holds its stored
    // value — sending `undefined` for it would delete an answer the user never
    // went near, and sending nothing when they cleared one would ignore them.
    const answeredAboutPrevious =
      !editingShot &&
      settledAsk.shotId !== undefined &&
      (afterSoreness !== afterSorenessBaseline ||
        afterLump !== afterLumpBaseline);
    const outcome =
      editingShot && onUpdateShot
        ? onUpdateShot(newShot)
        : answeredAboutPrevious
          ? onAddShot(newShot, {
              id: settledAsk.shotId as string,
              afterSoreness: afterSoreness || undefined,
              afterLump: afterLump === "" ? undefined : afterLump === "yes",
            })
          // No trailing `undefined`: a second argument that is always present
          // changes what every existing caller sees, and `toHaveBeenCalledWith`
          // is an exact argument-list match. The optional parameter should be
          // genuinely absent when there is nothing to say.
          : onAddShot(newShot);

    // Written only once the shot actually landed, and only when planShot had to
    // establish one — otherwise a failed save would leave an anchor behind for
    // a shot that does not exist, quietly fixing the grid to a date the user
    // never logged.
    // `=== "saved"`, not truthiness. SaveOutcome is a union of non-empty
    // strings, so "refused" and "ignored" are both truthy and the comment above
    // was describing behaviour the code did not have: a storage refusal — the
    // very case this sheet is held open for — would have frozen the grid to a
    // shot that never existed, with no UI to reset it.
    //
    // And only when LOGGING. An edit must never establish the grid, because
    // `anchorFrom` is the most recent date known — which, for a shot being
    // edited, is some LATER shot rather than the one in front of you. That is
    // precisely the anchoring measured as wrong in 1350 of 2250 cases: opening
    // a July shot to fix a typo persisted an anchor of the August shot's date,
    // and every on-rhythm shot logged afterwards then froze a permanent -7.
    //
    // The grid is something you establish by logging. Deciding it by opening an
    // old entry is not a thing a user could predict, and the anchor is invisible
    // with no UI to reset it. If no anchor exists yet, the next real log
    // establishes one — which is the behaviour without the edit anyway.
    if (outcome === "saved" && plan.anchorToPersist && !editingShot) {
      onAnchorEstablished?.(plan.anchorToPersist);
    }

    // The sheet is already leaving and this submit was dropped. Say nothing: the
    // shot the user is actually thinking about was saved by the press before
    // this one, and an assertive alert claiming otherwise sends them to log it
    // again — a duplicate, with no undo until slice C.
    if (outcome === "ignored") return;

    // A save that did not reach storage must leave the form exactly as it is.
    // Otherwise the sheet stays open (the parent holds it) showing empty fields,
    // which is worse than closing: the entry is neither on screen nor stored.
    //
    // It must also SAY so, here, inside the sheet. The storage banner is the
    // app's single surface for failed writes, but it lives in `#root`, which the
    // sheet marks `inert` and covers completely on a phone — so for the one
    // failure the user is actually watching for, the banner is unreadable,
    // unannounced, and its buttons unclickable until the sheet is gone. Without
    // this line the whole flow is: tap Save, nothing happens, no explanation.
    if (outcome === "refused") {
      setSaveFailed(true);
      return;
    }
    setSaveFailed(false);

    // No post-save field reset, deliberately. There used to be one here, on the
    // reasoning that the parent closes the sheet immediately so it was moot. The
    // ✓ beat ended that: the sheet now holds still for CONFIRM_MS and then takes
    // SHEET_EXIT_MS to leave, so for ~440ms the user was watching the entry they
    // had just typed empty itself under a message saying it was saved.
    // Screenshotted at 390px — the site and notes fields were back to their
    // placeholders while "✓ Saved" was still on the button.
    //
    // Nothing needs the reset. This form unmounts with the sheet and is remounted
    // fresh (keyed on the subject) the next time, seeded from the parent's draft
    // — which a successful save has just cleared. Carried-forward values re-derive
    // through carryForward on that mount. And a stray Escape or Back inside the
    // exit window cannot resurrect these values as a draft: `dismissSheet` bails
    // while the sheet is closing, which is the guard that actually prevents it.
  };

  const current: ShotDraft = {
    date,
    dateBaseline,
    plannedFor: plannedDraft,
    plannedBaseline,
    time,
    doseMg,
    injectionSite,
    injectionSitePosition,
    testosteroneEster,
    carrierOil,
    pain,
    offDays,
    afterSoreness,
    afterLump,
    afterSorenessBaseline,
    afterLumpBaseline,
    notes,
  };

  // Anything the user has entered that isn't in the underlying record yet —
  // measured against `opened` (the shot being edited, or a fresh form), never
  // against a restored draft, so restoring and re-parking doesn't read as clean.
  // Applies in both modes: editing an existing shot has unsaved input too.
  //
  // The date is compared against its own baseline rather than against `opened`,
  // because a required, always-populated field has no "empty" to mean "nothing
  // entered". Every other field can use that test directly.
  // `plannedFor` joins `date` in the explicit clause, and for the identical
  // reason: it is always populated once a cadence is set, so "differs from
  // empty" is not a test for "the user entered something". Compared generically
  // it would make a brand-new form dirty on open — the field seeds from what
  // the app computed, while `opened` holds "" — so "Clear form" would appear
  // and dismissing would confirm, on a form nobody had touched.
  // `afterSoreness` and `afterLump` join them for a third version of the same
  // reason: they seed from the SUBJECT SHOT's record, which `opened` is built
  // too early to know about, so measuring them generically made an untouched
  // sheet dirty the moment the previous shot already had an answer on it.
  const BASELINE_FIELDS: (keyof ShotDraft)[] = [
    "date",
    "dateBaseline",
    "plannedFor",
    "plannedBaseline",
    "afterSoreness",
    "afterLump",
    "afterSorenessBaseline",
    "afterLumpBaseline",
  ];
  const hasUnsavedInput =
    date !== dateBaseline ||
    plannedDraft !== plannedBaseline ||
    afterSoreness !== afterSorenessBaseline ||
    afterLump !== afterLumpBaseline ||
    (Object.keys(current) as (keyof ShotDraft)[])
      .filter((k) => !BASELINE_FIELDS.includes(k))
      .some((k) => current[k] !== opened[k]);

  // Whether the form currently shows exactly what a brand-new one would, right
  // now — today's date and nothing beyond the carried-forward values.
  const looksFresh =
    date === todayLocalISO() &&
    plannedDraft === plannedBaseline &&
    afterSoreness === afterSorenessBaseline &&
    afterLump === afterLumpBaseline &&
    (Object.keys(current) as (keyof ShotDraft)[])
      .filter((k) => !BASELINE_FIELDS.includes(k))
      .every((k) => current[k] === opened[k]);

  // Publish the live values for the parent to read on dismissal. In an effect
  // rather than during render so the render stays pure; effects run after every
  // render, so the ref is current well before any click or keypress.
  useEffect(() => {
    if (!liveDraftRef) return;
    // Published verbatim — no field is special-cased on the way out, so there is
    // no encoding here for the reader above to get wrong.
    liveDraftRef.current = hasUnsavedInput ? current : null;
  });

  return (
    // Three regions: a pinned bar, the scrolling fields, and a pinned action.
    // Save must stay reachable without scrolling past ten fields, and Close sits
    // top-left — away from the thumb, so it isn't hit by accident.
    <form className="shot-form" onSubmit={handleSubmit} noValidate>
      <div className="shot-form__bar shot-form__bar--top">
        {onDismiss && (
          <button
            type="button"
            className="shot-form__close"
            onClick={onDismiss}
            aria-label={editingShot ? "Cancel editing" : "Close"}
          >
            ✕
          </button>
        )}
        {/* Where focus LANDS when the sheet opens, and where "Clear form" hands
            it back to.

            Not the date field, which is what it used to be. `<input type="date">`
            focused by script is exactly what makes iOS Safari and Android Chrome
            throw up the date wheel — so opening the log sheet on a phone covered
            half the screen with a picker nobody had asked for, before you had
            even decided what to type. The same hazard this file already
            documented for "Clear form", not applied to the sheet's own opening.

            The heading summons no keyboard and no picker, names the region that
            just appeared for a screen reader, and keeps focus inside the trap.
            Not the ✕ either: landing there means a stray Enter dismisses the
            form you just opened. */}
        <h2
          id={headingId}
          className="shot-form__title"
          ref={headingRef}
          tabIndex={-1}
        >
          {editingShot ? "Edit shot" : "Log a shot"}
        </h2>
      </div>

      <div className="shot-form__scroll" ref={scrollRef}>
        {/* Marks the MINORITY, which here is the required field rather than the
            optional ones. Baymard's checkout research recommends marking BOTH
            explicitly, because unmarked fields make people guess — but their
            forms are mostly required, and this one is one-in-eleven. Tagging
            ten fields "(optional)" would put the noise on every field to
            disambiguate one, and the guess it protects against fails safe here:
            assume wrongly that dose is required and you fill in a dose, where
            assuming wrongly that a checkout field is optional blocks the order.
            So: one sentence for the ten, an explicit flag on the one. */}
        <p className="field-hint">
          Only the date is needed — fill in as much or as little of the rest as
          is useful to you.
        </p>
        <div className="form-row">
          {/* The error is a SIBLING of the label, never inside it: text inside a
            <label> becomes part of the field's accessible name, so an error
            message there would rename the field to "Date <the whole error>".
            aria-describedby is how it reaches assistive tech. */}
          <div className="field-cell">
            {/* The flag is a SIBLING of the label, for the same reason the
                error below is: text inside a <label> joins the field's
                accessible name, so nesting it names the field "Date Required"
                and screen readers then say "Date Required, required" — the
                `required` attribute already carries that. Hence `htmlFor`
                rather than wrapping, which is also why the accessible name
                stays exactly "Date". The visible word is for everyone else, and
                it is the word rather than an asterisk or a colour so that it
                survives being read literally (WCAG 1.4.1). */}
            <div className="field-head">
              <label htmlFor="shot-date-field">Date</label>
              <span className="field-flag" aria-hidden="true">
                Required
              </span>
            </div>
            <input
              id="shot-date-field"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                // Nothing to record here: the baseline already says what
                // "untouched" means, so the comparison below answers it.
                if (dateError) setDateError(null);
              }}
              // BLUR, not change. A date input reports a complete value the
              // moment three segments are filled, and typing a year fills them
              // repeatedly on the way: 0002, 0020, 0202, then 2026. Checking per
              // keystroke would flash "Check the year" three times AT someone
              // typing a year correctly — the premature-validation punishment
              // every guideline warns about, and the same intermediate values
              // this file already documents ("0202-03-15 on the way to 2021").
              //
              // Leaving the field is the moment you are done with it, so that is
              // when it answers. Submit keeps its own check as the backstop: the
              // field can be left untouched and still be wrong, since it starts
              // pre-filled.
              onBlur={(e) => {
                // Adopt the live value, not only judge it. Both sibling date
                // fields already do this and say why: WebKit fires `change`
                // unreliably — the picker's Reset fires none at all, and a
                // picked date can arrive carrying the PREVIOUS value — so
                // `date` can lag what the element holds.
                //
                // Validating `e.target.value` while storing `date` is the
                // overloaded-state shape in two variables: blur would call the
                // new value fine and Save would write the stale one, storing a
                // shot on a different day from the one on screen. By blur the
                // picker has closed and the element is correct, which is the
                // workaround those reports land on: read the input.
                setDate(e.target.value);
                setDateError(
                  takenDateProblem(e.target.value, editingShot?.date),
                );
              }}
              required
              // Keeps the native picker inside the range the form will accept,
              // so a mistyped year is harder to produce in the first place.
              // These are a hint, not the check — the form carries `noValidate`
              // and `toTakenDate` is what actually decides. See takenDateRange.
              min={takenRange.min}
              max={takenRange.max}
              aria-invalid={dateError ? true : undefined}
              aria-describedby={dateError ? "date-error" : undefined}
            />
            {dateError && (
              <span id="date-error" className="field-error" role="alert">
                {dateError}
              </span>
            )}
          </div>

          <div className="field-cell">
            <label>
              Time
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
            <div className="suggestion-chips">
              <button
                type="button"
                className="chip"
                onClick={() => setTime(nowHHMM())}
              >
                Now
              </button>
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="field-cell">
            <label>
              Dose (mg)
              <input
                type="number"
                min={0}
                // "any", not 1: fractional doses are ordinary (62.5mg, 12.5mg when
                // titrating), doseMg is a float in the model, and the field already
                // declares inputMode="decimal". With step=1 the browser silently
                // refused to submit a decimal dose — constraint validation blocks
                // the submit event, so the form just appeared to do nothing.
                step="any"
                inputMode="decimal"
                value={doseMg}
                onChange={(e) => {
                  setDoseMg(e.target.value);
                  // Like the date and planned fields beside it. Without this the
                  // dose error outlived its cause: type -5, press Save, correct
                  // it to 50, and the red message, `aria-invalid` AND the
                  // footer summary all kept naming a field already fixed —
                  // a standing "Not saved yet" about a problem that was gone.
                  // The summary's own comment calls the list live; this is what
                  // makes that true rather than true of two fields out of three.
                  if (doseError) setDoseError(null);
                }}
                placeholder="e.g. 50"
                aria-invalid={doseError ? true : undefined}
                aria-describedby={doseError ? "dose-error" : undefined}
              />
            </label>
            {doseError && (
              <span id="dose-error" className="field-error" role="alert">
                {doseError}
              </span>
            )}
            <SuggestionChips
              label="dose"
              suggestions={suggestions.dose}
              value={doseMg}
              onSelect={setDoseMg}
            />
          </div>

          <div className="field-cell">
            <label>
              Injection site
              <input
                type="text"
                value={injectionSite}
                onChange={(e) => setInjectionSite(e.target.value)}
                placeholder="e.g. thigh, glute, stomach"
                // Domain vocabulary the phone's dictionary does not have —
                // "cypionate", "enanthate", "cottonseed" — so iOS autocorrect
                // rewrites it into something it does know, mid-word, while you
                // look at the keyboard. These four are also the REUSED values:
                // a mangled one becomes a suggestion chip you tap again next
                // week, so the mistake compounds rather than sitting still.
                // (`suggestionsFor` already dedupes case-insensitively, so
                // capitalisation would not split the chip list — this is about
                // the letters, not the case.)
                // Notes is left alone: that is prose, where the phone's
                // help is help.
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <SuggestionChips
              label="injection site"
              suggestions={suggestions.site}
              value={injectionSite}
              onSelect={setInjectionSite}
            />
          </div>

          <div className="field-cell">
            <label>
              Position
              <input
                type="text"
                value={injectionSitePosition}
                onChange={(e) => setInjectionSitePosition(e.target.value)}
                placeholder="e.g. left, right, upper left"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <SuggestionChips
              label="position"
              suggestions={suggestions.position}
              value={injectionSitePosition}
              onSelect={setInjectionSitePosition}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="field-cell">
            <label>
              Type of T
              <input
                type="text"
                value={testosteroneEster}
                onChange={(e) => setTestosteroneEster(e.target.value)}
                placeholder="e.g. cypionate, enanthate, undecanoate"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <SuggestionChips
              label="testosterone type"
              suggestions={suggestions.ester}
              value={testosteroneEster}
              onSelect={setTestosteroneEster}
            />
          </div>

          <div className="field-cell">
            <label>
              Carrier oil
              <input
                type="text"
                value={carrierOil}
                onChange={(e) => setCarrierOil(e.target.value)}
                placeholder="e.g. cottonseed, sesame"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <SuggestionChips
              label="carrier oil"
              suggestions={suggestions.oil}
              value={carrierOil}
              onSelect={setCarrierOil}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="field-cell">
            {/* A fieldset with a legend, because four mutually exclusive options
                are a radio group — not the `aria-current` the suggestion chips
                use ("the current item in a set") and not `aria-pressed` (a
                toggle). Native radios also bring arrow-key movement, which a
                hand-rolled chip group would have to reimplement.

                "Injection pain", not "How the injection felt": the label has to
                say what is being asked without the chips explaining it, and a
                noun phrase matches every other label on this sheet. It also
                contrasts with the after-soreness question B½ adds later. */}
            <fieldset className="pain-field">
              <legend>Injection pain</legend>
              <div className="pain-chips">
                {PAIN_LEVELS.map((level) => (
                  <label
                    key={level}
                    className={`pain-chip pain-chip--${level}${
                      pain === level ? " pain-chip--on" : ""
                    }`}
                  >
                    <input
                      ref={
                        level === PAIN_LEVELS[0] ? firstPainChipRef : undefined
                      }
                      type="radio"
                      name="pain"
                      value={level}
                      checked={pain === level}
                      onChange={() => setPain(level)}
                    />
                    {painLabel(level)}
                  </label>
                ))}
              </div>
            </fieldset>
            {/* Only once something is set, and it is the ONLY way back to "not
                recorded" — which is a different fact from "none". Without it a
                mis-tap on an optional field would be permanent. */}
            {pain !== "" && (
              <button
                type="button"
                className="link-button field-clear"
                // Named for what it clears. It sits OUTSIDE the fieldset, so the
                // group's name is not in its accessible context — a screen
                // reader browsing by button hears only "Clear", beside a
                // separate "Clear form" in the same dialog.
                aria-label="Clear injection pain"
                onClick={() => {
                  setPain("");
                  // This control removes ITSELF — the condition that renders it
                  // is the value it just cleared — so it has to hand focus on
                  // before it goes. Measured: without this, activating it left
                  // `document.activeElement` on <body>, inside a dialog whose
                  // #root is inert, where the next Tab has nothing to wrap from
                  // and the trap cannot re-engage. That is the nine-defect class
                  // from slice B, and the "Clear form" button below carries a
                  // comment warning against exactly this shape.
                  //
                  // Back to the group it belongs to, not the heading: you are
                  // still answering this question, and the first chip is where
                  // the answer starts. Not a date input either — focusing one
                  // from a click handler is what raises the picker on iOS, as
                  // resetForm already documents.
                  handOffFocus(firstPainChipRef, headingRef);
                }}
              >
                Clear
              </button>
            )}
          </div>

        </div>

        {/* Only when the settings answer the question. With no cadence there is
            nothing to show and nothing to correct, so the field is absent
            rather than empty. */}
        {/* Only when EDITING a saved shot. On a new one it was clutter in the
            middle of the fast path — the app has just worked the date out, and
            asking you to review it turns a two-tap log into a decision. There is
            nothing to correct until there is something saved.

            Keyed to `editingShot`, which cannot change while the sheet is open,
            so the field can never unmount from under the focus it holds — a
            transient condition here would strand focus on <body> inside a
            dialog, where the Tab trap cannot re-engage. */}
        {showsPlannedField && (
          <div className="field-cell">
            <label className="form-column">
              Planned for
              <input
                type="date"
                value={plannedDraft}
                min={plannedRange.min}
                max={plannedRange.max}
                onChange={(e) => {
                  setPlannedDraft(e.target.value);
                  if (plannedError) setPlannedError(null);
                }}
                aria-invalid={plannedError ? true : undefined}
                // The hint explains what this field IS — the only place a
                // frozen planned date can be corrected — so it has to reach
                // assistive tech, not just sighted readers. Every other new
                // field on this branch wires its hint up; this one was the odd
                // one out. The error joins it rather than replacing it.
                aria-describedby={
                  plannedError ? "planned-error planned-hint" : "planned-hint"
                }
              />
            </label>
            {plannedError && (
              <span id="planned-error" className="field-error" role="alert">
                {plannedError}
              </span>
            )}
            <p className="field-hint" id="planned-hint">
              Worked out from how often you inject, and kept as it was when you
              logged it. Change it here if this shot was always meant to be a
              different day.
            </p>
          </div>
        )}

        {/* Out of the pain row and down here, next to the question about the shot
            it shares a window with. It used to sit beside "Injection pain" in a
            `.form-row`, which put a field about the PREVIOUS interval in the
            middle of the fields about this shot, with "Planned for" separating
            it from the other retrospective question.

            The `.field-cell` wrapper stays. It is no longer holding a flex row
            open — that was the bug it was added for, where a bare fieldset took
            the row and crushed the pain group to 8px — but it still carries the
            `min-width: 0` that keeps a fieldset from defaulting to min-content.

            Inside it, the same shape as the pain group: native radios in a
            fieldset, so arrow keys roam the group for free and it is one tab
            stop, which `useFocusTrap` already handles for an unchecked
            group. */}
        <div className="field-cell">
          <fieldset className="off-days-field">
            {/* The window lives INSIDE the legend, so it is part of the
                group's accessible NAME rather than a description of it.
                `aria-describedby` on a fieldset was the first attempt and it
                was a prediction, not a measurement: group-level descriptions
                are announced inconsistently, and iOS VoiceOver — this app's
                primary platform — does not reliably surface fieldset
                semantics at all. A name is announced on entering the group by
                every AT there is, so this shape does not depend on support we
                cannot check from here. It reads the same on screen. */}
            <legend>
              {/* The explicit space is load-bearing. JSX strips the newline
                  between this text and the expression below, so the group's
                  accessible name computed as "...felt off?The 13 days..." —
                  measured. The span is `display: block`, so nothing shows the
                  join on screen and only the NAME is wrong. */}
              Any days you felt off?{" "}
              {/* The recall window, named rather than assumed. Never "this week":
              cadence here runs from 3 to 14 days, so a fixed word would be
              wrong for most people. It says which shot you are answering
              about, which is also what lets the four answers keep one meaning
              each at any interval length — the chips do not change, the span
              does. */}
              {/* Unconditional. It used to render only when the length was
                  known, which hid the anchor on a first entry — the one shot
                  where nothing else on screen says what window is being asked
                  about. `offDaysWindowLabel` now always names the window and
                  adds the length only when it has one. */}
              <span className="off-days-field__span">{offDaysSpan}</span>
            </legend>
            {/* Rows, not chips. Choice chips are specified for "one to two
                short words", which the pain group fits and this one never
                did — "Right before this one" measured 158.6px against
                Moderate's 77, so four wrapped to two or three lines and a
                wrapped grid has no reading order left to follow. A radio LIST
                is the control for single-select with longer labels. */}
            <div className="off-days-rows">
              {OFF_DAYS_PATTERNS.map((pattern) => (
                <label
                  key={pattern}
                  className={`off-days-row${
                    offDays === pattern ? " off-days-row--on" : ""
                  }`}
                >
                  <input
                    ref={
                      pattern === OFF_DAYS_PATTERNS[0]
                        ? firstOffDaysChipRef
                        : undefined
                    }
                    type="radio"
                    name="offDays"
                    value={pattern}
                    checked={offDays === pattern}
                    onChange={() => setOffDays(pattern)}
                    // The visible text is short because the strip draws the
                    // position; this is where that position stays available to
                    // anyone who cannot see the strip. It always begins with
                    // the visible label, which is what WCAG 2.5.3 asks for and
                    // what keeps "tap Early on" working in voice control.
                    aria-label={offDaysSpokenLabel(pattern)}
                  />
                  <span className="off-days-row__mark" aria-hidden="true" />
                  <span className="off-days-row__label">
                    {offDaysShortLabel(pattern)}
                  </span>
                  {/* Decorative, and safely so: `offDaysSpokenLabel` above
                      carries the same fact in words. Three of the five light
                      the same NUMBER of slots in different places, which is
                      the whole reason to draw it — a count cannot tell them
                      apart and the position can. */}
                  <span className="off-days-row__strip" aria-hidden="true">
                    {offDaysStrip(pattern).map((on, i) => (
                      <i key={i} className={on ? "is-off" : undefined} />
                    ))}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {/* Only once something is set, and the only way back to "not
            recorded" — a different fact from "not really". Same control, same
            reasoning and same focus hand-off as the pain group's. */}
          {offDays !== "" && (
            <button
              type="button"
              className="link-button field-clear"
              // Named for what it clears: outside the fieldset, a screen reader
              // browsing by button hears only "Clear", beside a separate "Clear
              // form" in the same dialog.
              aria-label="Clear off days"
              onClick={() => {
                setOffDays("");
                // Removes ITSELF — the condition rendering it is the value it
                // just cleared — so it hands focus on first, back to the group
                // it belongs to. Without this, focus lands on <body> inside a
                // dialog whose #root is inert, where the trap cannot re-engage.
                handOffFocus(firstOffDaysChipRef, headingRef);
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Directly under "Any days you felt off?", because when logging they
            are two questions about the same stretch of time — the interval that
            just closed — and they used to be split by "Planned for", a field
            about the shot in front of you.

            They keep SEPARATE headings rather than merging under one, because
            when EDITING they are not about the same window at all: off days is
            the interval before that shot, and this is how that shot settled
            afterwards. One heading would be wrong for half the cases.

            When logging, still rendered only when the elapsed time can settle
            at least one question — an answer that cannot yet be true gets
            skipped or guessed. Editing always asks; see `liveSettledAsk`. */}
        {(settledAsk.durations.length > 0 || settledAsk.lump) && (
          <section className="prev-shot">
            <h3 className="prev-shot__title">{settledAsk.heading}</h3>
            <p className="prev-shot__sub">{settledAsk.sub}</p>
            {settledAsk.durations.length > 0 && (
              <fieldset className="prev-shot__field">
                <legend>How long was it sore?</legend>
                <div
                  className={`prev-shot__chips${
                    settledAsk.durations.length === 3
                      ? " prev-shot__chips--three"
                      : ""
                  }`}
                >
                  {settledAsk.durations.map((level, i) => (
                    <label
                      key={level}
                      className={`prev-shot__chip${
                        afterSoreness === level ? " prev-shot__chip--on" : ""
                      }`}
                    >
                      <input
                        ref={i === 0 ? firstSorenessChipRef : undefined}
                        type="radio"
                        name="afterSoreness"
                        value={level}
                        checked={afterSoreness === level}
                        onChange={() => setAfterSoreness(level)}
                      />
                      {sorenessShortLabel(level)}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {settledAsk.lump && (
              <fieldset className="prev-shot__field">
                <legend>Any lump that hasn’t absorbed?</legend>
                <div className="prev-shot__chips prev-shot__chips--pair">
                  {(["no", "yes"] as const).map((value) => (
                    <label
                      key={value}
                      className={`prev-shot__chip${
                        afterLump === value ? " prev-shot__chip--on" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="afterLump"
                        value={value}
                        checked={afterLump === value}
                        onChange={() => setAfterLump(value)}
                      />
                      {value === "no" ? "No" : "Yes"}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {/* Same control, same reasoning and same focus hand-off as the pain
                and off-days groups': the only way back to "not recorded". */}
            {(afterSoreness !== "" || afterLump !== "") && (
              <button
                type="button"
                className="link-button field-clear"
                aria-label="Clear how it settled"
                onClick={() => {
                  setAfterSoreness("");
                  setAfterLump("");
                  handOffFocus(firstSorenessChipRef, headingRef);
                }}
              >
                Clear
              </button>
            )}
          </section>
        )}

        <label className="form-column">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Anything you want to remember for later..."
          />
        </label>

        {/* Closing keeps what you typed, so discarding needs its own control —
            but a quiet one, at the end of the fields rather than competing with
            Save. Only offered once there is something to clear.
            `looksFresh` covers the case where the form reports unsaved input but
            shows nothing a fresh form wouldn't: a date chosen yesterday can be
            today by the time the draft is reopened. Offering "Clear form" there
            invites a tap that visibly does nothing. This decides only what is
            RENDERED — never what is parked or saved — so unlike the dirtiness
            rules it is safe to judge against the live clock. */}
        {hasUnsavedInput && !editingShot && !looksFresh && (
          <button
            type="button"
            className="link-button"
            // Dead during the ✓, for the same reason the submit is. The sheet is
            // fully on screen and motionless for CONFIRM_MS after a successful
            // save, and this is the one control there that CHANGES what you are
            // looking at: it blanks every field and moves focus to the heading —
            // the entry emptying itself under a message saying it was saved,
            // which is the defect the post-save reset was deleted to prevent.
            // Editing a field in that window is harmless by comparison (nothing
            // more is stored and the form is about to unmount), and the ✕ leads
            // where it always did, so neither needs blocking.
            //
            // Guarded rather than un-rendered: pulling a control out from under
            // a thumb mid-press is its own bug, and it could be holding focus.
            aria-disabled={confirming}
            onClick={() => {
              if (confirming) return;
              resetForm();
            }}
          >
            Clear form
          </button>
        )}
      </div>

      <div className="shot-form__bar shot-form__bar--bottom">
        {/* Above the button, in the one region of this sheet that is always on
            screen — the reply arrives where the question was asked.

            It used to sit at the top of the scroller, on GOV.UK's error-summary
            pattern. That pattern moves focus to the top because on a long PAGE
            the response would otherwise be lost off screen; this footer is
            pinned, so it cannot be lost, and the scroll was a 500px jump buying
            nothing. It also depended on the date happening to be the first
            field: the moment the dose was the problem, the top showed a summary
            and not the field, and you were hunting anyway.

            `role="alert"`, and it was NOT — on the reasoning that the field
            messages already carry one, so a screen-reader user had always been
            told why. That was true while errors could only originate at submit.
            BLUR VALIDATION BROKE IT, and this is the same equivalence the
            `saveAttempted` comment above records as broken; I applied the
            insight there and not here.

            Measured: blur with a bad date (the field alert announces once),
            then press Save. `setDateError` writes the IDENTICAL string, so
            React mutates nothing and no announcement fires — and the summary
            was a plain paragraph. The button produced no audible feedback at
            all, which is the same "did that do anything?" the summary exists to
            answer, for the people who cannot see it appear.

            The cost is that both can announce when a save is refused without a
            blur first. That is the right way round: a headline and its detail
            said twice beats a button that says nothing.

            This slot is shared with the storage banner below, and they cannot
            collide: a validation failure means the save never ran, a storage
            failure means it ran and the device refused. */}
        {saveAttempted && blockedFields.length > 0 && (
          <p className="shot-form__blocked" role="alert">
            {/* Names the PROBLEM, not a chore. "Check the date" asks you to go
                and look; it does not say what you would find, so the summary
                read as an errand while the reason sat elsewhere. Saying the
                date is invalid also matches the field's own words, so the two
                describe one fault in one vocabulary rather than two. */}
            <strong>Not saved yet.</strong> The{" "}
            {/* One button per field, each going to its own. A real button, so
                the keyboard and a screen reader get the same route a thumb
                does, and it FOCUSES rather than merely scrolling: focusing a
                date input opens the picker, which is unwelcome when the app
                does it uninvited and fine when you asked to go there. */}
            {blockedFields.map((field, i) => (
              <React.Fragment key={field.describedBy}>
                {i > 0 && <>{" and the "}</>}
                <button
                  type="button"
                  className="shot-form__blocked-jump"
                  onClick={() => focusProblem(field.describedBy)}
                >
                  {field.label}
                </button>
              </React.Fragment>
            ))}{" "}
            {blockedFields.length > 1 ? "are" : "is"} invalid.
          </p>
        )}
        {saveFailed && (
          <div className="shot-form__save-error" role="alert">
            <p className="shot-form__save-error-text">
              <strong>Couldn’t save this shot.</strong> Storage may be full, or
              private browsing may be blocking it. Nothing you typed has been
              lost.
            </p>
            {/* The button is HERE rather than a sentence pointing at Settings.
                Retrying is the only other move, and on a genuinely full device
                it will keep failing — so telling someone to go and export, from
                a sheet that covers Settings and cannot be left without closing
                the form, is advice they cannot take at the moment they need it. */}
            <button
              type="button"
              className="shot-form__save-error-export"
              // `?? false` so an unwired handler counts as a failure rather than
              // a success. `=== false` read `undefined` as fine, which made the
              // button silently dead — the exact thing this panel exists to stop.
              onClick={() => setExportFailed(!(onExportBackup?.() ?? false))}
            >
              Export a backup
            </button>
            {/* Said plainly, because the reassuring reading is the wrong one: the
                file is built from what has been saved, and this shot deliberately
                has not been. It protects the history, not the entry on screen —
                that is what holding the form open is for. */}
            <p className="shot-form__save-error-fine">
              {exportFailed
                ? "The download didn’t start — the browser may be blocking it, or there may be no space left."
                : "Saves your logged shots to a file. This one isn’t in it yet — it stays on screen until it saves."}
            </p>
          </div>
        )}
        {/* Relabels after a refused write, and stays relabelled until the save
            lands: "Save shot" would be naming an outcome the previous press did
            not produce. This button IS the retry — the form deliberately has no
            second one, since two controls submitting the same form only make you
            choose between them.

            "Save again" rather than the banner's "Try again", which was the first
            attempt. A button label's one job is to say what pressing it does, and
            a bare "Try again" drops the verb: read on its own — which is exactly
            how a screen reader offers it in a list of buttons — it could be
            retrying anything. Both halves are built from the same verb here so
            they cannot drift into naming different actions.

            The label reverts on its own everywhere the form starts over:
            `saveFailed` is component state, and App keys this form by the shot
            being edited inside a sheet that unmounts on close — so a new entry, a
            different shot, "Clear form" and a reload each get a fresh one. There
            is nothing to persist and nothing to time out. */}
        {/* The ✓ replaces the label rather than sitting beside it, so the button
            does not resize under the thumb at the moment it is pressed.
            `aria-live="polite"` on the button would fight the greeting slot's
            own announcement, so this stays silent and the line does the talking. */}
        <button
          type="submit"
          className={`primary-button shot-form__save${
            confirming ? " shot-form__save--confirmed" : ""
          }`}
          // `aria-disabled`, NOT `disabled`. Disabling the focused button blurs
          // it, and the browser drops focus to <body> for the whole confirm +
          // exit — the class CLAUDE.md calls non-negotiable, with nothing handing
          // focus on. It also falsified the Tab trap's assumption that the
          // sheet's Save button is "last and always enabled". The submit guard
          // below does the actual blocking.
          aria-disabled={confirming}
        >
          {/* The ✓ mirrors the verb that was pressed — "Update shot" is answered
              by "✓ Updated", not by a word the user did not use. Same fact
              either way: the write landed. */}
          {confirming ? (
            <>
              {/* aria-hidden so the glyph stays out of the accessible NAME:
                  unwrapped it announced as "check mark Saved" (or worse, "white
                  heavy check mark"), which is the decoration reading itself
                  aloud. The word carries the meaning; the tick is the beat. */}
              <span aria-hidden="true">✓</span>{" "}
              {editingShot ? "Updated" : "Saved"}
            </>
          ) : (
            `${editingShot ? "Update" : "Save"} ${saveFailed ? "again" : "shot"}`
          )}
        </button>
      </div>
    </form>
  );
};
