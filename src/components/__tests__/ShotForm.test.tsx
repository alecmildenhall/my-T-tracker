import React from "react";
import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShotForm, type ShotDraft } from "../ShotForm";
import { OFF_DAYS_PATTERNS, type ShotEntry } from "../../types/shot";
import type { SaveOutcome } from "../ShotForm";
import type { Profile } from "../../types/profile";
import { todayLocalISO } from "../../utils/datetime";
import { expectFocusSomewhereUseful } from "../../test/focus";
import { expectVisibleFocusRing } from "../../test/focusRing";
import {
  isShotDateInRange,
  shotDateRange,
  takenDateRange,
} from "../../utils/civilDate";
import { addDaysCivil } from "../../utils/schedule";

beforeEach(() => {
  localStorage.clear();
});

const history: ShotEntry[] = [
  {
    id: "1",
    date: "2026-07-01",
    doseMg: 50,
    injectionSite: "thigh",
    testosteroneEster: "cypionate",
    carrierOil: "cottonseed",
  },
];

const esterInput = () =>
  screen.getByPlaceholderText(/cypionate, enanthate/i) as HTMLInputElement;
const oilInput = () =>
  screen.getByPlaceholderText(/cottonseed, sesame/i) as HTMLInputElement;

describe("ShotForm suggestion chips", () => {
  it("renders chips from past entries and fills the field when a chip is tapped", () => {
    render(<ShotForm onAddShot={vi.fn()} shots={history} />);

    fireEvent.click(screen.getByRole("button", { name: "cypionate" }));

    expect(esterInput().value).toBe("cypionate");
  });

  it("renders no chips when there is no history", () => {
    render(<ShotForm onAddShot={vi.fn()} shots={[]} />);

    expect(screen.queryByRole("button", { name: "cypionate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "cottonseed" })).toBeNull();
  });

  // These two used to save and then assert on the SAME mounted form, because the
  // form cleared its own fields after a successful save. That reset is gone: it
  // was only ever reachable while the sheet was leaving, and with the ✓ beat
  // holding the sheet still for 440ms the user watched their entry empty itself
  // under a message saying it had been saved.
  //
  // The behaviour they were guarding is unchanged and still worth guarding —
  // it is just delivered by the next MOUNT, seeded from history through
  // carryForward, which is what the sheet actually does on every open. So they
  // now save, then render the form again with the saved shot in history.
  const saveAndReopen = (onAddShot: ReturnType<typeof vi.fn>) => {
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));
    expect(onAddShot).toHaveBeenCalledTimes(1);
    return onAddShot.mock.calls[0][0] as ShotEntry;
  };

  it("carries dose/type/oil into the next shot, but not the injection site", () => {
    const onAddShot = vi.fn();
    const first = render(<ShotForm onAddShot={onAddShot} shots={history} />);

    fireEvent.click(screen.getByRole("button", { name: "50" }));
    fireEvent.click(screen.getByRole("button", { name: "cypionate" }));
    fireEvent.click(screen.getByRole("button", { name: "cottonseed" }));
    fireEvent.click(screen.getByRole("button", { name: "thigh" }));
    const saved = saveAndReopen(onAddShot);
    first.unmount();

    render(<ShotForm onAddShot={vi.fn()} shots={[...history, saved]} />);

    // Values that stay the same shot-to-shot persist, so a repeat needs no re-entry.
    expect(
      (screen.getByPlaceholderText("e.g. 50") as HTMLInputElement).value,
    ).toBe("50");
    expect(esterInput().value).toBe("cypionate");
    expect(oilInput().value).toBe("cottonseed");
    // Injection site does not — it's commonly rotated.
    expect(
      (
        screen.getByPlaceholderText(
          /thigh, glute, stomach/i,
        ) as HTMLInputElement
      ).value,
    ).toBe("");
  });

  it("starts the next shot with per-shot fields empty (site, position, pain, off days, notes)", () => {
    const onAddShot = vi.fn();
    const first = render(<ShotForm onAddShot={onAddShot} shots={history} />);

    fireEvent.change(screen.getByPlaceholderText(/thigh, glute, stomach/i), {
      target: { value: "bicep" },
    });
    fireEvent.change(screen.getByPlaceholderText(/left, right, upper left/i), {
      target: { value: "left" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Moderate" }));
    fireEvent.click(screen.getByRole("radio", { name: /^Here and there/ }));
    fireEvent.change(screen.getByPlaceholderText(/remember for later/i), {
      target: { value: "felt fine" },
    });

    // Still on screen at the moment of saving: the sheet is visibly there for the
    // ✓ and the slide, and blanking the entry under a success message reads as
    // losing it.
    const saved = saveAndReopen(onAddShot);
    expect(
      (
        screen.getByPlaceholderText(
          /remember for later/i,
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("felt fine");
    first.unmount();

    render(<ShotForm onAddShot={vi.fn()} shots={[...history, saved]} />);

    expect(
      (
        screen.getByPlaceholderText(
          /thigh, glute, stomach/i,
        ) as HTMLInputElement
      ).value,
    ).toBe("");
    expect(
      (
        screen.getByPlaceholderText(
          /left, right, upper left/i,
        ) as HTMLInputElement
      ).value,
    ).toBe("");
    // BOTH chip groups reset to nothing selected, not to their first option —
    // which would put an answer on a shot nobody answered for. `getAllByRole`
    // covers pain and off days together, so a new group added to this sheet is
    // held to the same rule without anyone remembering to add it here.
    screen
      .getAllByRole("radio")
      .forEach((chip) => expect(chip).not.toBeChecked());
    expect(
      (
        screen.getByPlaceholderText(
          /remember for later/i,
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("");
  });

  it("offers a dose chip from history and fills the dose field when tapped", () => {
    render(<ShotForm onAddShot={vi.fn()} shots={history} />);

    fireEvent.click(screen.getByRole("button", { name: "50" }));

    const dose = screen.getByPlaceholderText("e.g. 50") as HTMLInputElement;
    expect(dose.value).toBe("50");
  });

  it("does not pre-fill pain, so an untouched shot records no pain score", () => {
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} shots={history} />);

    // Nothing selected, which is a different state from "None" — that is an
    // answer, and an untouched shot has not given one.
    screen
      .getAllByRole("radio")
      .forEach((chip) => expect(chip).not.toBeChecked());

    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    const saved = onAddShot.mock.calls[0][0] as ShotEntry;
    expect(saved.pain).toBeUndefined();
  });

  it("fills the time field with the current time when Now is tapped", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T14:05:00"));
    try {
      render(<ShotForm onAddShot={vi.fn()} shots={[]} />);

      const time = screen.getByLabelText("Time") as HTMLInputElement;
      expect(time.value).toBe("");

      fireEvent.click(screen.getByRole("button", { name: "Now" }));

      expect(time.value).toBe("14:05");
    } finally {
      vi.useRealTimers();
    }
  });

  it("populates the fields when editing an existing shot", () => {
    const editing: ShotEntry = {
      id: "9",
      date: "2026-06-01",
      testosteroneEster: "enanthate",
      carrierOil: "sesame",
    };

    render(
      <ShotForm
        onAddShot={vi.fn()}
        onUpdateShot={vi.fn()}
        editingShot={editing}
        shots={history}
      />,
    );

    expect(esterInput().value).toBe("enanthate");
    expect(oilInput().value).toBe("sesame");
  });
});

describe("ShotForm field mapping", () => {
  it("saves every field to the property it belongs to", () => {
    // Exercises all ten onChange handlers in one pass, and — more usefully —
    // pins the field-to-model mapping. A field wired to the wrong property
    // (mood into notes, position into site) would still look right on screen and
    // still round-trip through the form; only the saved object reveals it.
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} />);

    const byLabel = (text: string) =>
      screen.getByLabelText(text) as HTMLInputElement | HTMLTextAreaElement;

    fireEvent.change(byLabel("Date"), { target: { value: "2026-06-15" } });
    fireEvent.change(byLabel("Time"), { target: { value: "20:45" } });
    fireEvent.change(byLabel("Dose (mg)"), { target: { value: "62.5" } });
    fireEvent.change(byLabel("Injection site"), { target: { value: "glute" } });
    fireEvent.change(byLabel("Position"), { target: { value: "right" } });
    fireEvent.change(byLabel("Type of T"), { target: { value: "enanthate" } });
    fireEvent.change(byLabel("Carrier oil"), { target: { value: "sesame" } });
    fireEvent.click(screen.getByRole("radio", { name: "Moderate" }));
    fireEvent.click(screen.getByRole("radio", { name: /^Right before/ }));
    fireEvent.change(byLabel("Notes"), { target: { value: "smooth one" } });

    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot).toHaveBeenCalledTimes(1);
    const saved = onAddShot.mock.calls[0][0] as ShotEntry;
    expect(saved).toMatchObject({
      date: "2026-06-15",
      time: "20:45",
      doseMg: 62.5,
      injectionSite: "glute",
      injectionSitePosition: "right",
      testosteroneEster: "enanthate",
      carrierOil: "sesame",
      pain: "moderate",
      offDays: "right-before",
      notes: "smooth one",
    });
    expect(saved.id).toBeTruthy();
  });

  it("asks for the date when it is missing, rather than calling it invalid", () => {
    // The form carries `noValidate`, so a missing date no longer bounces off the
    // browser's `required` check — it reaches our validation, and must say so
    // rather than leaving Save looking broken.
    //
    // Blank and malformed are different mistakes. A blank date is almost always
    // "meant to fill it in and forgot", and telling that person their date is not
    // a real calendar date answers a question they did not ask.
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} />);
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Add the date this shot was taken.",
    );
    expect(screen.getByLabelText("Date")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    // Typing a date clears the message as you go, not only on the next submit.
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-06-15" },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says the date is wrong when you LEAVE the field, not at submit", () => {
    // Waiting for Save meant typing a future date, filling in six more fields,
    // and only then being told the first one was wrong.
    render(<ShotForm onAddShot={vi.fn()} />);
    const date = screen.getByLabelText("Date");
    fireEvent.change(date, {
      target: { value: addDaysCivil(takenDateRange().max, 1) },
    });
    expect(screen.queryByRole("alert")).toBeNull(); // nothing yet
    fireEvent.blur(date);
    expect(screen.getByRole("alert")).toHaveTextContent(/later than today/);
  });

  it("stays quiet while a year is still being typed", () => {
    // Why blur and not change. A date input reports a COMPLETE value the moment
    // three segments are filled, and typing a year fills them again and again on
    // the way — 0002, 0020, 0202, then 2026 — so a per-keystroke check would
    // flash "Check the year" three times at someone typing one correctly.
    render(<ShotForm onAddShot={vi.fn()} />);
    const date = screen.getByLabelText("Date");
    for (const partial of ["0002-03-15", "0020-03-15", "0202-03-15"]) {
      fireEvent.change(date, { target: { value: partial } });
      expect(screen.queryByRole("alert")).toBeNull();
    }
    fireEvent.change(date, { target: { value: "2026-03-15" } });
    fireEvent.blur(date);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not nag about an unchanged stored date on blur either", () => {
    // The edit escape hatch reaches the blur check too, or tabbing through a
    // restored future-dated shot would raise an error about a field the person
    // never touched.
    const future = addDaysCivil(takenDateRange().max, 30);
    render(
      <ShotForm
        onAddShot={vi.fn()}
        onUpdateShot={vi.fn()}
        editingShot={{ id: "e1", date: future, notes: "orig" }}
      />,
    );
    fireEvent.blur(screen.getByLabelText("Date"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("still says so when a refused draft is reopened", () => {
    // Dismissing keeps everything you typed, so reopening brought back a date
    // the form had already refused with nothing left saying so — the message
    // gone, the field looking ordinary, the refusal waiting to be rediscovered
    // at Save. Derived from the restored value, so it cannot go missing.
    const future = addDaysCivil(takenDateRange().max, 1);
    render(
      <ShotForm
        onAddShot={vi.fn()}
        draft={{
          date: future,
          dateBaseline: takenDateRange().max,
          time: "",
          doseMg: "",
          injectionSite: "",
          injectionSitePosition: "",
          testosteroneEster: "",
          carrierOil: "",
          pain: "",
          offDays: "",
          notes: "",
          plannedFor: "",
          plannedBaseline: "",
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/later than today/);
  });

  it("opens silent on a fresh sheet", () => {
    // The mirror: today is pre-filled and valid, so a new sheet must not greet
    // anyone with an error about a field they have not touched.
    render(<ShotForm onAddShot={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does NOT claim 'not saved yet' before you have tried to save", () => {
    // Caught on the real build after blur validation landed. The summary was
    // derived from "is an error showing", which had meant "a save was refused"
    // right up until blur could raise one — so leaving the date field greeted
    // you with "Not saved yet" about a save you had never attempted.
    render(<ShotForm onAddShot={vi.fn()} />);
    const date = screen.getByLabelText("Date");
    fireEvent.change(date, {
      target: { value: addDaysCivil(takenDateRange().max, 1) },
    });
    fireEvent.blur(date);

    expect(screen.getByRole("alert")).toHaveTextContent(/later than today/);
    expect(screen.queryByText(/Not saved yet/)).toBeNull();
  });

  it("says the save was refused, above the button you pressed", () => {
    // The defect: reaching Save means scrolling past the field message, so
    // pressing it changed nothing the user could see and the button read as
    // broken. The summary lives in the pinned footer, which is the one region
    // that is always on screen — so nothing has to move to show it.
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} />);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: addDaysCivil(takenDateRange().max, 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(screen.getByText(/Not saved yet/)).toBeInTheDocument();
    // The field names are a real button, so a keyboard and a screen reader get
    // the same route to the problem that a thumb does.
    expect(screen.getByRole("button", { name: "date" })).toBeInTheDocument();
  });

  it("names the problem rather than setting a chore", () => {
    // "Check the date" asked you to go and look without saying what you would
    // find. It also matches the field's own wording now, so the two describe
    // one fault in one vocabulary.
    render(<ShotForm onAddShot={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: addDaysCivil(takenDateRange().max, 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(
      screen.getByText((_, el) => el?.textContent === "Not saved yet. The date is invalid."),
    ).toBeInTheDocument();
  });

  it("agrees in number when two fields are wrong", () => {
    // The easy thing to get wrong, and nothing else would catch it: with two
    // fields the sentence needs "are", not "is".
    render(<ShotForm onAddShot={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: addDaysCivil(takenDateRange().max, 1) },
    });
    fireEvent.change(screen.getByLabelText("Dose (mg)"), {
      target: { value: "-5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(
      screen.getByText((_, el) =>
        el?.textContent === "Not saved yet. The date and the dose are invalid.",
      ),
    ).toBeInTheDocument();
  });

  it("takes you to the offending field when you ask", () => {
    render(<ShotForm onAddShot={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: addDaysCivil(takenDateRange().max, 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));
    fireEvent.click(screen.getByRole("button", { name: "date" }));

    expect(document.activeElement).toBe(screen.getByLabelText("Date"));
  });

  it("keeps ONE alert, so the refusal is announced once", () => {
    // The summary is deliberately not an alert. The field message already is,
    // and role=alert announces wherever the element sits — so a screen-reader
    // user was always told why. The defect was positional, and a second alert
    // would announce the same refusal twice to the people it never affected.
    render(<ShotForm onAddShot={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: addDaysCivil(takenDateRange().max, 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("takes the summary away when the field is fixed", () => {
    render(<ShotForm onAddShot={vi.fn()} />);
    const date = screen.getByLabelText("Date");
    fireEvent.change(date, {
      target: { value: addDaysCivil(takenDateRange().max, 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));
    expect(screen.getByText(/Not saved yet/)).toBeInTheDocument();

    fireEvent.change(date, { target: { value: takenDateRange().max } });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));
    expect(screen.queryByText(/Not saved yet/)).toBeNull();
  });

  it("refuses a shot dated tomorrow, in its own words", () => {
    // A different mistake from a mistyped year, and it must not borrow that
    // message: the year is fine, the date is real, and the person has dated a
    // dose to a day that has not happened. Ordering is the trap — 9999 is ALSO
    // in the future, so checking "after today" first would swallow the year
    // typo and answer it with a bound nobody typed.
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} />);
    const tomorrow = addDaysCivil(takenDateRange().max, 1);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: tomorrow },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/later than today/);
    expect(screen.getByRole("alert")).toHaveTextContent(takenDateRange().max);
    expect(screen.getByLabelText("Date")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("calls a FUTURE mistyped year a year problem, not a future-date one", () => {
    // The case that pins the ordering, and the one the 0999 test cannot reach:
    // 9999 satisfies BOTH rules, so whichever branch runs first wins. Answering
    // it with "nothing later than <today>" would name a bound the person never
    // typed and say nothing about the year, which is the actual slip.
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} />);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "9999-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Check the year/);
  });

  it("still accepts TODAY, which is what logging just before injecting is", () => {
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} />);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: takenDateRange().max },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot).toHaveBeenCalledTimes(1);
  });

  it("refuses a mistyped year, and says it is the year", () => {
    // The failure this exists for: browsers auto-fill the segments you have not
    // typed, so `08` into a cleared field yields `0008-08-05` — the year read as
    // a day. `0999` and `9999` reached storage in a browser pass, and from there
    // History, the CSV a provider reads, and (once charts land) an axis spanning
    // a millennium.
    //
    // Out of range gets its OWN message: "not a real calendar date" is both
    // wrong — 0999-01-01 is a real date — and no help in spotting the year as
    // the thing that slipped.
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} />);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "0999-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Check the year/);
    expect(screen.getByLabelText("Date")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    // The message names the boundary DATES, not their years. It used to say
    // "1900 to 2027" while the real bound was 2027-08-13 — so a date late in
    // the final year was refused by a message listing the very year that had
    // just been typed, leaving nothing to work out.
    // `takenDateRange`, not `shotDateRange`: the date-taken field stops at
    // today, and naming the wider planned-date bound would recreate the very
    // bug this comment describes — a message listing a date the form refuses.
    const { min, max } = takenDateRange();
    expect(screen.getByRole("alert")).toHaveTextContent(min);
    expect(screen.getByRole("alert")).toHaveTextContent(max);

    // No sibling assertion for the "not a real calendar date" message here: an
    // `input[type=date]` cannot hold one. Setting "2026-02-30" leaves the value
    // EMPTY (jsdom and browsers alike refuse it), so that path answers with the
    // blank-date message instead — which is correct, and is why the impossible-
    // date branch is only reachable from a restored draft string, not the
    // picker. Asserting it through this input would have been testing jsdom.

    // Correcting the year saves.
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-06-15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));
    expect(onAddShot).toHaveBeenCalledTimes(1);
    expect(onAddShot.mock.calls[0][0].date).toBe("2026-06-15");
  });

  it("leaves no form control below 16px on a touch screen", () => {
    // Not a style preference. iOS Safari zooms the whole page whenever you focus
    // a control whose text is under 16px — not configurable, not a setting, just
    // what the browser does. At 0.85rem (13.6px) that meant tapping any field on
    // a phone jumped the layout, on the app's primary platform in its primary
    // flow.
    //
    // ENUMERATES the rules rather than pattern-matching for one. The first
    // version of this asserted that a coarse-pointer block containing "16px"
    // existed, and passed while `.dialog-field input { font-size: 0.9rem }` was
    // still out-specifying it (0,1,1 beats 0,0,1; a media query adds no
    // specificity) — so the rename dialog kept zooming and the guard said fine.
    // Asking "does a rule exist" is a cheaper question than "can anything render
    // small", and the cheaper one is the one that was wrong.
    // `process.cwd()`, not `new URL(..., import.meta.url)`: under Vitest
    // `import.meta.url` is a dev-server URL, not a file one, so that throws.
    // `src/test/focusRing.ts` records the same trap.
    const css = readFileSync(`${process.cwd()}/src/styles.css`, "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );

    const sized = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(
        ([, sel, body]) =>
          // SUBSTRING, not a word boundary. `_` is a word character, so
          // `\b(input)\b` does not match `.interval-field__input` — a class on a
          // real <input> that this branch added. Giving it a `font-size` later
          // would out-specify the coarse-pointer rule (0,1,0 beats 0,0,1; a
          // media query adds no specificity), zoom the Settings cadence field on
          // iOS, and leave `sized` at length 2 so this stayed green. Measured
          // both ways: with the old pattern the hazard passes, with this one it
          // fails on length 3.
          //
          // Matching too widely is the safe direction. A false positive trips
          // the length assertion and asks a human to look; a false negative is
          // the silent pass this test exists to prevent.
          /(input|textarea|select)/i.test(sel) && /font-size:/.test(body),
      )
      .map(([, sel, body]) => ({
        selector: sel.replace(/\s+/g, " ").trim(),
        size: /font-size:\s*([^;]+)/.exec(body)![1].trim(),
      }));

    // Exactly two: the base size, and the touch override. A third would mean the
    // cascade decides which wins, which is the thing that went wrong.
    expect(sized).toHaveLength(2);
    expect(sized[0]).toEqual({
      selector: "input, textarea, select",
      size: "0.85rem",
    });
    expect(sized[1]).toEqual({
      selector: "input, textarea, select",
      size: "max(1rem, 16px)",
    });

    // ...and the override is gated on a coarse pointer EXISTING, not on it being
    // the primary one: an iPad with a Magic Keyboard reports `pointer: fine`
    // while you are still tapping the screen.
    expect(css).toMatch(/@media\s*\(any-pointer:\s*coarse\)/);

    // The viewport meta must not have been "fixed" by disabling zoom, which is
    // the answer most search results give: it fails WCAG 1.4.4 for everyone, to
    // work around a font size.
    const html = readFileSync(`${process.cwd()}/index.html`, "utf8");
    expect(html).not.toMatch(/user-scalable\s*=\s*no/);
    expect(html).not.toMatch(/maximum-scale/);
  });

  it("bounds the date picker to the range it will accept", () => {
    // The attributes are a hint, not the check (the form carries `noValidate`),
    // but a picker that offers a date the form then refuses is worse than no
    // bound at all — so they must agree with isShotDateInRange.
    render(<ShotForm onAddShot={vi.fn()} />);
    const date = screen.getByLabelText("Date");
    expect(isShotDateInRange(date.getAttribute("min")!)).toBe(true);
    expect(isShotDateInRange(date.getAttribute("max")!)).toBe(true);
  });

  it("carries forward from the newest shot whatever order the array is in", () => {
    // Storage is append-order today, but an imported backup can arrive in any
    // order — the newest shot must still win.
    const onAddShot = vi.fn();
    render(
      <ShotForm
        onAddShot={onAddShot}
        shots={[
          { id: "new", date: "2026-07-01", doseMg: 80 },
          { id: "old", date: "2026-01-01", doseMg: 20 },
        ]}
      />,
    );
    expect(screen.getByLabelText("Dose (mg)")).toHaveValue(80);
  });

  it("accepts a fractional dose", () => {
    // Titrated doses like 62.5mg are ordinary and doseMg is a float, but the
    // input carried step=1 — so the browser's constraint validation blocked the
    // submit event outright and the form silently did nothing.
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} />);
    const dose = screen.getByLabelText("Dose (mg)") as HTMLInputElement;

    fireEvent.change(dose, { target: { value: "62.5" } });
    expect(dose.checkValidity()).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));
    expect(onAddShot.mock.calls[0][0]).toMatchObject({ doseMg: 62.5 });
  });

  it("keeps an error message out of the field's accessible name", () => {
    // Text inside a <label> becomes part of the field's accessible name, so an
    // error rendered there would rename the field to "Dose (mg)<the error>" —
    // breaking both screen-reader announcements and label-based queries. The
    // error is a sibling, reached via aria-describedby.
    //
    // This used to be asserted through the pain field, whose 0-10 input had an
    // inline range error. That input is gone: four chips cannot produce a value
    // the schema would refuse, so the error went with it. The principle still
    // holds for every field that DOES have one, so the test moved rather than
    // being deleted with the input that happened to demonstrate it.
    render(<ShotForm onAddShot={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Dose (mg)"), {
      target: { value: "-5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    const dose = screen.getByLabelText("Dose (mg)");
    expect(dose).toHaveAccessibleName("Dose (mg)");
    expect(dose).toHaveAttribute("aria-invalid", "true");
    expect(dose).toHaveAccessibleDescription("Dose must be a positive number.");
  });

  it("refuses a negative dose with a message", () => {
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} />);
    fireEvent.change(screen.getByLabelText("Dose (mg)"), {
      target: { value: "-5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Dose must be a positive number.",
    );
  });

  it("stores omitted optional fields as undefined, never empty strings", () => {
    // The project rule: ShotEntry optionals must never be "" (see CLAUDE.md).
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} />);
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    const saved = onAddShot.mock.calls[0][0] as ShotEntry;
    for (const key of [
      "time",
      "doseMg",
      "injectionSite",
      "injectionSitePosition",
      "testosteroneEster",
      "carrierOil",
      "pain",
      "offDays",
      "notes",
    ] as const) {
      expect(saved[key]).toBeUndefined();
    }
  });

  it("fills type of T and carrier oil from their reuse chips", () => {
    const onAddShot = vi.fn();
    render(
      <ShotForm
        onAddShot={onAddShot}
        shots={[
          {
            id: "1",
            date: "2026-05-01",
            testosteroneEster: "cypionate",
            carrierOil: "grapeseed",
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "cypionate" }));
    fireEvent.click(screen.getByRole("button", { name: "grapeseed" }));
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot.mock.calls[0][0]).toMatchObject({
      testosteroneEster: "cypionate",
      carrierOil: "grapeseed",
    });
  });
});

describe("ShotForm draft publishing", () => {
  const emptyRef = () => ({ current: null as ShotDraft | null });

  it("publishes the date exactly as the field held it", () => {
    // A snapshot, like every other field. Nothing is encoded on the way out, so
    // there is no encoding for the restoring side to misread.
    const ref = emptyRef();
    render(<ShotForm onAddShot={vi.fn()} liveDraftRef={ref} />);
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "wip" },
    });

    expect(ref.current).not.toBeNull();
    expect(ref.current!.date).toBe(todayLocalISO());
    expect(ref.current!.notes).toBe("wip");
  });

  it("publishes a cleared date as empty rather than refilling it", () => {
    // `required` blocks submission, not the state in between — Delete or Backspace
    // in the field empties it, verified with real keys — so a user can genuinely
    // leave this empty, and the draft records that rather than papering over it.
    const ref = emptyRef();
    render(<ShotForm onAddShot={vi.fn()} liveDraftRef={ref} />);
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "" } });

    expect(ref.current).not.toBeNull();
    expect(ref.current!.date).toBe("");
  });

  it("keeps a date the user actually changed", () => {
    // Someone part-way through logging yesterday's shot meant that date.
    const ref = emptyRef();
    render(<ShotForm onAddShot={vi.fn()} liveDraftRef={ref} />);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-06-01" },
    });

    expect(ref.current!.date).toBe("2026-06-01");
  });

  const draftWith = (
    date: string,
    notes = "carried over",
    dateBaseline = "1970-01-01", // anything but `date` = "the user chose this"
  ): ShotDraft => ({
    date,
    dateBaseline,
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
    notes,
  });

  it("keeps yesterday's date when an unfinished entry is picked up today", () => {
    // The reason the date is frozen, and the one scenario worth a full round trip
    // rather than a hand-built draft: you log a shot after taking it, so an entry
    // started yesterday is about yesterday's shot. Re-deriving slid today's date
    // under someone finishing an interrupted entry — and today looks right, so
    // nothing prompts them to check it.
    //
    // Both halves have to run for this to mean anything. A draft built by hand
    // with a literal date is restored verbatim under the old behaviour too; only
    // parking an UNTOUCHED date and restoring it after the day rolls over tells
    // the two apart.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-01T21:00:00"));
      const started = todayLocalISO();

      const ref = emptyRef();
      const first = render(<ShotForm onAddShot={vi.fn()} liveDraftRef={ref} />);
      // Types something, never touches the date, walks away.
      fireEvent.change(screen.getByLabelText("Notes"), {
        target: { value: "half filled in yesterday" },
      });
      const parked = ref.current!;
      first.unmount();

      // A day passes before they come back to it.
      vi.setSystemTime(new Date("2026-08-02T09:00:00"));
      expect(todayLocalISO()).not.toBe(started);

      render(<ShotForm onAddShot={vi.fn()} draft={parked} />);

      expect(screen.getByLabelText("Date")).toHaveValue(started);
      expect(screen.getByLabelText("Date")).not.toHaveValue(todayLocalISO());
      expect(screen.getByLabelText("Notes")).toHaveValue(
        "half filled in yesterday",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets an emptied draft go clean again after the day has rolled over", () => {
    // Freezing the date created this: `opened` is built at THIS mount, so its
    // date is today's, while a restored draft's is the day it was started. Those
    // can never match again, which left the form permanently dirty — erase the
    // note to abandon the entry and it re-published a bare stale date, so the
    // next "Log a shot" opened pre-dated to a day with nothing in it.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-01T21:00:00"));
      const ref = emptyRef();
      const first = render(<ShotForm onAddShot={vi.fn()} liveDraftRef={ref} />);
      fireEvent.change(screen.getByLabelText("Notes"), {
        target: { value: "note" },
      });
      const parked = ref.current!;
      first.unmount();

      vi.setSystemTime(new Date("2026-08-02T09:00:00"));
      const ref2 = emptyRef();
      render(
        <ShotForm onAddShot={vi.fn()} draft={parked} liveDraftRef={ref2} />,
      );
      // It restores dirty, so dismissing still keeps it...
      expect(ref2.current).not.toBeNull();

      // ...but emptying it out means there is nothing left worth keeping.
      fireEvent.change(screen.getByLabelText("Notes"), {
        target: { value: "" },
      });
      expect(ref2.current).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats a date changed and changed back as no change at all", () => {
    // The flag means "differs from what this form opened with", not "was typed
    // in". Recording the interaction instead left an otherwise-empty form dirty
    // forever, parking a draft holding nothing but a date — which, carried across
    // midnight, reopened pre-dated to yesterday with nothing in it.
    const ref = emptyRef();
    render(<ShotForm onAddShot={vi.fn()} liveDraftRef={ref} />);

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-06-01" },
    });
    expect(ref.current).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: todayLocalISO() },
    });
    expect(ref.current).toBeNull();
  });

  it("never rewrites the date as a side effect of another field", () => {
    // An earlier attempt snapped the date back to today the moment the rest of a
    // restored form went empty, so the next entry typed in that sheet would not
    // inherit a dead draft's day. That traded one silent re-date for a worse one:
    // backspacing a note to empty mid-edit rewrote the date under the user, and
    // retyping the note did not bring it back. Nothing may move this field except
    // the user or "Clear form" — which is the whole premise of freezing it.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-01T21:00:00"));
      const ref = emptyRef();
      const first = render(<ShotForm onAddShot={vi.fn()} liveDraftRef={ref} />);
      fireEvent.change(screen.getByLabelText("Notes"), {
        target: { value: "wip" },
      });
      const parked = ref.current!;
      first.unmount();

      vi.setSystemTime(new Date("2026-08-02T09:00:00"));
      render(
        <ShotForm
          onAddShot={vi.fn()}
          draft={parked}
          liveDraftRef={emptyRef()}
        />,
      );
      expect(screen.getByLabelText("Date")).toHaveValue("2026-08-01");

      fireEvent.change(screen.getByLabelText("Notes"), {
        target: { value: "" },
      });
      fireEvent.change(screen.getByLabelText("Notes"), {
        target: { value: "still going" },
      });

      expect(screen.getByLabelText("Date")).toHaveValue("2026-08-01");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a date picked after the form has outlived the day it opened on", () => {
    // A sheet left open overnight, then given a date. Nothing may overwrite it,
    // and it must be kept — the earlier version of this file overwrote it with
    // today, because "touched" was judged against the day the form opened while
    // the reset was judged against today, and those disagree once a form outlives
    // the day.
    //
    // NOTE: this used to also assert that re-picking the date already displayed
    // parked a draft. That assertion went with the move to a single `opened.date`
    // baseline, which was needed to stop edit mode discarding the commonest date
    // correction there is. Setting a field to the value it already shows is not a
    // change, and nothing is lost by it: the field is not rewritten, and there is
    // no other content to keep. The protection that matters — a genuinely chosen
    // date surviving — is asserted below.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-01T21:00:00"));
      const ref = emptyRef();
      render(<ShotForm onAddShot={vi.fn()} liveDraftRef={ref} />);

      vi.setSystemTime(new Date("2026-08-02T09:00:00"));
      fireEvent.change(screen.getByLabelText("Date"), {
        target: { value: "2026-07-20" },
      });

      expect(screen.getByLabelText("Date")).toHaveValue("2026-07-20");
      expect(ref.current).not.toBeNull();
      expect(ref.current!.date).toBe("2026-07-20");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not offer 'Clear form' on a form that already looks brand new", () => {
    // A date chosen yesterday can be today by the time the draft is reopened, so
    // the form reports unsaved input while showing nothing a fresh form wouldn't.
    // Offering "Clear form" there invites a tap that visibly does nothing.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-01T10:00:00"));
      const ref = emptyRef();
      const first = render(<ShotForm onAddShot={vi.fn()} liveDraftRef={ref} />);
      // Date set forward to tomorrow, nothing else touched.
      fireEvent.change(screen.getByLabelText("Date"), {
        target: { value: "2026-08-02" },
      });
      const parked = ref.current!;
      first.unmount();

      // Tomorrow arrives; the parked date is now simply today.
      vi.setSystemTime(new Date("2026-08-02T10:00:00"));
      render(
        <ShotForm
          onAddShot={vi.fn()}
          draft={parked}
          liveDraftRef={emptyRef()}
        />,
      );

      expect(screen.getByLabelText("Date")).toHaveValue("2026-08-02");
      expect(screen.queryByRole("button", { name: "Clear form" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("still offers 'Clear form' whenever the form shows something of yours", () => {
    // The guard above must not swallow the ordinary case.
    render(<ShotForm onAddShot={vi.fn()} liveDraftRef={emptyRef()} />);
    expect(screen.queryByRole("button", { name: "Clear form" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "wip" },
    });
    expect(
      screen.getByRole("button", { name: "Clear form" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-06-01" },
    });
    expect(
      screen.getByRole("button", { name: "Clear form" }),
    ).toBeInTheDocument();
  });

  it("registers a backdate picked after the form was cleared past midnight", () => {
    // "Clear form" reseeds the date, so the baseline must move with it. While it
    // was a boolean judged against the day the form OPENED, a form cleared after
    // midnight showed today but still measured against yesterday — so picking
    // yesterday read as "no change" and dismissal discarded a real backdate.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-01T23:58:00"));
      const ref = emptyRef();
      render(<ShotForm onAddShot={vi.fn()} liveDraftRef={ref} />);
      fireEvent.change(screen.getByLabelText("Notes"), {
        target: { value: "x" },
      });

      vi.setSystemTime(new Date("2026-08-02T00:05:00"));
      fireEvent.click(screen.getByRole("button", { name: "Clear form" }));
      expect(ref.current).toBeNull();
      expect(screen.getByLabelText("Date")).toHaveValue("2026-08-02");

      fireEvent.change(screen.getByLabelText("Date"), {
        target: { value: "2026-08-01" },
      });

      expect(ref.current).not.toBeNull();
      expect(ref.current!.date).toBe("2026-08-01");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps an edit re-dated TO today, the commonest correction there is", () => {
    // A shot logged under the wrong day, fixed to today. Judging "touched"
    // against today made this read as no change at all, so dismissing threw the
    // correction away — and because App keys parked edits by shot id and deletes
    // the entry when the live draft is null, it also destroyed any work already
    // parked against that shot. An edit's baseline is the shot's own stored date.
    const editing: ShotEntry = { id: "e1", date: "2026-05-01", notes: "orig" };
    const ref = emptyRef();
    render(
      <ShotForm
        onAddShot={vi.fn()}
        onUpdateShot={vi.fn()}
        editingShot={editing}
        liveDraftRef={ref}
      />,
    );

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: todayLocalISO() },
    });

    expect(ref.current).not.toBeNull();
    expect(ref.current!.date).toBe(todayLocalISO());
  });

  it("lets a restored future-dated shot be edited without touching its date", () => {
    // Import is deliberately NOT held to the taken-date bound, so a backup can
    // legitimately restore an entry dated ahead. Blocking Save on a date the
    // user never typed is a dead end: the message blames them for the one field
    // they did not change and offers no way out but to alter their own record.
    const onUpdateShot = vi.fn();
    const future = addDaysCivil(takenDateRange().max, 30);
    const editing: ShotEntry = { id: "e1", date: future, notes: "orig" };
    render(
      <ShotForm
        onAddShot={vi.fn()}
        onUpdateShot={onUpdateShot}
        editingShot={editing}
      />,
    );

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "fixed the typo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Update shot/i }));

    expect(onUpdateShot).toHaveBeenCalledTimes(1);
    expect(onUpdateShot.mock.calls[0][0].date).toBe(future);
  });

  it("still refuses a future date the user TYPES into an edit", () => {
    // The other half, and what stops the escape hatch becoming a way in: only
    // an UNCHANGED stored date is allowed through.
    const onUpdateShot = vi.fn();
    const editing: ShotEntry = { id: "e1", date: "2026-05-01", notes: "orig" };
    render(
      <ShotForm
        onAddShot={vi.fn()}
        onUpdateShot={onUpdateShot}
        editingShot={editing}
      />,
    );

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: addDaysCivil(takenDateRange().max, 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: /Update shot/i }));

    expect(onUpdateShot).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/later than today/);
  });

  it("lets an edit's date be put back without leaving the form dirty", () => {
    // The inverse: change a shot's date and change it back, and there is nothing
    // unsaved. Judging against today left the flag stuck true, so the form was
    // dirty forever and parked a draft byte-identical to the stored shot.
    const editing: ShotEntry = { id: "e1", date: "2026-05-01", notes: "orig" };
    const ref = emptyRef();
    render(
      <ShotForm
        onAddShot={vi.fn()}
        onUpdateShot={vi.fn()}
        editingShot={editing}
        liveDraftRef={ref}
      />,
    );

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-05-02" },
    });
    expect(ref.current).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-05-01" },
    });
    expect(ref.current).toBeNull();
  });

  it("lets a restored backdate be taken back, without parking a bare date", () => {
    // Changing your mind: the backdate was the draft's only content, so setting
    // it back to today leaves nothing worth keeping. Treating an earlier session's
    // choice as permanent kept the form dirty forever and parked a draft holding
    // only a date — which, carried across midnight, reopens pre-dated with nothing
    // in it.
    const ref = emptyRef();
    const first = render(<ShotForm onAddShot={vi.fn()} liveDraftRef={ref} />);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-06-01" },
    });
    const parked = ref.current!;
    first.unmount();

    const ref2 = emptyRef();
    render(<ShotForm onAddShot={vi.fn()} draft={parked} liveDraftRef={ref2} />);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: todayLocalISO() },
    });

    expect(ref2.current).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear form" })).toBeNull();
  });

  it("keeps a backdate that is the draft's only content, across repeat dismissals", () => {
    // Backdating is a whole entry on its own: open the form, set yesterday's
    // date, get interrupted. Nothing else is filled in, so if the date is not
    // recognised as input the draft reads as clean the SECOND time it is
    // restored, and that dismissal throws the chosen date away silently — the
    // exact class this branch exists to close, one dismissal later.
    const ref = emptyRef();
    const first = render(<ShotForm onAddShot={vi.fn()} liveDraftRef={ref} />);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-06-01" },
    });
    const parked = ref.current!;
    expect(parked.date).toBe("2026-06-01");
    first.unmount();

    const ref2 = emptyRef();
    render(<ShotForm onAddShot={vi.fn()} draft={parked} liveDraftRef={ref2} />);

    expect(screen.getByLabelText("Date")).toHaveValue("2026-06-01");
    expect(ref2.current).not.toBeNull();
    expect(ref2.current!.date).toBe("2026-06-01");
  });

  it("'Clear form' really clears a restored draft whose date was backdated", () => {
    // Resetting puts today back in the field, so anything that decided dirtiness
    // by comparing the date against the parked one stayed dirty forever: the
    // "Clear form" link never went away, tapping it visibly did nothing, and
    // dismissing parked a phantom entry holding only today's date.
    const ref = emptyRef();
    const first = render(<ShotForm onAddShot={vi.fn()} liveDraftRef={ref} />);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-06-01" },
    });
    const parked = ref.current!;
    first.unmount();

    const ref2 = emptyRef();
    render(<ShotForm onAddShot={vi.fn()} draft={parked} liveDraftRef={ref2} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear form" }));

    expect(screen.getByLabelText("Date")).toHaveValue(todayLocalISO());
    expect(screen.queryByRole("button", { name: "Clear form" })).toBeNull();
    expect(ref2.current).toBeNull();
  });

  it("still keeps a date change parked against an edit", () => {
    // The other side of that fix: an edit's baseline stays the shot's own stored
    // date, so a date the user changed and parked is still unsaved input. Letting
    // the edit branch inherit the draft's date too would read as clean and drop
    // the change on dismissal.
    const editing: ShotEntry = {
      id: "e1",
      date: "2026-05-05",
      notes: "original",
    };
    const parked: ShotDraft = { ...draftWith("2026-06-10", "original") };
    const ref = emptyRef();
    render(
      <ShotForm
        onAddShot={vi.fn()}
        onUpdateShot={vi.fn()}
        editingShot={editing}
        draft={parked}
        liveDraftRef={ref}
      />,
    );

    expect(screen.getByLabelText("Date")).toHaveValue("2026-06-10");
    expect(ref.current).not.toBeNull();
    expect(ref.current!.date).toBe("2026-06-10");
  });

  it("restores a draft's date verbatim even when it is today's", () => {
    render(<ShotForm onAddShot={vi.fn()} draft={draftWith(todayLocalISO())} />);

    expect(screen.getByLabelText("Date")).toHaveValue(todayLocalISO());
    expect(screen.getByLabelText("Notes")).toHaveValue("carried over");
  });

  it("restores a cleared date as cleared, not as today", () => {
    // The read half of the same distinction, and the half that actually corrupted
    // data: reading with `||` turned this draft into today's date, and on an edit
    // that re-dated a logged shot. A reader that cannot tell `""` from `null` is
    // the bug, so assert the empty case explicitly rather than only the null one.
    render(<ShotForm onAddShot={vi.fn()} draft={draftWith("")} />);

    expect(screen.getByLabelText("Date")).toHaveValue("");
    expect(screen.getByLabelText("Date")).not.toHaveValue(todayLocalISO());
  });

  it("restores a deliberately chosen date verbatim", () => {
    render(<ShotForm onAddShot={vi.fn()} draft={draftWith("2026-06-01")} />);

    expect(screen.getByLabelText("Date")).toHaveValue("2026-06-01");
  });

  it("reports unsaved changes while editing, so an edit can be restored too", () => {
    const ref = emptyRef();
    const editing: ShotEntry = {
      id: "e1",
      date: "2026-06-01",
      notes: "original",
    };
    render(
      <ShotForm
        onAddShot={vi.fn()}
        onUpdateShot={vi.fn()}
        editingShot={editing}
        liveDraftRef={ref}
      />,
    );
    // Untouched: nothing to remember.
    expect(ref.current).toBeNull();

    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "rewritten" },
    });
    expect(ref.current!.notes).toBe("rewritten");
    // The shot's own date is published as-is, like every other untouched field.
    expect(ref.current!.date).toBe("2026-06-01");
  });
});

