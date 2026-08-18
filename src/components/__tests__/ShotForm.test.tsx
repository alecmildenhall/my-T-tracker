import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShotForm, type ShotDraft } from "../ShotForm";
import type { ShotEntry } from "../../types/shot";
import { todayLocalISO } from "../../utils/datetime";
import { isShotDateInRange, shotDateRange } from "../../utils/civilDate";

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
    expect((screen.getByPlaceholderText("e.g. 50") as HTMLInputElement).value).toBe("50");
    expect(esterInput().value).toBe("cypionate");
    expect(oilInput().value).toBe("cottonseed");
    // Injection site does not — it's commonly rotated.
    expect(
      (screen.getByPlaceholderText(/thigh, glute, stomach/i) as HTMLInputElement).value
    ).toBe("");
  });

  it("starts the next shot with per-shot fields empty (site, position, pain, mood, notes)", () => {
    const onAddShot = vi.fn();
    const first = render(<ShotForm onAddShot={onAddShot} shots={history} />);

    fireEvent.change(screen.getByPlaceholderText(/thigh, glute, stomach/i), {
      target: { value: "bicep" },
    });
    fireEvent.change(screen.getByPlaceholderText(/left, right, upper left/i), {
      target: { value: "left" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 3"), { target: { value: "4" } });
    fireEvent.change(screen.getByPlaceholderText(/low, okay, good/i), {
      target: { value: "good" },
    });
    fireEvent.change(screen.getByPlaceholderText(/remember for later/i), {
      target: { value: "felt fine" },
    });

    // Still on screen at the moment of saving: the sheet is visibly there for the
    // ✓ and the slide, and blanking the entry under a success message reads as
    // losing it.
    const saved = saveAndReopen(onAddShot);
    expect(
      (screen.getByPlaceholderText(/remember for later/i) as HTMLTextAreaElement).value
    ).toBe("felt fine");
    first.unmount();

    render(<ShotForm onAddShot={vi.fn()} shots={[...history, saved]} />);

    expect(
      (screen.getByPlaceholderText(/thigh, glute, stomach/i) as HTMLInputElement).value
    ).toBe("");
    expect(
      (screen.getByPlaceholderText(/left, right, upper left/i) as HTMLInputElement).value
    ).toBe("");
    expect((screen.getByPlaceholderText("e.g. 3") as HTMLInputElement).value).toBe("");
    expect(
      (screen.getByPlaceholderText(/low, okay, good/i) as HTMLInputElement).value
    ).toBe("");
    expect(
      (screen.getByPlaceholderText(/remember for later/i) as HTMLTextAreaElement).value
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

    const pain = screen.getByPlaceholderText("e.g. 3") as HTMLInputElement;
    expect(pain.value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    const saved = onAddShot.mock.calls[0][0] as ShotEntry;
    expect(saved.painScore).toBeUndefined();
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
      />
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
    fireEvent.change(byLabel("Pain (0\u201310)"), { target: { value: "4" } });
    fireEvent.change(byLabel("Mood"), { target: { value: "good" } });
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
      painScore: 4,
      mood: "good",
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
      "Add the date this shot was taken."
    );
    expect(screen.getByLabelText("Date")).toHaveAttribute("aria-invalid", "true");

    // Typing a date clears the message as you go, not only on the next submit.
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-06-15" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
    expect(screen.getByLabelText("Date")).toHaveAttribute("aria-invalid", "true");

    // The message names the boundary DATES, not their years. It used to say
    // "1900 to 2027" while the real bound was 2027-08-13 — so a date late in
    // the final year was refused by a message listing the very year that had
    // just been typed, leaving nothing to work out.
    const { min, max } = shotDateRange();
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
      ""
    );

    const sized = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, sel, body]) =>
        /\b(input|textarea|select)\b/.test(sel) && /font-size:/.test(body)
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
      />
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

  it("refuses a decimal pain score with a visible message, not a dead button", () => {
    // Pain is stored as a whole 0–10 (the schema enforces it, so a decimal would
    // fail to re-import from its own backup). The native step/max constraints used
    // to cancel the submit event outright: nothing saved, nothing said.
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} />);
    fireEvent.change(screen.getByLabelText("Pain (0–10)"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Pain must be a whole number from 0 to 10."
    );

    // Correcting it clears the message and saves.
    fireEvent.change(screen.getByLabelText("Pain (0–10)"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));
    expect(onAddShot.mock.calls[0][0]).toMatchObject({ painScore: 3 });
  });

  it("keeps an error message out of the field's accessible name", () => {
    // Text inside a <label> becomes part of the field's accessible name, so an
    // error rendered there would rename the field to "Pain (0–10)<the error>" —
    // breaking both screen-reader announcements and label-based queries. The
    // error is a sibling, reached via aria-describedby.
    render(<ShotForm onAddShot={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Pain (0–10)"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    const pain = screen.getByLabelText("Pain (0–10)");
    expect(pain).toHaveAccessibleName("Pain (0–10)");
    expect(pain).toHaveAttribute("aria-invalid", "true");
    expect(pain).toHaveAccessibleDescription(
      "Pain must be a whole number from 0 to 10."
    );
  });

  it("refuses an out-of-range pain score too", () => {
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} />);
    fireEvent.change(screen.getByLabelText("Pain (0–10)"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("refuses a negative dose with a message", () => {
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} />);
    fireEvent.change(screen.getByLabelText("Dose (mg)"), { target: { value: "-5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Dose must be a positive number.");
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
      "painScore",
      "mood",
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
          { id: "1", date: "2026-05-01", testosteroneEster: "cypionate", carrierOil: "grapeseed" },
        ]}
      />
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
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "wip" } });

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
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-06-01" } });

    expect(ref.current!.date).toBe("2026-06-01");
  });

  const draftWith = (
    date: string,
    notes = "carried over",
    dateBaseline = "1970-01-01" // anything but `date` = "the user chose this"
  ): ShotDraft => ({
    date,
    dateBaseline,
    time: "",
    doseMg: "",
    injectionSite: "",
    injectionSitePosition: "",
    testosteroneEster: "",
    carrierOil: "",
    painScore: "",
    mood: "",
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
      expect(screen.getByLabelText("Notes")).toHaveValue("half filled in yesterday");
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
      fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "note" } });
      const parked = ref.current!;
      first.unmount();

      vi.setSystemTime(new Date("2026-08-02T09:00:00"));
      const ref2 = emptyRef();
      render(<ShotForm onAddShot={vi.fn()} draft={parked} liveDraftRef={ref2} />);
      // It restores dirty, so dismissing still keeps it...
      expect(ref2.current).not.toBeNull();

      // ...but emptying it out means there is nothing left worth keeping.
      fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "" } });
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
      fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "wip" } });
      const parked = ref.current!;
      first.unmount();

      vi.setSystemTime(new Date("2026-08-02T09:00:00"));
      render(<ShotForm onAddShot={vi.fn()} draft={parked} liveDraftRef={emptyRef()} />);
      expect(screen.getByLabelText("Date")).toHaveValue("2026-08-01");

      fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "" } });
      fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "still going" } });

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
      fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-07-20" } });

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
      render(<ShotForm onAddShot={vi.fn()} draft={parked} liveDraftRef={emptyRef()} />);

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

    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "wip" } });
    expect(screen.getByRole("button", { name: "Clear form" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-06-01" } });
    expect(screen.getByRole("button", { name: "Clear form" })).toBeInTheDocument();
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
      fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "x" } });

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
      />
    );

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: todayLocalISO() },
    });

    expect(ref.current).not.toBeNull();
    expect(ref.current!.date).toBe(todayLocalISO());
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
      />
    );

    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-05-02" } });
    expect(ref.current).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-05-01" } });
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
    const editing: ShotEntry = { id: "e1", date: "2026-05-05", notes: "original" };
    const parked: ShotDraft = { ...draftWith("2026-06-10", "original") };
    const ref = emptyRef();
    render(
      <ShotForm
        onAddShot={vi.fn()}
        onUpdateShot={vi.fn()}
        editingShot={editing}
        draft={parked}
        liveDraftRef={ref}
      />
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
    const editing: ShotEntry = { id: "e1", date: "2026-06-01", notes: "original" };
    render(
      <ShotForm
        onAddShot={vi.fn()}
        onUpdateShot={vi.fn()}
        editingShot={editing}
        liveDraftRef={ref}
      />
    );
    // Untouched: nothing to remember.
    expect(ref.current).toBeNull();

    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "rewritten" } });
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

    expect(screen.getByRole("alert")).toHaveTextContent(/download didn.t start/i);
  });

  it("stays quiet when the handler reports the download started", () => {
    render(
      <ShotForm onAddShot={() => "refused"} onExportBackup={() => true} shots={[]} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));
    fireEvent.click(screen.getByRole("button", { name: "Export a backup" }));

    expect(screen.getByRole("alert")).not.toHaveTextContent(/download didn.t start/i);
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
