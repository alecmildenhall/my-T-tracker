import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CadencePicker } from "../CadencePicker";
import {
  ProfileProvider,
  useProfileContext,
} from "../../context/ProfileContext";
import type { Profile } from "../../types/profile";

// This file now renders a real ProfileProvider, so it touches storage — and a
// profile left behind by one test was read by the next, which is why a test
// that passed alone failed inside the file.
beforeEach(() => localStorage.clear());

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

  it("paints the chip that matches the stored cadence", () => {
    // `.chip--active` is the only rule that paints a selected chip; there is no
    // [aria-current] selector. Setting the attribute alone left a weekly user
    // seeing neither chip lit, and a browser check that read the attribute
    // rather than the class passed it.
    setup({ scheduleMode: "grid", shotDays: ["monday"], intervalDays: 7 });
    const weekly = screen.getByRole("button", { name: "Weekly" });
    expect(weekly).toHaveClass("chip--active");
    expect(screen.getByRole("button", { name: "Every 2 weeks" })).not.toHaveClass(
      "chip--active",
    );
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

  it("asks for the days when the rolling rhythm has no number", () => {
    // The grid half warned about exactly this and the rolling half did not:
    // "Every so many days" with an empty box stores `scheduleMode: "rolling"`
    // and no `intervalDays`, so nothing ever gets a planned date, in silence.
    setup({ scheduleMode: "rolling" });
    expect(screen.getByText(/Add how many days/)).toBeInTheDocument();
  });

  it("asks for the weeks when the days are chosen but the number is not", () => {
    // The mirror, and it was missing: days with no interval stores
    // `scheduleMode: "grid"` and no `intervalDays`, so `effectiveScheduleMode`
    // returns "none" and NO shot ever gets a planned date — silently, since an
    // untouched box raises no error. The panel this replaced had this notice
    // and it was lost in the move.
    setup({ scheduleMode: "grid", shotDays: ["monday"] });
    expect(screen.getByText(/Add how many weeks/)).toBeInTheDocument();
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

  it("says nothing about a field nobody has touched", () => {
    // Selecting a rhythm reveals an empty box. Announcing "Enter how many..."
    // on it instantly puts role="alert" and aria-invalid on a pristine field —
    // reporting a failure for not having answered yet. The empty branch is a
    // prompt, not a validation result.
    setup({ scheduleMode: "rolling" });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(numberBox()).not.toHaveAttribute("aria-invalid", "true");
  });

  it("does not carry an error into a freshly revealed box", () => {
    // `touched` was never reset on a rhythm change, so erring in one box and
    // switching greeted you with "Enter how many weeks" on a field you had
    // never seen — exactly what that flag exists to prevent.
    setup({ scheduleMode: "rolling", intervalDays: 10 });
    fireEvent.change(numberBox(), { target: { value: "0" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(mode(/On certain days/));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(numberBox()).not.toHaveAttribute("aria-invalid", "true");
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

describe("CadencePicker — following the profile from elsewhere", () => {
  const Host = ({ profile, onChange }: { profile: Partial<Profile>; onChange: () => void }) => (
    <CadencePicker idPrefix="t" profile={profile} onChange={onChange} />
  );

  it("shows a cadence that arrived from outside", () => {
    // `useLocalStorage` subscribes to cross-tab storage events, and restoring a
    // backup replaces the whole profile — from a panel on this very screen.
    const view = render(
      <Host profile={{ scheduleMode: "rolling", intervalDays: 14 }} onChange={vi.fn()} />,
    );
    view.rerender(
      <Host profile={{ scheduleMode: "rolling", intervalDays: 10 }} onChange={vi.fn()} />,
    );
    expect(numberBox().value).toBe("10");
  });

  it("re-reads the number when only the RHYTHM changes", () => {
    // `draftFor` is unit-dependent: storage is always days, the box shows weeks
    // in the grid rhythm. Following only `intervalDays` left the old number
    // under the new unit — a restore of {rolling, 14} as {grid, 14} showed "14"
    // beside "weeks" and summarised "every 14 weeks" for a fortnightly cadence,
    // then committed 98 over the restored backup on unmount.
    const view = render(
      <Host profile={{ scheduleMode: "rolling", intervalDays: 14 }} onChange={vi.fn()} />,
    );
    view.rerender(
      <Host
        profile={{ scheduleMode: "grid", shotDays: ["monday"], intervalDays: 14 }}
        onChange={vi.fn()}
      />,
    );
    expect(numberBox().value).toBe("2");
    expect(screen.getByText("Mondays, every other week.")).toBeInTheDocument();
  });

  it("does not write the stale value back over it on the way out", () => {
    // The half that loses data: the unmount commit compared its own stale draft
    // against the restored profile, wrote the old number back, and cleared the
    // anchor that had just been restored with it.
    const onChange = vi.fn();
    const view = render(
      <Host profile={{ scheduleMode: "rolling", intervalDays: 14 }} onChange={onChange} />,
    );
    view.rerender(
      <Host profile={{ scheduleMode: "rolling", intervalDays: 10 }} onChange={onChange} />,
    );
    onChange.mockClear();
    view.unmount();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not nag about a box an external change emptied", () => {
    // Restoring {grid, 10} cannot be shown in weeks, so the box empties — and
    // with `touched` left true an alert announced "Enter how many weeks" about
    // a field this person never typed in.
    const view = render(
      <Host profile={{ scheduleMode: "rolling", intervalDays: 3 }} onChange={vi.fn()} />,
    );
    fireEvent.change(numberBox(), { target: { value: "9" } });
    view.rerender(
      <Host
        profile={{ scheduleMode: "grid", shotDays: ["monday"], intervalDays: 10 }}
        onChange={vi.fn()}
      />,
    );
    expect(numberBox().value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("follows a changed rhythm and day set too", () => {
    const view = render(
      <Host profile={{ scheduleMode: "rolling", intervalDays: 10 }} onChange={vi.fn()} />,
    );
    view.rerender(
      <Host
        profile={{ scheduleMode: "grid", shotDays: ["monday", "thursday"], intervalDays: 7 }}
        onChange={vi.fn()}
      />,
    );
    expect((mode(/On certain days/) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("Mon & Thu, every week.")).toBeInTheDocument();
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


/**
 * Against the REAL store, not the merging harness above.
 *
 * The harness merges patches with `{...prev, ...patch}`, which preserves array
 * identity — and the store does not, because `normalizeKnownFields` rebuilds
 * `shotDays` on every write. A reference check therefore passed every test here
 * and lost typed input in the app. A stand-in that differs from the real thing
 * in the dimension the code depends on is the proxy shape this project keeps
 * paying for, so these go through the provider.
 */
describe("CadencePicker — against the real profile store", () => {
  const Real = () => {
    const { profile, setSchedule } = useProfileContext();
    return <CadencePicker idPrefix="t" profile={profile} onChange={setSchedule} />;
  };
  const renderReal = () =>
    render(
      <ProfileProvider>
        <Real />
      </ProfileProvider>,
    );

  it("keeps a typed interval when an unrelated part of the profile is written", () => {
    // On iOS this is the ordinary path: Safari does not focus a <button> on
    // tap, so tapping a day fires no blur and the typed number is uncommitted.
    renderReal();
    fireEvent.click(screen.getByRole("radio", { name: /On certain days/ }));
    const box = () => screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(box(), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Monday" }));

    expect(box().value).toBe("2");
  });

  it("still follows a day set genuinely changed from outside", () => {
    // The mirror, so the fix above cannot be "never re-sync": rebuilt-but-equal
    // must be ignored while actually-different must still come through.
    renderReal();
    fireEvent.click(screen.getByRole("radio", { name: /On certain days/ }));
    fireEvent.click(screen.getByRole("button", { name: "Monday" }));
    expect(
      screen.getByRole("button", { name: "Monday" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
