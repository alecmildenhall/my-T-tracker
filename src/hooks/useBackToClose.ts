// src/hooks/useBackToClose.ts
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { isRegisteredDialog, isTopmostDialog } from "../utils/dialogStack";

/**
 * The throwaway history entry an open overlay owns, tagged with WHICH overlay.
 *
 * `{ overlay: true }` alone was the defect, not the handler reading it. Every
 * dialog asked the same boolean the same way — "is there still an overlay
 * entry?" — when the question each needs answered is "was the entry that just
 * went away MINE?". One shared flag cannot tell them apart, and it was wrong in
 * both directions with two dialogs open: popping the inner entry lands on the
 * outer's, which IS an overlay, so both handlers returned early and the confirm
 * did not close; popping the outer's lands on a non-overlay entry, so both
 * handlers fired and a single Back discarded the confirm AND the half-filled
 * sheet beneath it, with no undo.
 *
 * Depth is that missing identity — one value, one meaning. A dialog acts only
 * when the current entry's depth has fallen below its own, which is true for
 * exactly the dialog whose entry was removed. It is read back from
 * `history.state` rather than computed: the history stack is the fact, and the
 * counter below is only this module's belief about it.
 */
const overlayState = (depth: number) => ({ overlay: true, depth });

/**
 * Does the current entry carry an overlay marker of ANY shape?
 *
 * Deliberately broader than `currentOverlayDepth`, and the two are not
 * interchangeable. A marker surviving a reload or a restored tab was written by
 * a previous life of the page — possibly by a build from before entries carried
 * a depth — and the whole job of `clearStaleOverlayEntry` is to recognise it.
 * Asking the depth question there stopped it recognising the untagged shape,
 * which left the stale marker in place and ate a later Back press.
 */
function hasOverlayMarker(): boolean {
  const state: unknown = window.history.state;
  return (
    typeof state === "object" &&
    state !== null &&
    (state as { overlay?: unknown }).overlay === true
  );
}

/**
 * Depth of the entry the current state holds, or 0 for anything else.
 *
 * An untagged marker reads as 0 on purpose: it cannot be one of ours, since the
 * current one is cleared at startup and anything deeper belongs to a previous
 * life of the page. Landing on it means Back has left our dialogs behind, which
 * is precisely when the topmost should close.
 */
function currentOverlayDepth(): number {
  const state: unknown = window.history.state;
  if (typeof state !== "object" || state === null) return 0;
  const { overlay, depth } = state as { overlay?: unknown; depth?: unknown };
  return overlay === true && typeof depth === "number" ? depth : 0;
}

/**
 * Drop an overlay *marker* left over from a previous life of the page.
 *
 * `history.state` survives a reload, and mobile browsers routinely discard and
 * restore a backgrounded tab. If an overlay was open at that moment the app
 * comes back with it CLOSED but the marker still on the current entry, where it
 * would make the hook's guard mistake a later real Back press for a stale
 * traversal and decline to close.
 *
 * Note what this can and cannot do: the entry itself is not removable (there is
 * no history API for that), so a Back press from that restored entry is still
 * absorbed navigating within the app. Clearing the marker prevents the *wrong
 * behaviour* — an overlay refusing to close — not the extra entry. Call once at
 * startup, before any overlay can mount.
 */
export function clearStaleOverlayEntry(): void {
  if (hasOverlayMarker()) window.history.replaceState(null, "");
}

/**
 * Makes the device's system Back gesture dismiss this overlay instead of leaving
 * the app. Called by `Modal`, so every dialog gets it and no caller can forget.
 *
 * On Android, Back is a hardware button / edge swipe that fires regardless of
 * what the page wants, and its default is to navigate away from the app
 * entirely. Dismissing the topmost overlay is the near-universal expectation
 * there (in native Android a dialog is back-dismissible for free), so we push one
 * throwaway history entry while the overlay is mounted and close on `popstate`
 * when Back pops it.
 *
 * Deliberately scoped to overlays. Tab switching pushes nothing, so Back from
 * History or Settings still exits the app — tabs are how you move between
 * destinations, and this hook is about not stranding the user mid-dialog, not
 * about rebuilding navigation. No URLs and no router are involved; real
 * history/deep-link routing stays a PWA-phase decision this doesn't pre-empt.
 */