describe("the in-sheet export button", () => {
  it("says so rather than looking dead when no handler is wired", () => {
    // The optional prop exists only so the form renders standalone. Unwired,
    // `onExportBackup?.() === false` evaluated to `false` — i.e. "it worked" —
    // so the button did nothing and said nothing: the dead-button failure this
    // panel exists to remove, reappearing inside its own escape hatch.
    render(<ShotForm onAddShot={() => "refused"} shots={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));
    fireEvent.click(screen.getByRole("button", { name: "Export a backup" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      /download didn.t start/i,
    );
  });

  it("stays quiet when the handler reports the download started", () => {
    render(
      <ShotForm
        onAddShot={() => "refused"}
        onExportBackup={() => true}
        shots={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));
    fireEvent.click(screen.getByRole("button", { name: "Export a backup" }));

    expect(screen.getByRole("alert")).not.toHaveTextContent(
      /download didn.t start/i,
    );
  });
});

describe("the confirm beat", () => {
  it("refuses to submit again while the ✓ is showing", () => {
    // `aria-disabled` is advisory — it tells assistive tech the control is
    // inert and does nothing functionally, so something has to make it true.
    // Not `disabled`, which would blur the focused button and drop focus to
    // <body> for the whole confirm plus exit.
    const onAddShot = vi.fn(() => "saved" as const);
    render(<ShotForm onAddShot={onAddShot} confirming shots={[]} />);

    // "Saved", not "✓ Saved": the tick is aria-hidden, so it stays out of the
    // accessible name instead of announcing as "check mark Saved".
    const button = screen.getByRole("button", { name: "Saved" });
    expect(button).toHaveTextContent("✓"); // ...still on screen, though
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled(); // still focusable

    fireEvent.click(button);

    expect(onAddShot).not.toHaveBeenCalled();
  });

  it("submits normally once the beat has passed", () => {
    const onAddShot = vi.fn(() => "saved" as const);
    render(<ShotForm onAddShot={onAddShot} shots={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot).toHaveBeenCalledTimes(1);
  });
});

describe("ShotForm — the planned date", () => {
  const grid: Pick<
    Profile,
    "shotDays" | "intervalDays" | "scheduleAnchor" | "scheduleMode"
  > = {
    shotDays: ["wednesday"],
    intervalDays: 7,
    scheduleAnchor: "2026-08-05",
    // Explicit now that the rhythm is stored rather than inferred.
    scheduleMode: "grid",
  };
  const planned = () =>
    screen.getByLabelText(/Planned for/i) as HTMLInputElement;

  it("keeps a stored planned date instead of repainting it", () => {
    // It did not. Both the draft and the baseline seeded from the stored value,
    // which made them equal on the first render — the exact condition the
    // follow-the-date sync fires on. So reopening a shot threw its frozen
    // planned date away before the user touched anything, defeating both the
    // "frozen and NEVER recomputed" rule and the override the field invites.
    const onUpdateShot = vi.fn((shot: ShotEntry): SaveOutcome =>
      shot ? "saved" : "ignored",
    );
    render(
      <ShotForm
        onAddShot={() => "saved" as const}
        onUpdateShot={onUpdateShot}
        editingShot={{ id: "a", date: "2026-08-05", plannedFor: "2026-07-29" }}
        shots={[{ id: "a", date: "2026-08-05", plannedFor: "2026-07-29" }]}
        profile={grid}
      />,
    );
    expect(planned().value).toBe("2026-07-29");
    fireEvent.click(screen.getByRole("button", { name: /Update shot/i }));
    expect(onUpdateShot.mock.calls[0]?.[0]?.plannedFor).toBe("2026-07-29");
  });

  it("refuses an out-of-range planned date, like the shot date", () => {
    // The form is noValidate, so min/max on the input are hints the browser
    // never enforces. Unvalidated, 9999-01-01 stored — and the boundaries then
    // disagreed about a value on screen: dropped from the backup, blanked in
    // the CSV, rendered in History.
    const onUpdateShot = vi.fn((): SaveOutcome => "saved");
    render(
      <ShotForm
        onAddShot={() => "saved" as const}
        onUpdateShot={onUpdateShot}
        editingShot={{ id: "a", date: "2026-08-05" }}
        shots={[{ id: "a", date: "2026-08-05" }]}
        profile={grid}
      />,
    );
    fireEvent.change(planned(), { target: { value: "9999-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: /Update shot/i }));

    expect(onUpdateShot).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Check the year/i);
    // And it must name the PLANNED bound, which runs a year ahead -- not the
    // date-taken bound, which stops at today. Asserting only "Check the year"
    // passed happily while the message claimed a planned date could not be
    // after today, contradicting the picker beside it and refusing a value that
    // in fact saves. A message naming the wrong boundary is the defect this
    // whole family of messages exists to avoid.
    const plannedMax = shotDateRange().max;
    expect(screen.getByRole("alert")).toHaveTextContent(plannedMax);
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      takenDateRange().max,
    );
  });

  it("does not freeze the grid when the write was refused", () => {
    // SaveOutcome is a union of non-empty strings, so "refused" was truthy and
    // a storage failure — the case this sheet is held open for — anchored the
    // schedule to a shot that never existed, with no UI to reset it.
    const onAnchorEstablished = vi.fn();
    render(
      <ShotForm
        onAddShot={() => "refused" as const}
        onAnchorEstablished={onAnchorEstablished}
        shots={[]}
        profile={{ shotDays: ["wednesday"], intervalDays: 7 }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-08-05" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save shot/i }));
    expect(onAnchorEstablished).not.toHaveBeenCalled();
  });

  it("freezes the grid once the write lands", () => {
    const onAnchorEstablished = vi.fn();
    render(
      <ShotForm
        onAddShot={() => "saved" as const}
        onAnchorEstablished={onAnchorEstablished}
        shots={[]}
        profile={{ shotDays: ["wednesday"], intervalDays: 7 }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-08-04" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save shot/i }));
    expect(onAnchorEstablished).toHaveBeenCalledWith("2026-08-05");
  });

  it("is absent when logging a NEW shot", () => {
    // It sat in the middle of the fast path, asking you to review a date the
    // app had just worked out — which turns a two-tap log into a decision.
    // There is nothing to correct until something is saved, so it is a
    // correction tool on the edit sheet and nowhere else.
    const ref =
      React.createRef<ShotDraft | null>() as React.RefObject<ShotDraft | null>;
    render(
      <ShotForm
        onAddShot={() => "saved" as const}
        shots={[]}
        profile={grid}
        liveDraftRef={ref}
      />,
    );
    expect(screen.queryByLabelText(/Planned for/i)).not.toBeInTheDocument();
    expect(ref.current).toBeNull(); // and a fresh form still reads clean
  });

  it("does not report unsaved input for a shot whose planned date is simply old", () => {
    // The normal case, and the whole point of freezing: a shot logged under an
    // older cadence no longer matches today's computation. Seeding the baseline
    // from that computation made every such shot read as edited on open, so
    // dismissing an untouched sheet parked a draft.
    const ref =
      React.createRef<ShotDraft | null>() as React.RefObject<ShotDraft | null>;
    render(
      <ShotForm
        onAddShot={() => "saved" as const}
        onUpdateShot={() => "saved" as const}
        editingShot={{ id: "a", date: "2026-08-05", plannedFor: "2026-07-29" }}
        shots={[{ id: "a", date: "2026-08-05", plannedFor: "2026-07-29" }]}
        profile={grid}
        liveDraftRef={ref}
      />,
    );
    expect(planned().value).toBe("2026-07-29");
    expect(ref.current).toBeNull();
  });

  it("never moves a saved shot's frozen planned date when its date is edited", () => {
    // This test used to assert the OPPOSITE — that an untouched planned date
    // follows the shot's date. That was the bug, not the contract. The value is
    // frozen at log time, so an unrelated edit rewriting it is a silent
    // rewriting of history: open an old shot to fix a typo in its date and the
    // planned date repainted from TODAY's settings. Only the user may change
    // it, through the field itself.
    render(
      <ShotForm
        onAddShot={() => "saved" as const}
        onUpdateShot={() => "saved" as const}
        editingShot={{ id: "a", date: "2026-08-05", plannedFor: "2026-08-05" }}
        shots={[{ id: "a", date: "2026-08-05", plannedFor: "2026-08-05" }]}
        profile={grid}
      />,
    );
    const dateField = screen.getByLabelText("Date");

    expect(planned().value).toBe("2026-08-05");
    fireEvent.change(dateField, { target: { value: "2026-08-12" } });
    expect(planned().value).toBe("2026-08-05"); // stayed put

    // Explicit edits still work, and still survive a later date change.
    fireEvent.change(planned(), { target: { value: "2026-07-29" } });
    fireEvent.change(dateField, { target: { value: "2026-08-19" } });
    expect(planned().value).toBe("2026-07-29");
  });

  it("keeps the frozen date on save after the cadence was cleared", () => {
    // The data-loss path. Log under a cadence, clear it in Settings, then open
    // an old shot to fix its date: the sync repainted from `computed`, which is
    // now "", the field blanked, and Save stored `plannedFor: undefined` —
    // destroying a value backupDto.ts states can never be regenerated.
    const onUpdateShot = vi.fn((): SaveOutcome => "saved");
    render(
      <ShotForm
        onAddShot={() => "saved" as const}
        onUpdateShot={onUpdateShot}
        editingShot={{ id: "a", date: "2026-08-05", plannedFor: "2026-08-05" }}
        shots={[{ id: "a", date: "2026-08-05", plannedFor: "2026-08-05" }]}
        profile={{}}
      />,
    );

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-08-06" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Update shot/i }));

    expect(onUpdateShot).toHaveBeenCalledWith(
      expect.objectContaining({ date: "2026-08-06", plannedFor: "2026-08-05" }),
    );
  });

  it("recomputes a restored new-shot draft's planned date rather than carrying it", () => {
    // The planned field is never rendered for a new shot, so a value carried in
    // a parked draft is one nobody can see or correct — and it goes stale
    // exactly when the cadence changes, which is a large part of why someone
    // left the sheet. Measured before the fix: a draft parked with no cadence,
    // restored once one was set, saved `plannedFor: undefined` where a fresh
    // form saved the date — while still persisting an anchor, so the grid was
    // fixed by a shot that had no place on it.
    const parked: ShotDraft = {
      date: "2026-08-26",
      dateBaseline: "2026-08-26",
      plannedFor: "", // parked while no cadence was set
      plannedBaseline: "",
      time: "",
      doseMg: "50",
      injectionSite: "",
      injectionSitePosition: "",
      testosteroneEster: "",
      carrierOil: "",
      pain: "",
      offDays: "",
      notes: "",
    };
    const onAddShot = vi.fn((): SaveOutcome => "saved");
    const onAnchorEstablished = vi.fn();
    render(
      <ShotForm
        onAddShot={onAddShot}
        shots={[]}
        // No stored anchor, so this save is the one that establishes it — which
        // is the half of the incoherence that mattered.
        profile={{ shotDays: ["wednesday"], intervalDays: 7 }}
        draft={parked}
        onAnchorEstablished={onAnchorEstablished}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Save shot/i }));

    expect(onAddShot).toHaveBeenCalledWith(
      expect.objectContaining({ plannedFor: "2026-08-26" }),
    );
    // And the anchor it persists belongs to a shot that is actually on the grid.
    expect(onAnchorEstablished).toHaveBeenCalledWith("2026-08-26");
  });

  it("establishes the grid anchor when logging, and never when editing", () => {
    // An edit's anchor reference is the most recent date KNOWN, which for a
    // shot being opened is some LATER shot rather than the one in front of you
    // — the anchoring measured wrong in 1350 of 2250 cases. So opening a July
    // entry to fix a typo persisted August's date as the anchor, and every
    // on-rhythm shot logged afterwards froze a permanent "7 days earlier".
    //
    // Measured before the fix: onAnchorEstablished("2026-08-19").
    const shots = [
      { id: "a", date: "2026-07-08" },
      { id: "b", date: "2026-08-19" },
    ];
    const profile: Pick<Profile, "shotDays" | "intervalDays" | "scheduleMode"> =
      { shotDays: ["wednesday"], intervalDays: 14, scheduleMode: "grid" };

    const onEdit = vi.fn();
    const edit = render(
      <ShotForm
        onAddShot={() => "saved" as const}
        onUpdateShot={() => "saved" as const}
        editingShot={shots[0]}
        shots={shots}
        profile={profile}
        onAnchorEstablished={onEdit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Update shot/i }));
    expect(onEdit).not.toHaveBeenCalled();
    edit.unmount();

    // The same profile and history, logging instead: the anchor is established,
    // and from the shot being logged rather than from a later one.
    const onLog = vi.fn();
    render(
      <ShotForm
        onAddShot={() => "saved" as const}
        shots={shots}
        profile={profile}
        onAnchorEstablished={onLog}
      />,
    );
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-09-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save shot/i }));
    expect(onLog).toHaveBeenCalledWith("2026-09-02");
  });

  it("points the planned field at its hint, not only at its error", () => {
    // The hint explains what the field IS — the only place a frozen planned
    // date can be corrected — so it has to reach assistive tech. Every other
    // new field on this branch wires its hint up; this one was the odd one out.
    render(
      <ShotForm
        onAddShot={() => "saved" as const}
        onUpdateShot={() => "saved" as const}
        editingShot={{ id: "a", date: "2026-08-05", plannedFor: "2026-08-05" }}
        shots={[]}
        profile={{}}
      />,
    );

    expect(planned().getAttribute("aria-describedby")).toContain(
      "planned-hint",
    );
    expect(document.getElementById("planned-hint")).not.toBeNull();
  });

  it("shows the field when a parked draft carries a planned date", () => {
    // Dismiss the sheet with a planned date typed, clear the cadence in
    // Settings, reopen the same shot: the draft restores that value. Gated on
    // the shot and the cadence alone, the field would be gone while its value
    // was still there — saved from an input the user cannot see, and if it were
    // out of range, blocking Save with a message that never rendered.
    render(
      <ShotForm
        onAddShot={() => "saved" as const}
        onUpdateShot={() => "saved" as const}
        editingShot={{ id: "a", date: "2026-08-05" }}
        shots={[]}
        profile={{}}
        draft={{
          date: "2026-08-05",
          dateBaseline: "2026-08-05",
          plannedFor: "2026-08-12",
          plannedBaseline: "",
          time: "",
          doseMg: "",
          injectionSite: "",
          injectionSitePosition: "",
          testosteroneEster: "",
          carrierOil: "",
          pain: "",
          offDays: "",
          notes: "",
        }}
      />,
    );

    expect(planned()).not.toBeNull();
    expect(planned().value).toBe("2026-08-12");
  });

  it("offers the field for a frozen date even with no cadence, and not otherwise", () => {
    // With no cadence there is nothing to compute and nothing to correct, so an
    // empty "Planned for" input hinted "Worked out from how often you inject"
    // only invited a value the app would never produce — which then rendered in
    // History and in the CSV a provider reads. A shot that already carries one
    // still gets the field: correcting or clearing it is what it is for.
    const { unmount } = render(
      <ShotForm
        onAddShot={() => "saved" as const}
        onUpdateShot={() => "saved" as const}
        editingShot={{ id: "a", date: "2026-08-05", plannedFor: "2026-08-05" }}
        shots={[]}
        profile={{}}
      />,
    );
    expect(screen.queryByLabelText(/Planned for/i)).not.toBeNull();
    unmount();

    render(
      <ShotForm
        onAddShot={() => "saved" as const}
        onUpdateShot={() => "saved" as const}
        editingShot={{ id: "b", date: "2026-08-05" }}
        shots={[]}
        profile={{}}
      />,
    );
    expect(screen.queryByLabelText(/Planned for/i)).toBeNull();
  });

  it("still plans the shot after Clear form", () => {
    // It did not: reset blanked the planned state and set its "computed for"
    // date to today, alongside the shot date — so the sync saw no disagreement
    // and never re-seeded. A shot saved straight after clearing was stored with
    // NO planned date, silently (the field is not rendered on a new shot) and
    // unrecoverably by this feature's own design. Measured: a normal save gave
    // a date, one after clearing gave undefined.
    const onAddShot = vi.fn((shot: ShotEntry): SaveOutcome =>
      shot ? "saved" : "ignored",
    );
    render(<ShotForm onAddShot={onAddShot} shots={[]} profile={grid} />);
    fireEvent.change(screen.getByPlaceholderText(/remember for later/i), {
      target: { value: "something to clear" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Clear form/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save shot/i }));

    expect(onAddShot.mock.calls[0]?.[0]?.plannedFor).toBeTruthy();
  });

  it("keeps a planned date the user deliberately emptied", () => {
    // `start.plannedFor || computed` treated a legitimate "" — "this shot has
    // no planned date" — as absent and refilled it from today's computation, so
    // the value came back, the form read clean, and Save wrote it again. The
    // overloaded-"" sentinel class, in the field whose draft was added to carry
    // exactly this.
    const parked: ShotDraft = {
      date: "2026-08-12",
      dateBaseline: "2026-08-12",
      plannedFor: "",
      plannedBaseline: "2026-08-12",
      time: "",
      doseMg: "",
      injectionSite: "",
      injectionSitePosition: "",
      testosteroneEster: "",
      carrierOil: "",
      pain: "",
      offDays: "",
      notes: "",
    };
    render(
      <ShotForm
        onAddShot={() => "saved" as const}
        onUpdateShot={() => "saved" as const}
        editingShot={{ id: "a", date: "2026-08-12", plannedFor: "2026-08-12" }}
        draft={parked}
        shots={[{ id: "a", date: "2026-08-12" }]}
        profile={grid}
      />,
    );
    expect(planned().value).toBe("");
  });

  it("does not refill a planned date the user removed and saved", () => {
    // The `||` fallback was fixed once for the parked-draft path and left on
    // the other, which is the same bug reported twice. A shot whose planned
    // date was deliberately cleared and SAVED came back refilled from today's
    // computation: the form read clean, so ✕ dismissed with no confirm, and
    // Save re-froze the value that had been removed. It also quietly attached a
    // today's-cadence planned date to any pre-cadence shot opened to fix a typo.
    //
    // "This shot has no planned date" is indistinguishable from "logged before
    // there was a cadence", so an edit takes the record verbatim and the app
    // guesses between them not at all.
    const onUpdateShot = vi.fn((shot: ShotEntry): SaveOutcome =>
      shot ? "saved" : "ignored",
    );
    render(
      <ShotForm
        onAddShot={() => "saved" as const}
        onUpdateShot={onUpdateShot}
        editingShot={{ id: "a", date: "2026-08-12" }}
        shots={[{ id: "a", date: "2026-08-12" }]}
        profile={grid}
      />,
    );
    expect(planned().value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: /Update shot/i }));
    expect(onUpdateShot.mock.calls[0]?.[0]?.plannedFor).toBeUndefined();
  });

  it("counts an edited planned date as unsaved input", () => {
    // Without this the form looked clean, so dismissing discarded the
    // correction with no confirm — and in the mixed case the notes were
    // restored while the planned date silently reverted.
    const ref =
      React.createRef<ShotDraft | null>() as React.RefObject<ShotDraft | null>;
    render(
      <ShotForm
        onAddShot={() => "saved" as const}
        onUpdateShot={() => "saved" as const}
        editingShot={{ id: "a", date: "2026-08-05", plannedFor: "2026-08-05" }}
        shots={[{ id: "a", date: "2026-08-05", plannedFor: "2026-08-05" }]}
        profile={grid}
        liveDraftRef={ref}
      />,
    );
    fireEvent.change(planned(), { target: { value: "2026-07-29" } });
    expect(ref.current).not.toBeNull();
    expect(ref.current!.plannedFor).toBe("2026-07-29");
  });
});

