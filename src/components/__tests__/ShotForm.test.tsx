import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShotForm } from "../ShotForm";
import type { ShotEntry } from "../../types/shot";

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
