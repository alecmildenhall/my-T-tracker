import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";

const Boom = () => {
  throw new Error("kaboom");
};

afterEach(() => vi.restoreAllMocks());

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("shows a reassuring fallback (not a blank screen) when a child throws", () => {
    // React logs the error to console.error; silence it for a clean test run.
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
    expect(screen.getByText(/your data is still saved/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });
});