describe("ShotForm required/optional marking", () => {
  // The form is one required field in eleven, so it marks the ONE rather than
  // tagging the ten — the sentence covers the rest. Both halves are pinned
  // here because either alone is a half-measure: the attribute without the
  // word is invisible, and the word without the attribute is decoration.
  it("marks the date required in both registers, without renaming the field", () => {
    render(<ShotForm onAddShot={vi.fn()} shots={[]} />);

    // The visible word, for everyone reading the form.
    expect(screen.getByText("Required")).toBeInTheDocument();
    // The machine-readable half, which is what assistive tech announces.
    expect(screen.getByLabelText("Date")).toBeRequired();

    // And the word must stay OUT of the accessible name. Nesting it inside the
    // <label> is the natural way to write this and names the field "Date
    // Required", which screen readers then read as "Date Required, required".
    // jsdom computes the name from the label's text content, so this asserts on
    // the same thing it does; the browser's own a11y tree was checked separately.
    const label = document.querySelector<HTMLLabelElement>(
      'label[for="shot-date-field"]',
    );
    expect(label).not.toBeNull();
    expect(label!.textContent).toBe("Date");
  });

  it("says once that everything else is optional, rather than per field", () => {
    render(<ShotForm onAddShot={vi.fn()} shots={[]} />);

    expect(screen.getByText(/only the date is needed/i)).toBeInTheDocument();
    // The counterpart of the rule above: no field carries an "(optional)" tag.
    expect(screen.queryByText(/\(optional\)/i)).toBeNull();
  });
});

