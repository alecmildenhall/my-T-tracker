// A dialog opened from inside another one — the shape slice B½'s soreness card
// needs, and the one `Modal` did not compose for.
//
// Every assertion here was measured against the broken build first. The focus
// half already worked (`useFocusTrap`'s registry); everything else `Modal` did
// on open was per-instance and unconditional, so the INNER dialog's close tore
// down modality the OUTER one still needed.
//
// WHAT jsdom CANNOT SEE, and why these are still worth having: jsdom implements
// no layout, no CSS and no `inert` BEHAVIOUR — an inert subtree is still
// focusable and still clickable here. So these pin where the attribute is,
// which is the thing that was wrong; that the attribute then does its job is a
// browser fact, checked with Playwright. A test asserting "the button beneath
// cannot be clicked" would pass vacuously in jsdom for the wrong reason.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { Modal } from "../Modal";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useRef } from "react";

/** A faithful-enough session history: Back pops, then notifies with the new top. */
const stack: unknown[] = [null];
let pushSpy: ReturnType<typeof vi.spyOn>;
let backSpy: ReturnType<typeof vi.spyOn>;
let goSpy: ReturnType<typeof vi.spyOn>;

const popOne = () => {
  if (stack.length > 1) stack.pop();
  const top = stack[stack.length - 1] ?? null;
  window.history.replaceState(top, "");
  window.dispatchEvent(new PopStateEvent("popstate", { state: top }));
};

/** The system Back gesture. */
const pressBack = () => act(() => popOne());

/** Let the hook's deferred "remove our entry" task run. */
const flushPendingPop = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

beforeEach(async () => {
  localStorage.clear();
  // Spies FIRST, and the reset before the drain — not after. The module keeps a
  // deferred reconciliation, so the previous test's unmount can still have one
  // pending here; draining it against a restored `window.history.go` sent a
  // real jsdom traversal that this fake stack never saw, and the two desynced
  // for the rest of the file. Resetting first means the drained reconciliation
  // finds nothing to do.
  const realPush = window.history.pushState.bind(window.history);
  pushSpy = vi
    .spyOn(window.history, "pushState")
    .mockImplementation((state, title, url) => {
      stack.push(state);
      realPush(state, title, url);
    });
  backSpy = vi.spyOn(window.history, "back").mockImplementation(popOne);
  // The reconciliation traverses with go(-n) — one call for however many
  // entries were left behind — so the fake session history has to honour a
  // multi-step traversal, not just a single pop.
  goSpy = vi.spyOn(window.history, "go").mockImplementation((delta?: number) => {
    for (let i = 0; i < Math.abs(delta ?? 0); i++) popOne();
  });

  stack.length = 0;
  stack.push(null);
  window.history.replaceState(null, "");
  await flushPendingPop();
  stack.length = 0;
  stack.push(null);
  window.history.replaceState(null, "");
  document.body.style.overflow = "";
});

afterEach(async () => {
  // Drain while the spies are still in place, so nothing escapes to real jsdom.
  await flushPendingPop();
  pushSpy.mockRestore();
  backSpy.mockRestore();
  goSpy.mockRestore();
});

const rootInert = () =>
  document.getElementById("root")?.hasAttribute("inert") ?? false;

/**
 * The overlay around it, which is what actually goes inert — `role="dialog"`
 * and `aria-modal="true"` live here, so inerting the inner element alone left
 * a second modal dialog exposed to assistive tech.
 */
const overlayOf = (name: string) =>
  screen.getByRole("heading", { name }).closest(".dialog-overlay") as HTMLElement;

/**
 * An outer sheet that can open an inner confirm — the exact pairing B½ needs.
 * Real Modals, both portalled to <body> as siblings, because a hand-rolled
 * nested harness cannot reproduce the shape that ships.
 */
