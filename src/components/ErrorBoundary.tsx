// src/components/ErrorBoundary.tsx
// Catches render-time errors anywhere below it and shows a reassuring fallback
// instead of unmounting the whole app to a blank screen. For an app people trust
// with health data, a crash must not *look* like data loss — the entries are
// still in localStorage; only the current render failed.
import React from "react";

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Local-only console log for debugging. No telemetry or network (privacy).
    console.error("[ErrorBoundary] Unhandled render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error" role="alert">
          <h1>Something went wrong</h1>
          <p>
            The app hit an unexpected error, but <b>your data is still saved on
            this device</b> — nothing was deleted. Reloading usually fixes it.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