/**
 * A pending "remove our history entry" that has been scheduled but not yet run.
 * Module-level because it must survive the component unmounting: the whole point
 * is that a *new* overlay mounting can cancel it.
 *
 * Deferring the pop by a task, and cancelling it if another overlay opens first,
 * is what makes this safe under React StrictMode — which mounts, unmounts, and
 * remounts every effect in development. Popping synchronously in cleanup would
 * race StrictMode's immediate remount and land on a non-overlay entry, closing
 * the dialog the instant it opened.
 */
/**
 * How many overlays are mounted and therefore own an entry between them.
 *
 * Counted up and down rather than assigned, which is what makes it immune to
 * the order cleanups run in — and that order is not the one you would guess:
 * React runs an unmounting PARENT's cleanup before its child's, the mirror of
 * the mounting rule everyone remembers, and the opposite of what an earlier
 * draft of this file asserted in a comment.
 *
 * Counted here rather than read from the dialog registry, because this hook
 * stands on its own: an overlay that never registers a focus trap still owns a
 * history entry, and a denominator of zero would mean it never pushed one.
 */
let owners = 0;

/**
 * A scheduled reconciliation of the history stack against those owners.
 *
 * ONE for the whole module, and it replaced a per-dialog `setTimeout` that
 * owned "remove my entry". A single slot could hold only one of those, so when
 * a confirm closed itself and the sheet beneath it in the same commit, the
 * outer's pop was installed first and the inner's overwrote the slot WITHOUT
 * cancelling the outer's timer. Both ran: the orphan fired first, found the
 * inner's deeper entry satisfying its guard, and consumed that instead —
 * stranding an entry on the history stack for the rest of the session and
 * silently eating a later Back press.
 *
 * The invariant is simply **one overlay entry per mounted overlay**. Stating it
 * that way is what makes the ordering irrelevant.
 */
let reconciliation: ReturnType<typeof setTimeout> | null = null;

/**
 * Entries we have asked the browser to drop, which it has not dropped yet.
 *
 * `history.go()` is ASYNCHRONOUS — it queues a traversal and the `popstate`
 * lands later — so between asking and it happening there is a window where the
 * stack still shows entries that are on their way out. An overlay mounting in
 * that window must not CLAIM one of them, or the traversal arrives moments
 * later and removes the entry the new dialog is relying on, which the dialog
 * then reads as its own dismissal. Measured: reopening the log sheet after one
 * vanished mid-animation closed the replacement a few hundred ms after it
 * opened.
 *
 * Read when deciding whether to claim an entry AND when measuring how far to
 * traverse — never when deciding whether to close, which is the property that
 * keeps a stale value cheap. It is cleared by the traversal's own `popstate`;
 * a traversal that never reports would leave it high and make later
 * reconciliations under-traverse, so the deficit repair below is what stops
 * that from rotting rather than an assumption that it cannot happen.
 */
let traversing = 0;
let watchingTraversals = false;

/** Notice when a traversal we asked for has actually landed. */
function watchTraversals(): void {
  if (watchingTraversals) return;
  watchingTraversals = true;
  // Registered before any overlay's own listener, so this runs first — and
  // nothing downstream reads `traversing`, so there is no ordering to get
  // wrong. One `popstate` per traversal however many entries it spanned, which
  // is what browsers deliver and why this clears rather than decrements.
  window.addEventListener("popstate", () => {
    traversing = 0;
  });
}

