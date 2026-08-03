import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShotForm, type ShotDraft } from "../ShotForm";
import type { ShotEntry } from "../../types/shot";
import { todayLocalISO } from "../../utils/datetime";

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

  it("keeps only dose/type/oil filled after adding, and clears injection site", () => {
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} shots={history} />);

    fireEvent.click(screen.getByRole("button", { name: "50" }));
    fireEvent.click(screen.getByRole("button", { name: "cypionate" }));
    fireEvent.click(screen.getByRole("button", { name: "cottonseed" }));
    fireEvent.click(screen.getByRole("button", { name: "thigh" }));
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot).toHaveBeenCalledTimes(1);

    const doseInput = screen.getByPlaceholderText("e.g. 50") as HTMLInputElement;
    const siteInput = screen.getByPlaceholderText(
      /thigh, glute, stomach/i
    ) as HTMLInputElement;

    // Values that stay the same shot-to-shot persist, so a repeat needs no re-entry.
    expect(doseInput.value).toBe("50");
    expect(esterInput().value).toBe("cypionate");
    expect(oilInput().value).toBe("cottonseed");
    // Injection site clears — it's commonly rotated.
    expect(siteInput.value).toBe("");
  });

  it("clears per-shot fields (site, position, pain, mood, notes) after adding", () => {
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} shots={history} />);

    const site = screen.getByPlaceholderText(/thigh, glute, stomach/i) as HTMLInputElement;
    const position = screen.getByPlaceholderText(/left, right, upper left/i) as HTMLInputElement;
    const pain = screen.getByPlaceholderText("e.g. 3") as HTMLInputElement;
    const mood = screen.getByPlaceholderText(/low, okay, good/i) as HTMLInputElement;
    const notes = screen.getByPlaceholderText(/remember for later/i) as HTMLTextAreaElement;
    fireEvent.change(site, { target: { value: "bicep" } });
    fireEvent.change(position, { target: { value: "left" } });
    fireEvent.change(pain, { target: { value: "4" } });
    fireEvent.change(mood, { target: { value: "good" } });
    fireEvent.change(notes, { target: { value: "felt fine" } });

    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(site.value).toBe("");
    expect(position.value).toBe("");
    expect(pain.value).toBe("");
    expect(mood.value).toBe("");
    expect(notes.value).toBe("");
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

  it("surfaces a message when the date is empty", () => {
    // The form carries `noValidate`, so a missing date no longer bounces off the
    // browser's `required` check — it reaches our validation, and must say so
    // rather than leaving Save looking broken.
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} />);
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please enter a real calendar date"
    );
    expect(screen.getByLabelText("Date")).toHaveAttribute("aria-invalid", "true");

    // Typing a date clears the message as you go, not only on the next submit.
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-06-15" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
    dateTouched = true
  ): ShotDraft => ({
    date,
    dateTouched,
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
