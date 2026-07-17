import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
  errorContext: vi.fn((error) => ({ error: { name: error.name, message: error.message } })),
}));

vi.mock("../../lib/logger", () => ({
  logger: { error: loggerMocks.error },
  errorContext: loggerMocks.errorContext,
}));

import { ErrorBoundary } from "../ErrorBoundary";

function BrokenComponent() {
  throw new Error("broken render");
}

describe("ErrorBoundary", () => {
  it("renders children when healthy", () => {
    render(
      <ErrorBoundary>
        <p>Healthy</p>
      </ErrorBoundary>
    );
    expect(screen.getByText("Healthy")).toBeInTheDocument();
  });

  it("logs render failures and displays a safe fallback", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(loggerMocks.error).toHaveBeenCalledWith(
      "ui.render_failed",
      expect.objectContaining({
        error: expect.objectContaining({ message: "broken render" }),
        componentStack: expect.any(String),
      })
    );
  });
});
