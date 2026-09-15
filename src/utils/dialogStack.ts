// src/utils/dialogStack.ts
// The dialogs currently mounted, and the page-level modality that follows from
// there being any.
//
// This list used to live inside `useFocusTrap`, where it answered one question:
// which dialog owns the keyboard. Everything else `Modal` did on open — `inert`
// on `#root`, the `--sheet-h` viewport track — was per-instance and
// unconditional, so a dialog opened from inside another one did not compose:
// closing the inner one lifted `inert` off `#root` and dropped `--sheet-h`
// while the outer was still open, leaving the tab bar and the shot list
// clickable and screen-reader-reachable underneath it.
//
// The fix is not a refcount in `Modal`. A count kept there would be a second
// answer to "how many dialogs are open", free to disagree with the list that
// already knows — the overloaded-value failure this codebase has paid for
// twice, rebuilt one level up. So the list moved here and grew the rest of the
// question, and modality is DERIVED from it rather than applied and unapplied
// in pairs: `syncModality` recomputes the whole picture from the list every
// time it changes, so there is no accumulated state to fall out of step.

/**
 * Every dialog currently mounted. An unordered registry, deliberately.
 *
 * Only the topmost may act. Before this, two mounted Modals both listened on
 * the window: the outer one measured focus as "outside" — because it was
 * outside *its* dialog — and hauled it back out of the inner dialog, and both
 * closed on a single Escape.
 */
const mounted: HTMLElement[] = [];

/**
 * Is this dialog the one the keyboard belongs to right now?
 *
 * Asked of the DOM, not of the order things registered in. The first version of
 * this was a stack whose last entry was "topmost", and it was **backwards**:
 * React runs a child's effects before its parent's, so a dialog opened from
 * inside another one registers FIRST and the outer dialog ended up claiming the
 * keyboard. Escape closed the wrong dialog and the outer trap pulled focus out
 * of the inner one — the precise bug the stack was added to prevent, rebuilt
 * inside the fix.
 *
 * Document position answers it for both shapes this can take, without knowing
 * which shape it is looking at: real Modals portal to `<body>` and are
 * SIBLINGS, where later in the document is painted on top; a nested dialog is
 * contained by its parent, and containment reports as FOLLOWING too. So
 * "topmost" is simply "no other live dialog comes after me".
 */
export const isTopmostDialog = (dialog: HTMLElement | null): boolean =>
  dialog !== null &&
  // Registered, not merely non-null. `isTopmostDialog` otherwise asks only "is
  // any REGISTERED dialog after me", which an unregistered one passes
  // vacuously — and so does the registered dialog beneath it, since the
  // unregistered one is not in the list to be seen. Both would then trap, which
  // is the fight the registry exists to prevent, arrived at through a hole in
  // the registry. Failing closed means an unregistered dialog does not trap at
  // all, which is recoverable; two dialogs fighting over focus is not. Not
  // reachable through `Modal`, whose element always renders, but this is shared.
  mounted.includes(dialog) &&
  mounted.every(
    (other) =>
      other === dialog ||
      !other.isConnected ||
      !(
        dialog.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING
      ),
  );

/**
 * Is this dialog in the registry at all?
 *
 * Separate from `isTopmostDialog`, which fails closed on a non-member. Escape
 * must keep working for a dialog that never registered — a caller whose ref is
 * empty on the first commit would otherwise get no Tab containment AND no
 * keyboard dismissal, and `variant="sheet"` disables backdrop-click too (WCAG
 * 2.1.2). So the two questions are asked separately, on purpose.
 */
export const isRegisteredDialog = (dialog: HTMLElement): boolean =>
  mounted.includes(dialog);

/**
 * Join the stack. Returns the leave function, so a caller cannot register
 * without also holding the way out.
 *
 * Bookkeeping only — it deliberately does NOT apply modality. Registration
 * happens in a LAYOUT effect (see `useFocusTrap`), and `inert` on an ancestor
 * of the focused element blurs it, so applying it there would strand the opener
 * before `Modal`'s focus effect has read it. `Modal` calls `syncModality`
 * itself, at the moment it is ready for the page to go inert.
 */
export function registerDialog(dialog: HTMLElement): () => void {
  mounted.push(dialog);
  return () => {
    const at = mounted.indexOf(dialog);
    if (at !== -1) mounted.splice(at, 1);
    // Never leave a departing dialog inert: it may be the same element again on
    // a StrictMode remount, and an inert subtree contains nothing tabbable.
    // The BOUNDARY, which is what actually carries the attribute — removing it
    // from the dialog was a no-op for every shape that ships, so the guard
    // passed vacuously and would not have protected the case it was written
    // for. Still unreachable through `Modal`, whose overlay is discarded on
    // unmount, so this is correctness rather than a live fix and no test pins
    // it; the point is that it now does what its own comment says.
    boundaryOf(dialog).removeAttribute("inert");
    // Leaving is a change to the stack like any other. `Modal` calls this
    // itself on the path it owns, but `useFocusTrap` is shared: a non-Modal
    // consumer leaving last would otherwise strand `#root` inert, the scroll
    // lock taken and `--sheet-h` pinned, with no dialog open and nothing left
    // to recompute it.
    syncModality();
  };
}

/**
 * The element that carries modality for a dialog — its overlay where there is
 * one, and itself otherwise.
 *
 * The overlay, because `role="dialog"`, `aria-modal="true"` and
 * `aria-labelledby` all live there: inerting only the inner element left
 * assistive tech seeing TWO modal dialogs, the background one first in document
 * order and computing as UNNAMED, since its label had just gone inert.
 */