function scheduleReconciliation(): void {
  // Deferred, not immediate, so a StrictMode remount — or a sheet reopened
  // while the last one is still playing its exit — can claim the entry that is
  // already there instead of pushing a second.
  if (reconciliation !== null) return;
  reconciliation = setTimeout(() => {
    reconciliation = null;
    // Closing by any route other than Back leaves entries behind. Drop exactly
    // the surplus, in one traversal, however many dialogs went at once.
    const drift = currentOverlayDepth() - owners - traversing;
    if (drift > 0) {
      // Too many: entries left behind by closes that were not Back presses.
      traversing += drift;
      window.history.go(-drift);
    } else if (drift < 0) {
      // Too FEW, which an earlier version could not repair and so let rot.
      // `popstate` can outrun React: two Back presses delivered before the
      // first one's dialog has unmounted consume two entries and close one
      // dialog, leaving a dialog that owns nothing. Measured — the sheet then
      // had no entry, so the next Back left the app with a half-filled form,
      // and the deficit was permanent: the next push stamped a depth that
      // overstated the real entry count, and dismissing THAT dialog with
      // Escape reconciled a surplus that did not exist and closed the sheet on
      // its own, discarding the draft with no undo.
      //
      // Repaired by pushing the missing entries, so the stack and the open
      // dialogs converge however far apart an event burst drove them.
      for (let i = drift; i < 0; i += 1) {
        window.history.pushState(overlayState(currentOverlayDepth() + 1), "");
      }
    }
  }, 0);
}

export function useBackToClose(
  onClose: () => void,
  /** The dialog element, so Back can tell whether it is the topmost one. */
  dialogRef?: RefObject<HTMLElement | null>,
): void {
  // Hold the latest onClose so the listener subscribes once per mount, rather
  // than re-subscribing whenever the caller passes a fresh closure.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    // One entry per mounted overlay. An entry may already be sitting there to
    // claim rather than stack a second on top of — a StrictMode remount, or a
    // sheet reopened while the previous one is still playing its exit.
    //
    // Asked of `history.state`, which is the fact, rather than of whether a
    // cleanup timer happens to be pending, which was only ever a proxy for it.
    owners += 1;
    watchTraversals();
    if (currentOverlayDepth() - traversing < owners) {
      // Stamped from the STACK, not from `owners`, because the stack is the
      // fact and the counter is only a belief about it.
      //
      // Said plainly rather than overclaimed: with the deficit repair below in
      // place these two are equal on every path that can be constructed, and
      // mutating this back to `overlayState(owners)` turns no test red. It was
      // load-bearing against the version WITHOUT that repair, where a burst
      // left the counter permanently ahead and this stamp then claimed entries
      // that were never pushed. Kept because deriving from the fact cannot
      // drift, and left untested on purpose — a test for a state the repair
      // prevents would pass whatever this line said.
      window.history.pushState(overlayState(currentOverlayDepth() + 1), "");
    }

    const onPopState = () => {
      // Are the remaining entries still enough to cover the mounted overlays? Then
      // nothing was dismissed — this was our own reconciliation catching up,
      // and closing here would slam shut a sheet that has only just opened.
      //
      // Deliberately NOT "did MY entry go away". Entries are fungible: history
      // only pops from the top, so when a sheet unmounts mid-animation under a
      // newer one the entry that goes is the NEWER dialog's, and an
      // identity-based guard reads that as its own dismissal. Measured — it
      // closed the replacement sheet the instant it opened.
      if (currentOverlayDepth() >= owners) return;
      // Back dismisses the topmost dialog, exactly as Escape does. The same
      // question, so the same answer — `useFocusTrap` guards Escape this way.
      // Unregistered dialogs are exempt rather than failing closed: failing
      // closed here means Back leaves the app instead of closing the dialog,
      // which is worse than two dialogs both closing.
      const dialog = dialogRef?.current ?? null;
      if (dialog && isRegisteredDialog(dialog) && !isTopmostDialog(dialog)) return;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      owners -= 1;
      scheduleReconciliation();
    };
    // Mount/unmount only. `dialogRef` is a ref object whose identity is stable
    // for the overlay's life, and it is read inside the listener rather than
    // captured, so re-subscribing on it would churn the listener for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
