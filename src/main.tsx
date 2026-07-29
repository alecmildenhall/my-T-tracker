// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ShotsProvider } from "./context/ShotsContext";
import { ProfileProvider } from "./context/ProfileContext";
import { clearStaleOverlayEntry } from "./hooks/useBackToClose";
import "./styles.css";

// Before anything can mount an overlay: a reload (or a mobile browser restoring
// a discarded tab) while a dialog was open leaves its history marker behind,
// where it would quietly eat the user's next Back press.
clearStaleOverlayEntry();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ShotsProvider>
        <ProfileProvider>
          <App />
        </ProfileProvider>
      </ShotsProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
