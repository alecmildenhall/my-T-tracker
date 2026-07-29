// src/hooks/useBackToClose.ts
import { useEffect, useRef } from "react";

/**
 * Makes the device's system Back gesture close an open overlay instead of
 * leaving the app.
 *
 * On Android, Back is a hardware button / edge swipe that fires regardless of
 * what the page wants; with no history entry of our own, its default is to
 * navigate away — which, with the log sheet open, silently discards a
 * half-filled form. Closing the topmost overlay is the near-universal
 * expectation there, so we push one throwaway history entry while the overlay is
 * open and close on `popstate` when Back pops it.
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

  useEffect(() => {
    if (!isOpen) return;

    // The entry Back will pop. It carries a marker so the cleanup below can tell
    // whether it is still on the stack.
    window.history.pushState({ overlay: true }, "");

    const onPopState = () => onCloseRef.current();
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
