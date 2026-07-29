// src/hooks/useBackToClose.ts
import { useEffect, useRef } from "react";

/**
 * Makes the device's system Back gesture close an open overlay instead of
 * leaving the app.
 *
 * On Android, Back is a hardware button / edge swipe that fires regardless of
 * what the page wants; with no history entry of our own, its default is to
 * navigate away from the app entirely — so with the log sheet open, a reflexive
 * Back leaves the app *and* takes the half-filled form with it. Closing the
 * topmost overlay is the near-universal expectation there (in native Android a
 * dialog is back-dismissible for free), so we push one throwaway history entry
 * while the overlay is open and close on `popstate` when Back pops it.
 *
 * Deliberately scoped to overlays only. Tab switching pushes nothing, so Back
 * from History or Settings still exits the app — tabs are the way to move
 * between destinations, and this hook is about not losing data, not about
 * rebuilding navigation. No URLs and no router are involved; real
 * history/deep-link routing is a PWA-phase decision this doesn't pre-empt.
 */
export function useBackToClose(isOpen: boolean, onClose: () => void): void {
  // Hold the latest onClose so the listener can be subscribed once per open,
  // rather than re-subscribing whenever the caller passes a fresh closure.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // `history.state` survives a reload — and mobile browsers routinely discard
  // and restore a backgrounded tab. If the overlay was open at that moment, the
  // app comes back with the overlay CLOSED but our marker still on the entry.
  // Left alone it would absorb a whole Back press later (the guard below would
  // see an overlay entry and decline to close), so clear it once on mount.
  useEffect(() => {
    if (!isOpen && window.history.state?.overlay) {
      window.history.replaceState(null, "");
    }
    // Mount only: a marker present at any later point is one this hook pushed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // The entry Back will pop. It carries a marker so the cleanup below can tell
    // whether it is still on the stack.
    window.history.pushState({ overlay: true }, "");

    const onPopState = () => {
      // Landing on another overlay entry means this pop was the cleanup's
      // queued history.back() from a previous open catching up *after* the
      // sheet had already been reopened — it popped the new entry, not ours.
      // Closing here would slam the just-opened sheet shut; the entry we landed
      // on is still ours, so a real Back press will close it next.
      if (window.history.state?.overlay) return;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      // Closing by any other route (Escape, Cancel, backdrop, saving) leaves our
      // entry on the stack; drop it so the next Back press isn't swallowed
      // undoing an overlay that is already gone. When Back itself did the
      // closing, the entry is already popped and this is correctly skipped.
      if (window.history.state?.overlay) window.history.back();
    };
  }, [isOpen]);
}