function boundaryOf(dialog: HTMLElement): HTMLElement {
  return dialog.parentElement ?? dialog;
}

/**
 * Recompute every piece of page-level modality from the list.
 *
 * Idempotent and total, which is the point: each call states the whole truth
 * rather than adjusting a running total, so no sequence of opens and closes can
 * leave it half-applied. Call it after anything joins or leaves the stack.
 */
export function syncModality(): void {
  const root = document.getElementById("root");
  if (mounted.length === 0) {
    root?.removeAttribute("inert");
    stopViewportTracking();
    releaseScrollLock();
  } else {
    // `aria-modal` is advisory and the Tab trap only intercepts Tab, so without
    // `inert` a screen-reader or voice-control user can still reach and
    // activate the tab bar rendered after the dialog — switching views
    // underneath an open sheet. `inert` blocks focus, clicks and AT access in
    // one attribute. Dialogs portal to <body>, outside `#root`, which is what
    // lets the root go inert without disabling the dialog itself.
    root?.setAttribute("inert", "");
    startViewportTracking();
    takeScrollLock();
  }

  // ...and a dialog with another one on top of it is background too. `#root`
  // alone left the outer sheet's own controls live behind a confirm, because
  // the sheet is portaled outside the root it was inerting.
  //
  // The OVERLAY, not the dialog inside it, and that distinction is the whole
  // point rather than a detail. `role="dialog"` and `aria-modal="true"` sit on
  // the overlay, so inerting only the inner element left assistive tech seeing
  // TWO modal dialogs with the background one first in document order — the
  // exact ambiguity `inert` is here to resolve — and that background dialog's
  // `aria-labelledby` now pointed into an inert subtree, so it computed as an
  // unnamed modal dialog. Inerting the overlay takes the role with it.
  //
  // Falling back to the dialog itself keeps this honest for a caller whose
  // markup is not Modal's: `useFocusTrap` is shared, and a bare registered
  // element has no overlay to inert.
  //
  // `inert` is INHERITED, so a boundary that contains the topmost dialog must
  // be left alone — marking it would take the live dialog down with it, and no
  // `removeAttribute` on the inner one can undo that. Not reachable through
  // `Modal`, where every dialog portals to <body> as a sibling, but
  // `isTopmostDialog` explicitly says it supports the contained shape too, and
  // two functions disagreeing about which shapes exist is how the gap opens.
  const top = mounted.find(isTopmostDialog) ?? null;
  for (const dialog of mounted) {
    const boundary = boundaryOf(dialog);
    if (dialog === top || (top !== null && boundary.contains(top))) {
      boundary.removeAttribute("inert");
    } else {
      boundary.setAttribute("inert", "");
    }
  }
}

/**
 * Hold the page still while any dialog is open, and hand it back intact.
 *
 * Derived from the stack like everything else here, and it did NOT used to be.
 * `Modal` captured and restored `document.body.style.overflow` per instance,
 * which reads as safe — each instance puts back exactly what it found — and it
 * is safe only while dialogs close one at a time. Measured with a confirm that
 * closes itself AND the sheet beneath it: the outer captured "" and the inner
 * captured "hidden", React ran the OUTER cleanup first, so "" went back before
 * "hidden" did and the body was left scroll-locked with no dialog open. Every
 * later dialog then captured "hidden" and restored "hidden", so the page never
 * scrolled again for the rest of the session.
 *
 * One capture for the whole stack has no ordering to get wrong.
 */
let lockedFrom: string | null = null;

function takeScrollLock(): void {
  if (lockedFrom !== null) return;
  lockedFrom = document.body.style.overflow;
  document.body.style.overflow = "hidden";
}

function releaseScrollLock(): void {
  if (lockedFrom === null) return;
  document.body.style.overflow = lockedFrom;
  lockedFrom = null;
}

/**
 * Track the *visual* viewport while any dialog is open, exposed as `--sheet-h`.
 *
 * iOS Safari does not shrink the layout viewport when the on-screen keyboard
 * opens, so a `height: 100%` sheet keeps its full height and the keyboard
 * covers the bottom — which is the pinned Save button, the one thing the
 * three-region layout exists to keep reachable. `visualViewport.height` is the
 * space actually visible, so sizing to it lifts the bar above the keyboard.
 * Android resizes the layout viewport itself, where this is a no-op.
 *
 * Height only, deliberately: the overlay is `position: fixed; inset: 0` and
 * body scroll is locked, so `offsetTop` stays ~0 and reading it would add
 * jitter for no gain. NOTE: verified in Chrome and by unit test, but not yet on
 * real iOS hardware — see the mobile checklist in README.
 *
 * One listener for the whole stack rather than one per dialog. As a per-Modal
 * effect, the inner dialog's cleanup removed the property while the outer sheet
 * was still open, so an outer sheet lost its keyboard-aware height the moment a
 * confirm closed over it.
 */
let viewportCleanup: (() => void) | null = null;

function startViewportTracking(): void {
  if (viewportCleanup) return;
  const vv = window.visualViewport;
  // Left null so a later call retries rather than latching "tracked" — the
  // property is absent in jsdom and in older engines.
  if (!vv) return;
  const apply = () =>
    document.documentElement.style.setProperty("--sheet-h", `${vv.height}px`);
  apply();
  vv.addEventListener("resize", apply);
  viewportCleanup = () => {
    vv.removeEventListener("resize", apply);
    document.documentElement.style.removeProperty("--sheet-h");
  };
}

function stopViewportTracking(): void {
  viewportCleanup?.();
  viewportCleanup = null;
}
