import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CadencePicker } from "../CadencePicker";
import type { Profile } from "../../types/profile";

type Patch = Partial<Profile>;

/** The picker with a spy, plus a switch to take it away — what a tab change does. */
const setup = (profile: Partial<Profile> = {}) => {
  const onChange = vi.fn<(p: Patch) => void>();
  const Harness = ({ shown }: { shown: boolean }) =>
    shown ? (
      <CadencePicker idPrefix="t" profile={profile} onChange={onChange} />
    ) : null;
  const view = render(<Harness shown />);
  return {
    onChange,
    remove: () => view.rerender(<Harness shown={false} />),
    /** Every patch merged, which is what the profile would end up holding. */
    merged: () => Object.assign({}, ...onChange.mock.calls.map((c) => c[0])),
  };
};

const mode = (name: RegExp) => screen.getByRole("radio", { name });
const numberBox = () =>
  screen.getByRole("spinbutton") as HTMLInputElement;

describe("CadencePicker — nothing is pre-selected", () => {
  it("starts with no rhythm chosen and no fields revealed", () => {
    setup();
    expect(
      screen.getAllByRole("radio").filter((r) => (r as HTMLInputElement).checked),
    ).toHaveLength(0);
    // No day toggles and no number box until a rhythm is picked.
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.queryByRole("button", { name: "Monday" })).toBeNull();
  });

  it("writes nothing at all until the user picks something", () => {
    // The whole point. A pre-selected rhythm would be stored by simply opening
    // the card, and lateness freezes at log time — so every later shot would be
    // measured against a schedule nobody chose, unrepairably.
    const { onChange } = setup();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reflects a rhythm already saved", () => {
    setup({ scheduleMode: "grid", shotDays: ["monday"], intervalDays: 14 });
    expect((mode(/On certain days/) as HTMLInputElement).checked).toBe(true);
    // Weeks in the box, days in storage.
    expect(numberBox().value).toBe("2");
  });
});

describe("CadencePicker — choosing a rhythm", () => {
  it("stores the mode the moment it is picked, before anything else", () => {
    // So a half-answered setting still shows your own choice when you return.
    const { onChange } = setup();
    fireEvent.click(mode(/On certain days/));
    expect(onChange).toHaveBeenCalledWith({ scheduleMode: "grid" });
  });

  it("stores days as a SET, which is the capability this adds", () => {
    const { merged } = setup({ scheduleMode: "grid" });
    fireEvent.click(screen.getByRole("button", { name: "Monday" }));
    fireEvent.click(screen.getByRole("button", { name: "Thursday" }));
    // Twice-weekly TRT — every 3.5 days, which a whole-number interval and a
    // single weekday could not express between them.
    expect(merged().shotDays).toEqual(["monday", "thursday"]);
  });

  it("uses aria-pressed on the days, not aria-current", () => {
    // They sit beside chips that DO use aria-current, and the two mean different
    // things: "this is on" versus "this is the current one in a set". Copying
    // the chip markup is the obvious move and would ship a screen-reader bug.
    setup({ scheduleMode: "grid", shotDays: ["monday"] });
    const monday = screen.getByRole("button", { name: "Monday" });
    expect(monday).toHaveAttribute("aria-pressed", "true");
    expect(monday).not.toHaveAttribute("aria-current");
  });

  it("converts weeks to stored days", () => {
    const { merged } = setup({ scheduleMode: "grid", shotDays: ["monday"] });
    fireEvent.change(numberBox(), { target: { value: "2" } });
    fireEvent.blur(numberBox());
    expect(merged().intervalDays).toBe(14);
  });

  it("keeps the rolling number in days", () => {
    const { merged } = setup({ scheduleMode: "rolling" });
    fireEvent.change(numberBox(), { target: { value: "10" } });
    fireEvent.blur(numberBox());
    expect(merged().intervalDays).toBe(10);
  });

  it("keeps the unit out of the accessible name of the box", () => {
    // The "week(s)" suffix is aria-hidden, so the accessible name is the only
    // place a screen reader can learn what the number means.
    setup({ scheduleMode: "grid" });
    expect(numberBox()).toHaveAccessibleName(
      "How many weeks between your shots",
    );
  });
});

