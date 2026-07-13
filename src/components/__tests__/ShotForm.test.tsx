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

  it("saves the chosen values and clears optional fields after adding", () => {
    const onAddShot = vi.fn();
    render(<ShotForm onAddShot={onAddShot} shots={history} />);

    fireEvent.click(screen.getByRole("button", { name: "cypionate" }));
    fireEvent.click(screen.getByRole("button", { name: "cottonseed" }));
    fireEvent.click(screen.getByRole("button", { name: "Save shot" }));

    expect(onAddShot).toHaveBeenCalledTimes(1);
    const saved = onAddShot.mock.calls[0][0] as ShotEntry;
    expect(saved.testosteroneEster).toBe("cypionate");
    expect(saved.carrierOil).toBe("cottonseed");

    // optional fields reset so the next shot starts clean
    expect(esterInput().value).toBe("");
    expect(oilInput().value).toBe("");
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