describe("ShotForm — injection pain", () => {
  const chip = (name: string | RegExp) => screen.getByRole("radio", { name });

  it("names the field so you can tell what is being asked", () => {
    // "How the injection felt" was the roadmap's wording and never says pain,
    // so the chips had to explain the label rather than the other way round.
    render(<ShotForm onAddShot={vi.fn()} />);
    expect(
      screen.getByRole("group", { name: "Injection pain" }),
    ).toBeInTheDocument();
  });

  it("stores the level, not a number", () => {
    const onAddShot = vi.fn((): SaveOutcome => "saved");
    render(<ShotForm onAddShot={onAddShot} />);

    fireEvent.click(chip("Severe"));
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot).toHaveBeenCalledWith(
      expect.objectContaining({ pain: "severe" }),
    );
  });

  it("keeps 'None' and 'not recorded' as different answers", () => {
    // The distinction the Clear control exists for, and the reason pain is an
    // optional enum rather than a value with a zero in it: "none" says the
    // injection did not hurt, undefined says nobody said.
    const onAddShot = vi.fn((): SaveOutcome => "saved");
    const first = render(<ShotForm onAddShot={onAddShot} />);
    fireEvent.click(chip("None"));
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));
    expect(onAddShot).toHaveBeenLastCalledWith(
      expect.objectContaining({ pain: "none" }),
    );
    first.unmount();

    const second = vi.fn((shot: ShotEntry): SaveOutcome =>
      shot ? "saved" : "ignored",
    );
    render(<ShotForm onAddShot={second} />);
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));
    expect(second.mock.calls[0][0].pain).toBeUndefined();
  });

  it("offers Clear only once something is set, and it returns to unrecorded", () => {
    const onAddShot = vi.fn((shot: ShotEntry): SaveOutcome =>
      shot ? "saved" : "ignored",
    );
    render(<ShotForm onAddShot={onAddShot} />);

    // Nothing chosen yet: no way to clear, because there is nothing to clear.
    expect(
      screen.queryByRole("button", { name: "Clear injection pain" }),
    ).toBeNull();

    fireEvent.click(chip("Moderate"));
    expect(chip("Moderate")).toBeChecked();

    fireEvent.click(
      screen.getByRole("button", { name: "Clear injection pain" }),
    );
    screen.getAllByRole("radio").forEach((c) => expect(c).not.toBeChecked());
    expect(
      screen.queryByRole("button", { name: "Clear injection pain" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));
    expect(onAddShot.mock.calls[0][0].pain).toBeUndefined();
  });

  it("restores the stored level when an existing shot is opened", () => {
    render(
      <ShotForm
        onAddShot={vi.fn()}
        onUpdateShot={vi.fn()}
        editingShot={{ id: "a", date: "2026-08-05", pain: "mild" }}
        shots={[]}
      />,
    );
    expect(chip("Mild")).toBeChecked();
    expect(chip("Severe")).not.toBeChecked();
  });

  it("has no validation to fail, which is the point", () => {
    // The 0-10 input carried an inline range error because the native step/max
    // hints were cancelling the submit silently and leaving a dead button. Four
    // chips cannot produce a value the schema would refuse, so the whole error
    // path goes — and a save with pain set must never be blocked.
    const onAddShot = vi.fn((): SaveOutcome => "saved");
    render(<ShotForm onAddShot={onAddShot} />);
    fireEvent.click(chip("Severe"));
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/whole number from 0 to 10/i)).toBeNull();
  });
});

