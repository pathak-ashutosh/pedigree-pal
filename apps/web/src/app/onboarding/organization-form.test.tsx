import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@/app/actions/organizations", () => ({ createOrganization: vi.fn() }));

import { OrganizationFields, OrganizationForm } from "./organization-form";

describe("organization form", () => {
  it("suggests a slug until the user edits it", () => {
    render(<OrganizationForm />);
    const name = screen.getByLabelText(/organization name/i);
    const slug = screen.getByLabelText(/workspace url/i);

    fireEvent.change(name, { target: { value: "Élite Northstar Kennels" } });
    expect(slug).toHaveValue("elite-northstar-kennels");

    fireEvent.change(slug, { target: { value: "custom-registry" } });
    fireEvent.change(name, { target: { value: "Changed Name" } });
    expect(slug).toHaveValue("custom-registry");
  });

  it("renders pending validation failures", () => {
    render(
      <OrganizationFields
        formAction={vi.fn()}
        name="x"
        onNameChange={vi.fn()}
        onSlugChange={vi.fn()}
        pending
        slug="bad slug"
        state={{
          status: "error",
          message: "Check the workspace name and URL.",
          errors: { name: ["Too short"], slug: ["Invalid"] },
        }}
      />,
    );

    expect(screen.getByLabelText(/organization name/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/workspace url/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: /creating workspace/i })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/check the workspace/i);
  });
});