describe("CadencePicker — the sentence", () => {
  it("says the schedule back on the weekly rhythm", () => {
    setup({ scheduleMode: "grid", shotDays: ["monday", "thursday"], intervalDays: 14 });
    expect(screen.getByText("Mon & Thu, every other week.")).toBeInTheDocument();
  });

  it("names a single day in full, not abbreviated", () => {
    // "Tues" and "Mons" are what abbreviating one day produces.
    setup({ scheduleMode: "grid", shotDays: ["tuesday"], intervalDays: 7 });
    expect(screen.getByText("Tuesdays, every week.")).toBeInTheDocument();
  });

  it.each([
    ["rolling", { scheduleMode: "rolling" as const, intervalDays: 10 }],
    ["none", { scheduleMode: "none" as const }],
  ])("says nothing on the %s rhythm", (_name, profile) => {
    // They already say themselves; echoing them spends the app's success colour
    // on a non-event. Asserted on the element, not on text, so it fails if the
    // summary is rendered at all rather than only if the words change.
    setup(profile);
    expect(document.querySelector(".cadence__summary")).toBeNull();
  });

  it("asks for a day when the rhythm is chosen but no day is", () => {
    setup({ scheduleMode: "grid", intervalDays: 7 });
    expect(screen.getByText(/Pick at least one day/)).toBeInTheDocument();
  });
});

describe("CadencePicker — an unusable number is refused OUT LOUD", () => {
  // This used to put the saved value back and say nothing, so the field
  // appeared to reject your typing for no reason. The roadmap deferred the
  // message until weekday sets existed, because a 3.5 had nowhere to be sent.
  const cases: [string, RegExp][] = [
    ["0", /at least 1 day apart/],
    ["-3", /at least 1 day apart/],
    ["3.5", /Whole days only/],
    ["400", /longer than a year/],
    ["", /Enter how many days/],
  ];
  it.each(cases)("says why for %s", (typed, message) => {
    setup({ scheduleMode: "rolling", intervalDays: 10 });
    fireEvent.change(numberBox(), { target: { value: typed } });
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(numberBox()).toHaveAttribute("aria-invalid", "true");
  });

  it("points a 3.5 at the rhythm that can express it", () => {
    // The reason the copy is writable now and was not before.
    setup({ scheduleMode: "rolling", intervalDays: 10 });
    fireEvent.change(numberBox(), { target: { value: "3.5" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/pick two/);
  });

  it("does not store it", () => {
    const { onChange } = setup({ scheduleMode: "rolling", intervalDays: 10 });
    onChange.mockClear();
    fireEvent.change(numberBox(), { target: { value: "0" } });
    fireEvent.blur(numberBox());
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("CadencePicker — leaving without blurring", () => {
  it("commits a typed interval when the control goes away", () => {
    // On a phone you can type a cadence and switch apps without ever blurring,
    // and silent loss is the failure this app treats as severe.
    const { merged, remove } = setup({ scheduleMode: "rolling" });
    fireEvent.change(numberBox(), { target: { value: "10" } });
    remove();
    expect(merged().intervalDays).toBe(10);
  });

  it("does NOT wipe the cadence when the box holds garbage", () => {
    // A number input reports "" for unparseable text as well as for empty —
    // "-", "1e" and "1.2.3" all sanitize to "" — so assuming an empty box was a
    // deliberate clear read a fumbled keystroke as one and deleted the cadence
    // AND the frozen anchor with it.
    const { onChange, remove } = setup({
      scheduleMode: "rolling",
      intervalDays: 14,
    });
    const box = numberBox();
    Object.defineProperty(box, "validity", {
      configurable: true,
      value: { badInput: true },
    });
    fireEvent.change(box, { target: { value: "" } });
    onChange.mockClear();
    remove();
    expect(onChange).not.toHaveBeenCalled();
  });
});
