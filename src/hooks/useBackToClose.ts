// src/hooks/useBackToClose.ts
import { useEffect, useRef } from "react";

/** Marks the throwaway history entry an open overlay owns. */
const OVERLAY_STATE = { overlay: true };

/**
 * Drop an overlay marker left over from a previous life of the page.
 *
 * `history.state` survives a reload, and mobile browsers routinely discard and
 * restore a backgrounded tab. If an overlay was open at that moment the app
 * comes back with it CLOSED but the marker still on the current entry — where it
 * would silently absorb a whole Back press later. Call once at startup, before
 * any overlay can mount.
 */
export function clearStaleOverlayEntry(): void {
  if (window.history.state?.overlay) window.history.replaceState(null, "");
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
export function useBackToClose(onClose: () => void): void {
  // Hold the latest onClose so the listener subscribes once per mount, rather
  // than re-subscribing whenever the caller passes a fresh closure.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    // The entry Back will pop.
    window.history.pushState(OVERLAY_STATE, "");

    const onPopState = () => {
      // Landing on another overlay entry means this pop was a previous
      // overlay's queued cleanup traversal catching up *after* a new overlay
      // opened — it popped the new entry, not ours. Closing here would slam the
      // just-opened overlay shut; a real Back press will close it next.
      if (window.history.state?.overlay) return;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      // Closing by any other route (Escape, Cancel, backdrop, saving) leaves our
      // entry on the stack; drop it so the next Back press isn't swallowed
      // dismissing an overlay that is already gone. When Back itself did the
      // closing, the entry is already popped and this is correctly skipped.
      if (window.history.state?.overlay) window.history.back();
    };
  }, []);
}
