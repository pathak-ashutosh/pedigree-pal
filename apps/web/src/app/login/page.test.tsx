import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@/app/actions/auth", () => ({ requestMagicLink: vi.fn() }));

import LoginPage from "./page";
import { LoginFields } from "./login-form";

describe("login page", () => {
  it("explains and exposes passwordless access", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: /welcome to the record room/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/work email/i)).toHaveAttribute("type", "email");
    expect(screen.getByRole("button", { name: /continue with email/i })).toBeEnabled();
    expect(screen.getByText(/role-based team access/i)).toBeInTheDocument();
  });

  it("renders pending and error states accessibly", () => {
    render(
      <LoginFields
        formAction={vi.fn()}
        pending
        state={{
          status: "error",
          message: "Enter a valid email address.",
          errors: { email: ["Invalid email"] },
        }}
      />,
    );

    expect(screen.getByLabelText(/work email/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/enter a valid email/i);
  });
});