describe("ShotForm — Clear removes itself, so it hands focus on", () => {
  it("never leaves focus on <body> when it disappears", () => {
    // The condition that renders this button is the value it clears, so
    // activating it unmounts the element holding focus. Measured before the
    // fix: `document.activeElement` was <body> — inside a dialog whose #root is
    // inert, where the next Tab has nothing to wrap from and the trap cannot
    // re-engage. That is the nine-defect class from slice B, and the "Clear
    // form" button in the same sheet carries a comment warning against exactly
    // this shape.
    render(<ShotForm onAddShot={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Moderate" }));

    const clear = screen.getByRole("button", { name: "Clear injection pain" });
    clear.focus();
    expect(document.activeElement).toBe(clear);

    fireEvent.click(clear);

    expect(document.activeElement).not.toBe(document.body);
    expectFocusSomewhereUseful("clearing injection pain");
    // And that focus is VISIBLE, which is a different assertion — the one above
    // only says focus is not nowhere. Without this the test passed with the
    // chips' only focus rule deleted: focus moving with nothing on screen
    // changing is half of the defect, not none of it (WCAG 2.4.7).
    expectVisibleFocusRing("clearing injection pain");
    // And explicitly, because the guard above cannot bind here: the element
    // holding focus is the radio, which is `opacity: 0` and stretched over the
    // pill — and it matches the stylesheet's generic `input:focus` rule, which
    // paints border-colour and box-shadow on a control that renders nothing.
    // The ring this control actually has is on the LABEL, via `:focus-within`.
    // Measured: with that rule deleted, `expectVisibleFocusRing` still passed.
    // So assert the real relationship, and let focus.test.ts assert the rule
    // exists — together those two fail if either half goes.
    expect(document.activeElement?.closest(".pain-chip")).not.toBeNull();
    // Back to the group it belongs to: you are still answering this question.
    expect(document.activeElement).toBe(
      screen.getByRole("radio", { name: "None" }),
    );
  });
});

describe("ShotForm — a stored level the enum does not contain", () => {
  it("is neither shown as chosen nor written back on save", () => {
    // `sanitizeShots` vets only a non-blank id and date, so junk reaches the
    // form. Seeded raw it checked no chip, sat invisible, and was saved
    // unchanged — producing a shot the app's own importer rejects, which the
    // README calls the worst outcome this product can produce.
    const junk = {
      id: "a",
      date: "2026-08-05",
      pain: "agony",
    } as unknown as ShotEntry;
    const onUpdateShot = vi.fn((shot: ShotEntry): SaveOutcome =>
      shot ? "saved" : "ignored",
    );
    render(
      <ShotForm
        onAddShot={vi.fn()}
        onUpdateShot={onUpdateShot}
        editingShot={junk}
        shots={[]}
      />,
    );

    screen.getAllByRole("radio").forEach((c) => expect(c).not.toBeChecked());
    fireEvent.click(screen.getByRole("button", { name: /Update shot/i }));

    expect(onUpdateShot.mock.calls[0][0].pain).toBeUndefined();
  });
});

describe("ShotForm — the pain group is one tab stop", () => {
  it("does not put every chip in the tab order when none is checked", () => {
    // `tabbable` reports EVERY radio as tabbable while none in the group is
    // checked — right about focusability, wrong about tab order, since arrow
    // keys are how you move within a group. The trap owns Tab and rotates
    // through that list, so the library's answer became the behaviour and the
    // four chips were four stops in the state every new shot starts in.
    //
    // Asserted against the list the trap actually uses rather than by pressing
    // Tab, because jsdom does not implement sequential focus navigation: the
    // browser half was measured separately (one stop forward, one back).
    render(<ShotForm onAddShot={vi.fn()} />);
    const form = document.querySelector("form")!;
    const radios = [...form.querySelectorAll('input[name="pain"]')];
    expect(radios).toHaveLength(4);
    radios.forEach((r) => expect(r).not.toBeChecked());

    // The escape hatch fires on exactly this condition, so pin the condition.
    const checked = form.querySelector('input[name="pain"]:checked');
    expect(checked).toBeNull();
  });

  it("collapses to the checked chip once one is chosen", () => {
    render(<ShotForm onAddShot={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Moderate" }));
    const form = document.querySelector("form")!;
    expect(form.querySelectorAll('input[name="pain"]:checked')).toHaveLength(1);
  });
});

describe("every member of a field row is a field-cell", () => {
  it("holds for every row in the sheet", () => {
    /*
     * `.form-row` is a flex row above 560px and `.field-cell` is `flex: 1 1 0`.
     * A bare child gets `flex: 0 1 auto` with a max-content basis instead, takes
     * the row, and starves its neighbours. The off-days fieldset shipped without
     * the wrapper and did exactly that: measured in a browser, the pain cell was
     * 1px at 600px and 8px above it, its four chips stacked vertically and
     * painted over the next column, with "Injection pain" overprinting "Any days
     * you felt off?".
     *
     * STATED HONESTLY: this is a structural check, and it cannot see the crush —
     * jsdom computes no layout, so the widths above are browser-only. It guards
     * the invariant that produces them, which is the most this environment can
     * do; the real check is the browser pass, and the reason THIS one exists is
     * that the browser pass swept 320–430px only, all below the breakpoint, so
     * nothing it measured could have caught it.
     */
    render(<ShotForm onAddShot={vi.fn()} />);
    const rows = [...document.querySelectorAll(".form-row")];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const strays = [...row.children].filter(
        (child) => !child.classList.contains("field-cell"),
      );
      expect(
        strays.map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
      ).toEqual([]);
    }
  });
});

describe("ShotForm — off days", () => {
  const chip = (name: string | RegExp) => screen.getByRole("radio", { name });

  it("saves the pattern the chip stands for, not its label", () => {
    const onAddShot = vi.fn((shot: ShotEntry): SaveOutcome =>
      shot ? "saved" : "ignored",
    );
    render(<ShotForm onAddShot={onAddShot} />);
    fireEvent.click(chip(/^Right before/));
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));
    expect(onAddShot.mock.calls[0][0].offDays).toBe("right-before");
  });

  it("offers the peak side as well as the trough", () => {
    // The four-value version could only express the trough — the last 1–2 days
    // before the next dose. Testosterone peaks 24–48h AFTER the injection, with
    // estradiol rising alongside it, so anyone whose off days land there had to
    // answer "here and there" and lose the pattern. Both windows are documented,
    // and the cyclic one is what the guidance says to investigate.
    const onAddShot = vi.fn((shot: ShotEntry): SaveOutcome =>
      shot ? "saved" : "ignored",
    );
    render(<ShotForm onAddShot={onAddShot} />);
    fireEvent.click(chip(/^Early on/));
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));
    expect(onAddShot.mock.calls[0][0].offDays).toBe("right-after");
  });

  it("keeps the position in the accessible name, not only in the dots", () => {
    // Short visible labels move the position into the strip, and the strip is
    // aria-hidden — so the name is where that fact has to survive, or it exists
    // only in something assistive tech cannot see (WCAG 1.3.1). And the name
    // starts with the visible text, so voice control still matches (2.5.3).
    render(<ShotForm onAddShot={vi.fn()} />);
    const early = chip(/^Early on/);
    expect(early).toHaveAccessibleName(
      "Early on — the days right after your previous shot",
    );

    const row = early.closest(".off-days-row")!;
    expect(row.querySelector(".off-days-row__label")!.textContent).toBe(
      "Early on",
    );
    expect(
      row.querySelector(".off-days-row__strip")!.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("draws all five rows, each with an eight-slot strip", () => {
    render(<ShotForm onAddShot={vi.fn()} />);
    const rows = document.querySelectorAll(".off-days-row");
    expect(rows).toHaveLength(5);
    rows.forEach((r) =>
      expect(r.querySelectorAll(".off-days-row__strip i")).toHaveLength(8),
    );
  });

  it("offers Clear only once something is set, and it returns to unrecorded", () => {
    // `undefined` is not `"none"`: nobody answered, versus there weren't any.
    // Clear is the ONLY way back to the first, so without it a mis-tap on an
    // optional field would be permanent.
    const onAddShot = vi.fn((shot: ShotEntry): SaveOutcome =>
      shot ? "saved" : "ignored",
    );
    render(<ShotForm onAddShot={onAddShot} />);

    expect(screen.queryByRole("button", { name: "Clear off days" })).toBeNull();

    fireEvent.click(chip(/^Here and there/));
    expect(chip(/^Here and there/)).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Clear off days" }));
    expect(chip(/^Here and there/)).not.toBeChecked();
    expect(screen.queryByRole("button", { name: "Clear off days" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));
    expect(onAddShot.mock.calls[0][0].offDays).toBeUndefined();
  });

  it("hands focus on when Clear removes itself", () => {
    // Clear's rendering condition IS the value it clears, so it deletes itself
    // on activation. Without a hand-off, focus lands on <body> inside a dialog
    // whose #root is inert, where the trap cannot re-engage — the nine-defect
    // class from slice B.
    render(<ShotForm onAddShot={vi.fn()} />);
    fireEvent.click(chip(/^Most days/));
    const clear = screen.getByRole("button", { name: "Clear off days" });
    clear.focus();
    fireEvent.click(clear);
    // Synchronous, not `expectFocusSettled`: no dialog unmounts here. The form
    // stays mounted and only the button goes, so React has already re-rendered
    // by the time `fireEvent` returns — the same helper the pain group's Clear
    // uses, for the same reason.
    expectFocusSomewhereUseful("clearing off days");
    // `expectVisibleFocusRing` alone is VACUOUS here, exactly as the pain
    // group's test records: the focused element is the `opacity: 0` radio,
    // which matches the stylesheet's generic `input:focus` rule, so the guard
    // passes whether or not the row's own ring exists. Assert the relationship
    // the ring actually depends on — focus is inside the ROW, which is what
    // `.off-days-row:has(input:focus-visible)` paints — and which row it is.
    const active = document.activeElement as HTMLInputElement;
    expect(active.closest(".off-days-row")).not.toBeNull();
    expect(active.value).toBe(OFF_DAYS_PATTERNS[0]);
    expectVisibleFocusRing("after clearing off days");
  });

  it("keeps its own Clear separate from the pain group's", () => {
    // Two Clear controls can be on screen at once, and both are named "Clear".
    // Only the accessible name tells them apart, so clearing one must not
    // disturb the other.
    render(<ShotForm onAddShot={vi.fn()} />);
    fireEvent.click(chip("Moderate"));
    fireEvent.click(chip(/^Here and there/));

    fireEvent.click(screen.getByRole("button", { name: "Clear off days" }));
    expect(chip("Moderate")).toBeChecked();
    expect(chip(/^Here and there/)).not.toBeChecked();
  });

  it("restores a stored pattern, and ignores one the enum does not know", () => {
    // Storage is lenient — `sanitizeShots` vets only id and date — so a value
    // predating the enum reaches the seed. Cast unchecked it would put a
    // phantom into a group where no chip matches and Clear is the only way out.
    const { unmount } = render(
      <ShotForm
        onAddShot={vi.fn()}
        onUpdateShot={vi.fn()}
        editingShot={{ id: "a", date: "2026-08-05", offDays: "right-before" }}
        shots={[]}
      />,
    );
    expect(chip(/^Right before/)).toBeChecked();
    unmount();

    render(
      <ShotForm
        onAddShot={vi.fn()}
        onUpdateShot={vi.fn()}
        editingShot={
          {
            id: "b",
            date: "2026-08-05",
            offDays: "a bit rough",
          } as unknown as ShotEntry
        }
        shots={[]}
      />,
    );
    screen.getAllByRole("radio").forEach((c) => expect(c).not.toBeChecked());
    expect(screen.queryByRole("button", { name: "Clear off days" })).toBeNull();
  });

  it("is one tab stop while nothing is chosen", () => {
    // `tabbable` reports EVERY radio as tabbable while none is checked — right
    // about focusability, wrong about tab order. The trap owns Tab, so without
    // its unchecked-group hatch the four chips become four stops in the state
    // every new shot starts in.
    render(<ShotForm onAddShot={vi.fn()} />);
    const form = document.querySelector("form")!;
    expect(form.querySelectorAll('input[name="offDays"]')).toHaveLength(5);
    expect(form.querySelectorAll('input[name="offDays"]:checked')).toHaveLength(
      0,
    );
    fireEvent.click(chip("Not really"));
    expect(form.querySelectorAll('input[name="offDays"]:checked')).toHaveLength(
      1,
    );
  });

  describe("the recall window", () => {
    it("names the real span rather than saying 'this week'", () => {
      // Cadence here runs 3–14 days, so a fixed word would be wrong for most
      // people. Naming the span is also what lets the four answers keep one
      // meaning each at any interval length.
      render(
        <ShotForm
          onAddShot={vi.fn()}
          shots={[{ id: "prev", date: "2026-08-12" }]}
        />,
      );
      fireEvent.change(screen.getByLabelText("Date"), {
        target: { value: "2026-08-25" },
      });
      expect(
        screen.getByText("Since your previous shot · 13 days"),
      ).toBeInTheDocument();
    });

    it("re-measures when the date is changed", () => {
      render(
        <ShotForm
          onAddShot={vi.fn()}
          shots={[{ id: "prev", date: "2026-08-12" }]}
        />,
      );
      fireEvent.change(screen.getByLabelText("Date"), {
        target: { value: "2026-08-19" },
      });
      expect(
        screen.getByText("Since your previous shot · 7 days"),
      ).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Date"), {
        target: { value: "2026-08-13" },
      });
      expect(
        screen.getByText("Since your previous shot · 1 day"),
      ).toBeInTheDocument();
    });

    it("names the window of the shot being EDITED, not of the latest one", () => {
      // The screen where the first wording ("since your last shot") was false.
      // Editing a shot from months back measures the gap before IT — correctly
      // — while "your last shot" means the recent one, so the number and the
      // words described different things.
      render(
        <ShotForm
          onAddShot={vi.fn()}
          onUpdateShot={vi.fn()}
          editingShot={{ id: "old", date: "2026-05-20" }}
          shots={[
            { id: "older", date: "2026-05-13" },
            { id: "old", date: "2026-05-20" },
            { id: "recent", date: "2026-08-25" },
          ]}
        />,
      );
      expect(
        screen.getByText("Since your previous shot · 7 days"),
      ).toBeInTheDocument();
    });

    it("puts the window in the group's NAME, not a description of it", () => {
      // A description on a fieldset was the first attempt and it was a
      // prediction: group-level descriptions are announced inconsistently, and
      // iOS VoiceOver — this app's primary platform — does not reliably surface
      // fieldset semantics at all. A NAME is announced on entering the group
      // everywhere, so this shape does not rest on support we cannot check.
      render(
        <ShotForm
          onAddShot={vi.fn()}
          shots={[{ id: "prev", date: "2026-08-12" }]}
        />,
      );
      fireEvent.change(screen.getByLabelText("Date"), {
        target: { value: "2026-08-25" },
      });
      // EXACT, not `\s*`. The loose form was the first version and it would
      // have passed either way — JSX strips the newline between the question
      // and the span, so the name really did compute as "...off?The 13...".
      // Verified against the browser's own accname computation, which is what
      // this string is a stand-in for.
      const group = screen.getByRole("group", {
        name: "Any days you felt off? Since your previous shot · 13 days",
      });
      expect(group).toBeInTheDocument();
      // And nothing hangs off a description that may never be read.
      expect(group.getAttribute("aria-describedby")).toBeNull();
    });

    it("holds still under the ✓ instead of blinking out", () => {
      // The sheet must not change under its own confirmation — the rule the
      // post-save field reset was deleted for. This broke it by a different
      // route: saving a NEW shot puts it into `shots` with the date on screen,
      // and a same-day shot counts as the one before, so the shot became its
      // own predecessor, the gap read 0, and the window vanished. It blinked
      // out under "✓ Saved" while the sheet sat there for ~440ms.
      const saved = { id: "new", date: "2026-08-25" };
      const { rerender } = render(
        <ShotForm
          onAddShot={vi.fn()}
          shots={[{ id: "prev", date: "2026-08-12" }]}
          confirming={false}
        />,
      );
      fireEvent.change(screen.getByLabelText("Date"), {
        target: { value: "2026-08-25" },
      });
      expect(
        screen.getByText("Since your previous shot · 13 days"),
      ).toBeInTheDocument();

      // What App does at save: the new shot lands in `shots` and the ✓ starts.
      rerender(
        <ShotForm
          onAddShot={vi.fn()}
          shots={[{ id: "prev", date: "2026-08-12" }, saved]}
          confirming
        />,
      );
      expect(
        screen.getByText("Since your previous shot · 13 days"),
      ).toBeInTheDocument();
    });

    it("carries the anchor in the group's name even with no length", () => {
      render(<ShotForm onAddShot={vi.fn()} shots={[]} />);
      expect(
        screen.getByRole("group", {
          name: "Any days you felt off? Since your previous shot",
        }),
      ).toBeInTheDocument();
    });

    it("still names the window when it cannot measure it", () => {
      // The first entry has no predecessor, so there is no length — and this is
      // exactly where the anchor used to disappear, leaving the shot with the
      // least context saying nothing about what window was being asked about.
      // "Since your previous shot" is true even when the app cannot compute it.
      render(<ShotForm onAddShot={vi.fn()} shots={[]} />);
      expect(
        screen.getByRole("radio", { name: "Not really" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Since your previous shot")).toBeInTheDocument();
      // ...and no invented length beside it.
      expect(screen.queryByText(/·/)).toBeNull();
    });
  });
});
