// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ShotsProvider } from "./context/ShotsContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ShotsProvider>
        <App />
      </ShotsProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