const Stacked = ({
  onOuterClose = vi.fn(),
  onInnerClose,
}: {
  onOuterClose?: () => void;
  onInnerClose?: () => void;
}) => {
  const [outer, setOuter] = useState(true);
  const [inner, setInner] = useState(false);
  return (
    <div id="root">
      <button type="button">Tab bar</button>
      {outer && (
        <Modal
          labelledBy="outer-t"
          variant="sheet"
          onClose={() => {
            setOuter(false);
            onOuterClose();
          }}
        >
          <h2 id="outer-t">Outer</h2>
          <button type="button" onClick={() => setInner(true)}>
            Open inner
          </button>
          <button type="button">Save</button>
        </Modal>
      )}
      {inner && (
        <Modal
          labelledBy="inner-t"
          onClose={() => {
            setInner(false);
            onInnerClose?.();
          }}
        >
          <h2 id="inner-t">Inner</h2>
          <button type="button">Delete</button>
        </Modal>
      )}
    </div>
  );
};

const openInner = () =>
  fireEvent.click(screen.getByRole("button", { name: "Open inner" }));

/**
 * The confirm rendered INSIDE the sheet's subtree, with one action closing
 * BOTH — "delete this and put the sheet away", which is what a destructive
 * confirm opened from a sheet is for.
 *
 * `Stacked` above cannot see what this catches, and the reason is worth
 * keeping: it renders the two Modals as siblings and closes them one at a
 * time. Every ordering hazard here needs a single commit that unmounts both,
 * and React runs the OUTER cleanup first — the mirror of the mounting rule
 * that a child's effects run first, and the one that is easy to assume holds
 * in both directions. It does not.
 */
const NestedPair = ({ onGone = () => {} }: { onGone?: () => void }) => {
  const [sheet, setSheet] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const close = () => {
    setSheet(false);
    onGone();
  };
  if (!sheet) return <div id="root" />;
  return (
    <div id="root">
      <Modal labelledBy="np-o" variant="sheet" onClose={close}>
        <h2 id="np-o">Sheet</h2>
        <button type="button" onClick={() => setConfirm(true)}>
          Open confirm
        </button>
        {confirm && (
          <Modal labelledBy="np-i" onClose={() => setConfirm(false)}>
            <h2 id="np-i">Confirm</h2>
            <button type="button" onClick={close}>
              Delete and close both
            </button>
          </Modal>
        )}
      </Modal>
    </div>
  );
};

/** A dialog that is asked to traverse but whose traversal never reports back. */
const silenceNextTraversal = () => {
  goSpy.mockImplementationOnce(() => {});
};

const openConfirm = () =>
  fireEvent.click(screen.getByRole("button", { name: "Open confirm" }));
const closeBoth = () =>
  fireEvent.click(screen.getByRole("button", { name: "Delete and close both" }));

describe("a dialog opened from inside another one", () => {
  it("keeps #root inert until the LAST dialog closes", () => {
    // Measured on the broken build: present with the outer open, present with
    // both, and GONE once the inner closed — leaving the tab bar and the shot
    // list clickable and screen-reader-reachable under a still-open sheet.
    render(<Stacked />);
    expect(rootInert()).toBe(true);

    openInner();
    expect(rootInert()).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("heading", { name: "Inner" })).toBeNull();
    expect(rootInert()).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("heading", { name: "Outer" })).toBeNull();
    expect(rootInert()).toBe(false);
  });

  it("makes the dialog underneath inert, and live again when uncovered", () => {
    // `#root` alone was never enough: dialogs portal to <body>, OUTSIDE the root
    // they inert, so the outer sheet's own Save button stayed clickable behind
    // the confirm.
    render(<Stacked />);
    expect(overlayOf("Outer").hasAttribute("inert")).toBe(false);

    openInner();
    expect(overlayOf("Outer").hasAttribute("inert")).toBe(true);
    // ...and never the topmost one, which would disable the dialog you are in.
    expect(overlayOf("Inner").hasAttribute("inert")).toBe(false);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(overlayOf("Outer").hasAttribute("inert")).toBe(false);
  });

  it("un-inerts the dialog beneath BEFORE restoring focus into it", () => {
    // The ordering this depends on: the inner's modality re-derivation has to
    // run before its focus restore, or focus is handed back into a subtree that
    // is still inert and `handOffFocus` finds nowhere to land. Layout cleanups
    // run during the commit and passive ones after, so the un-inerting is
    // already done by the time the restore happens — a property of the phase
    // rather than of statement order.
    //
    // Asserted as the ORDER OF CALLS, not as "focus arrived". The obvious
    // version of this test — restore focus, then check the opener has it —
    // passes in jsdom no matter what, because jsdom ignores inert's behaviour
    // and will happily focus an inert element. Measured: moving the
    // re-derivation to after the restore left that version fully green. The
    // call order is the invariant jsdom can actually see; that an inert subtree
    // then refuses focus is a browser fact, checked with Playwright.
    render(<Stacked />);
    const opener = screen.getByRole("button", { name: "Open inner" });
    opener.focus();
    openInner();

    const outer = overlayOf("Outer");
    const calls: string[] = [];
    // Spies call through: swallowing focus() would leave activeElement on
    // <body> and change what is being measured.
    const realRemove = outer.removeAttribute.bind(outer);
    const outerSpy = vi
      .spyOn(outer, "removeAttribute")
      .mockImplementation((name: string) => {
        if (name === "inert") calls.push("inert-lifted");
        realRemove(name);
      });
    const realFocus = opener.focus.bind(opener);
    const focusSpy = vi.spyOn(opener, "focus").mockImplementation(() => {
      calls.push("focus-restored");
      realFocus();
    });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(calls).toContain("inert-lifted");
    expect(calls).toContain("focus-restored");
    expect(calls.indexOf("inert-lifted")).toBeLessThan(
      calls.indexOf("focus-restored"),
    );
    expect(opener).toHaveFocus();
    // Just these two. `vi.restoreAllMocks()` here would also put the real
    // `history.go` back, and this test leaves a reconciliation pending — so
    // `afterEach`'s drain would send an asynchronous jsdom traversal the fake
    // stack never sees, which is precisely what `beforeEach` exists to prevent.
    outerSpy.mockRestore();
    focusSpy.mockRestore();
  });

  it("keeps --sheet-h alive while the outer sheet is still open", () => {
    // As a per-Modal effect this had `#root`'s shape: the inner dialog's cleanup
    // removed the property, so an outer sheet lost its keyboard-aware height the
    // moment a confirm closed over it — putting the pinned Save button back
    // under the iOS keyboard.
    const listeners: Record<string, () => void> = {};
    const fakeViewport = {
      height: 800,
      addEventListener: (type: string, fn: () => void) => {
        listeners[type] = fn;
      },
      removeEventListener: () => {},
    };
    vi.stubGlobal("visualViewport", fakeViewport);
    const read = () =>
      document.documentElement.style.getPropertyValue("--sheet-h");

    render(<Stacked />);
    expect(read()).toBe("800px");

    openInner();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(read()).toBe("800px");

    // Still tracking, not merely holding a stale value.
    fakeViewport.height = 420;
    act(() => listeners.resize?.());
    expect(read()).toBe("420px");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(read()).toBe("");
    vi.unstubAllGlobals();
  });

  it("closes one dialog per Back press, innermost first", async () => {
    // The defect this replaces: `{ overlay: true }` was one flag every dialog
    // read as its own. The first Back landed on the outer's entry — still an
    // overlay — so BOTH handlers returned early and the confirm did not close;
    // the second landed on a non-overlay entry, so both fired and a single press
    // discarded the confirm AND the half-filled sheet, with no undo.
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();
    render(<Stacked onOuterClose={onOuterClose} onInnerClose={onInnerClose} />);
    openInner();

    await pressBack();
    expect(onInnerClose).toHaveBeenCalledOnce();
    expect(onOuterClose).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Outer" })).toBeInTheDocument();

    await pressBack();
    expect(onOuterClose).toHaveBeenCalledOnce();
    expect(onInnerClose).toHaveBeenCalledOnce();
  });

  it("does not eat the outer sheet's entry when Back closed the inner one", async () => {
    // Every close schedules a deferred traversal to drop the entry it owns,
    // because Escape/Cancel/saving all leave it on the stack. When BACK did the
    // closing the entry is already gone, and the old guard — "is the current
    // entry an overlay's?" — was true anyway, because the OUTER sheet's is. So
    // the inner's cleanup popped the sheet's entry too, and the sheet closed
    // behind it.
    //
    // It has to be Back, not Escape. After Escape the inner's own entry is still
    // the current one, so both the old guard and the new one pop exactly it and
    // agree — measured, and it is why the first version of this test passed
    // against the very bug it was written for.
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();
    render(<Stacked onOuterClose={onOuterClose} onInnerClose={onInnerClose} />);
    openInner();
    const depthWithBoth = stack.length;

    await pressBack();
    expect(onInnerClose).toHaveBeenCalledOnce();
    await flushPendingPop();

    // Back consumed one entry; the deferred cleanup must not take a second.
    expect(stack.length).toBe(depthWithBoth - 1);
    expect(onOuterClose).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Outer" })).toBeInTheDocument();

    // ...and the sheet still owns an entry, so Back still dismisses it rather
    // than leaving the app outright.
    await pressBack();
    expect(onOuterClose).toHaveBeenCalledOnce();
  });

  it("survives StrictMode's double mount without stacking entries", async () => {
    // StrictMode mounts, unmounts and remounts every effect, and the deferred
    // pop exists so the remount can adopt the first mount's entry rather than
    // pushing a second. Depth-matching is what keeps that right with a dialog
    // already open underneath: an inner confirm's pending pop must not be
    // adopted by an outer sheet claiming a different depth.
    const onOuterClose = vi.fn();
    render(
      <StrictMode>
        <Stacked onOuterClose={onOuterClose} />
      </StrictMode>
    );
    openInner();
    await flushPendingPop();

    // One entry each, not two.
    expect(stack.length).toBe(3);

    await pressBack();
    expect(screen.queryByRole("heading", { name: "Inner" })).toBeNull();
    expect(onOuterClose).not.toHaveBeenCalled();
  });

  it("leaves no history entry behind when both close in one commit", async () => {
    // Each dialog used to schedule its own deferred "drop my entry" task in a
    // single module slot, so the second cleanup overwrote the first WITHOUT
    // cancelling its timer. Both ran, the orphan fired first and found the
    // deeper entry satisfying its own guard, and consumed that one instead.
    // Measured: two entries pushed, one popped, one stranded — permanently, so
    // a later Back press was silently swallowed and never recovered.
    render(<NestedPair />);
    openConfirm();
    expect(stack.length).toBe(3);

    closeBoth();
    await flushPendingPop();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(stack).toEqual([null]);
  });

  it("hands the page's scroll back when both close in one commit", async () => {
    // The scroll lock was the last piece still captured and restored per
    // instance, and it reads as safe because each dialog puts back exactly what
    // it found. It is safe only while dialogs close one at a time: the outer
    // captured "" and the inner captured "hidden", the OUTER cleanup ran first,
    // so "" went back before "hidden" did. The body was left locked with no
    // dialog open — and every later dialog then captured "hidden" and restored
    // "hidden", so the page never scrolled again.
    document.body.style.overflow = "";
    render(<NestedPair />);
    openConfirm();
    expect(document.body.style.overflow).toBe("hidden");

    closeBoth();
    await flushPendingPop();

    expect(document.body.style.overflow).toBe("");
  });

  it("takes the background dialog's modal role out of the tree with it", async () => {
    // role="dialog" and aria-modal="true" sit on the OVERLAY, so inerting only
    // the inner .dialog element left assistive tech seeing two modal dialogs at
    // once, with the background one first in document order — and that one's
    // aria-labelledby now pointed into an inert subtree, so it computed as an
    // UNNAMED modal dialog. Inerting the overlay takes the role with it.
    render(<NestedPair />);
    openConfirm();

    const overlays = [...document.querySelectorAll('[role="dialog"]')];
    expect(overlays).toHaveLength(2);
    const live = overlays.filter((o) => !o.hasAttribute("inert"));
    expect(live).toHaveLength(1);
    expect(live[0].getAttribute("aria-labelledby")).toBe("np-i");
  });

  it("keeps the sheet's own entry when a Back burst outruns React", async () => {
    // `popstate` can arrive faster than React unmounts. Two presses delivered
    // in one batch consume two entries while only one dialog has gone, and the
    // stack used to be left SHORT with no way back: reconciliation only ever
    // trimmed a surplus. Measured on that build — the sheet owned no entry, so
    // the next Back left the app with a half-filled form; then reopening the
    // confirm stamped a depth claiming entries that were not there, and
    // dismissing THAT confirm with Escape trimmed a surplus that did not exist
    // and closed the sheet on its own, discarding the draft with no undo.
    const onOuterClose = vi.fn();
    render(<NestedPair onGone={onOuterClose} />);
    openConfirm();
    expect(stack.length).toBe(3);

    // Both presses inside one act(), so React cannot unmount between them.
    await act(async () => {
      popOne();
      popOne();
    });
    await flushPendingPop();

    expect(screen.queryByRole("heading", { name: "Confirm" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Sheet" })).toBeInTheDocument();
    // The sheet still owns an entry, so Back still dismisses it rather than
    // leaving the app.
    expect(stack.length).toBe(2);
    expect(onOuterClose).not.toHaveBeenCalled();

    await pressBack();
    expect(onOuterClose).toHaveBeenCalledOnce();
  });

  it("does not close the sheet when a confirm reopened after a burst is dismissed", async () => {
    // The second half of the same defect, and the one that cost data: a depth
    // stamped from the overlay count rather than from the stack made a later
    // reconciliation trim an entry that was never pushed, and the sheet read
    // that traversal as its own dismissal.
    const onOuterClose = vi.fn();
    render(<NestedPair onGone={onOuterClose} />);
    openConfirm();
    await act(async () => {
      popOne();
      popOne();
    });
    await flushPendingPop();

    openConfirm();
    await flushPendingPop();
    fireEvent.keyDown(window, { key: "Escape" });
    await flushPendingPop();

    expect(screen.queryByRole("heading", { name: "Confirm" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Sheet" })).toBeInTheDocument();
    expect(onOuterClose).not.toHaveBeenCalled();
  });

  it("stamps a reopened dialog from the stack, not from the overlay count", async () => {
    // Same burst, but the confirm is reopened BEFORE the deferred
    // reconciliation has repaired the deficit — so at that moment there really
    // are fewer entries than open dialogs. Stamping the overlay count writes a
    // depth claiming entries that do not exist, and the next reconciliation
    // then trims a surplus that was never there.
    //
    // What this pins is the OUTCOME — the sheet survives a burst followed by a
    // reopen and a dismissal. It does not discriminate between stamping the
    // depth from the stack and stamping it from the overlay count: the deficit
    // repair keeps those two equal, so mutating the stamp leaves this green.
    // Measured, and said here so the pass is not read as covering more than it
    // does.
    const onOuterClose = vi.fn();
    render(<NestedPair onGone={onOuterClose} />);
    openConfirm();
    await act(async () => {
      popOne();
      popOne();
    });
    openConfirm();

    expect(window.history.state).toEqual({ overlay: true, depth: stack.length - 1 });

    await flushPendingPop();
    fireEvent.keyDown(window, { key: "Escape" });
    await flushPendingPop();
    expect(screen.getByRole("heading", { name: "Sheet" })).toBeInTheDocument();
    expect(onOuterClose).not.toHaveBeenCalled();
  });

  it("gives the page back when a non-Modal trap consumer is the last to leave", () => {
    // `useFocusTrap` is shared and its own comments say a bare consumer must be
    // supported. Registration lives there, but `syncModality` was called only
    // from `Modal` — so a bare element that registered while a dialog was open
    // and unregistered after it closed left NOBODY to recompute: `#root` inert,
    // the body scroll-locked and `--sheet-h` pinned, permanently, with nothing
    // on screen.
    //
    // Two things this test got wrong before it measured anything real, both
    // worth leaving written down. Dismissing the sheet with ESCAPE does not
    // work here: a bare consumer registering afterwards is later in the
    // document and therefore topmost, so it owns the keyboard and its no-op
    // `onEscape` swallows the key — correct behaviour, and it left the sheet
    // open. And `#root` has to OUTLIVE the dialog: rendering it inside the
    // unmounted tree meant the "is it still inert" question was really asking
    // whether the element still existed.
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);

    const Bare = () => {
      const ref = useRef<HTMLDivElement>(null);
      useFocusTrap(ref, { onEscape: () => {} });
      return <div ref={ref} />;
    };

    const sheet = render(
      <Modal labelledBy="lone" variant="sheet" onClose={vi.fn()}>
        <h2 id="lone">Lone</h2>
        <button type="button">Save</button>
      </Modal>,
    );
    expect(root.hasAttribute("inert")).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");

    const bare = render(<Bare />);
    sheet.unmount();
    // Still held, because something is still registered.
    expect(root.hasAttribute("inert")).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");

    bare.unmount();
    expect(root.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    root.remove();
  });

  it("strands at most one entry when a traversal never reports, and re-syncs", async () => {
    // `go()` is asynchronous and its `popstate` is what tells this code the
    // traversal landed. A traversal that never reports leaves the in-flight
    // marker high, so the next reconciliation subtracts it and under-traverses.
    //
    // Pinned as a BOUND rather than fixed. Clearing the marker on a timer would
    // trade this for the chance of clearing while a slow traversal is genuinely
    // still in flight — which over-traverses and closes a dialog nobody
    // dismissed, the failure this file has twice been fixed for. One absorbed
    // Back press is the cheaper side of that trade, and it does not
    // accumulate: the stack is back to zero after two ordinary cycles.
    const lone = (key: string) =>
      render(
        <div id="root">
          <Modal labelledBy={key} variant="sheet" onClose={vi.fn()}>
            <h2 id={key}>{key}</h2>
          </Modal>
        </div>,
      );

    const first = lone("one");
    silenceNextTraversal();
    first.unmount();
    await flushPendingPop();
    // One entry stranded — the traversal was asked for and never happened.
    expect(stack.length - 1).toBe(1);

    // It costs TWO ordinary cycles to re-sync, not one — the first re-claims
    // the stranded entry instead of clearing it, and only the second drains it.
    // Written out rather than looped-until-zero, because "it converges
    // eventually" is not a bound and the number is the whole point.
    const leftAfterCycle: number[] = [];
    for (const key of ["two", "three", "four", "five"]) {
      const next = lone(key);
      await flushPendingPop();
      next.unmount();
      await flushPendingPop();
      leftAfterCycle.push(stack.length - 1);
    }
    expect(leftAfterCycle).toEqual([1, 0, 0, 0]);
  });

  it("closes three dialogs deep, innermost first", async () => {
    // Everything else here stacks two. Three is what proves the modality is
    // derived rather than special-cased for a pair: exactly one dialog is ever
    // live, and each Back takes the innermost.
    const log: string[] = [];
    const Three = () => {
      const [a, setA] = useState(true);
      const [b, setB] = useState(false);
      const [c, setC] = useState(false);
      if (!a) return <div id="root" />;
      return (
        <div id="root">
          <Modal labelledBy="d-a" variant="sheet" onClose={() => { setA(false); log.push("A"); }}>
            <h2 id="d-a">A</h2>
            <button type="button" onClick={() => setB(true)}>open B</button>
            {b && (
              <Modal labelledBy="d-b" onClose={() => { setB(false); log.push("B"); }}>
                <h2 id="d-b">B</h2>
                <button type="button" onClick={() => setC(true)}>open C</button>
                {c && (
                  <Modal labelledBy="d-c" onClose={() => { setC(false); log.push("C"); }}>
                    <h2 id="d-c">C</h2>
                  </Modal>
                )}
              </Modal>
            )}
          </Modal>
        </div>
      );
    };
    const liveCount = () =>
      [...document.querySelectorAll('[role="dialog"]')].filter(
        (o) => !o.hasAttribute("inert"),
      ).length;

    render(<Three />);
    fireEvent.click(screen.getByRole("button", { name: "open B" }));
    fireEvent.click(screen.getByRole("button", { name: "open C" }));
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(3);
    expect(liveCount()).toBe(1);
    expect(stack.length - 1).toBe(3);

    await pressBack();
    expect(log).toEqual(["C"]);
    expect(liveCount()).toBe(1);
    await pressBack();
    expect(log).toEqual(["C", "B"]);
    expect(liveCount()).toBe(1);
    await pressBack();
    await flushPendingPop();

    expect(log).toEqual(["C", "B", "A"]);
    expect(rootInert()).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(stack.length - 1).toBe(0);
  });
});