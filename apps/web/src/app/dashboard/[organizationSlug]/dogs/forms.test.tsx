import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@/app/actions/dogs", () => ({
  createDog: vi.fn(),
  updateDog: vi.fn(),
  setDogParent: vi.fn(),
  archiveDog: vi.fn(),
}));

import { ArchiveFields, ArchiveForm } from "./[dogId]/archive-form";
import { ParentFields, ParentForm } from "./[dogId]/parent-form";
import { DogFields, DogForm } from "./dog-form";

const dogId = "20000000-0000-4000-8000-000000000001";

describe("dog form", () => {
  it("renders create and edit action wrappers", () => {
    const { rerender } = render(<DogForm mode="create" organizationSlug="northstar" />);
    expect(screen.getByRole("button", { name: /create dog record/i })).toBeEnabled();

    rerender(
      <DogForm
        defaults={{ id: dogId, registeredName: "Juniper" }}
        mode="edit"
        organizationSlug="northstar"
      />,
    );
    expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
  });

  it("renders pending edit validation and fingerprint state", () => {
    render(
      <DogFields
        defaults={{
          id: dogId,
          registeredName: "Juniper",
          callName: null,
          sex: "female",
          hasMicrochip: true,
        }}
        formAction={vi.fn()}
        mode="edit"
        organizationSlug="northstar"
        pending
        state={{
          status: "error",
          message: "Check the highlighted dog fields.",
          errors: { registeredName: ["Invalid"], breed: ["Invalid"], birthDate: ["Invalid"] },
        }}
      />,
    );

    expect(screen.getByRole("button", { name: /saving record/i })).toBeDisabled();
    expect(screen.getByDisplayValue("Juniper")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByPlaceholderText(/fingerprint already stored/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/highlighted dog fields/i);
  });
});

describe("parent form", () => {
  it("renders current and candidate parents", () => {
    render(
      <ParentForm
        candidates={[{ id: "sire-2", registeredName: "Atlas" }]}
        childId={dogId}
        currentParent={{ id: "sire-1", registeredName: "Orion" }}
        kind="sire"
        organizationSlug="northstar"
      />,
    );
    expect(screen.getByText("Orion")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Atlas" })).toBeInTheDocument();
  });

  it("disables empty pending assignments and shows errors", () => {
    render(
      <ParentFields
        candidates={[]}
        childId={dogId}
        formAction={vi.fn()}
        kind="dam"
        organizationSlug="northstar"
        pending
        state={{ status: "error", message: "Choose a valid parent record." }}
      />,
    );
    expect(screen.getByText("Not assigned")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/valid parent/i);
  });
});

describe("archive form", () => {
  it("renders wrapper and pending error states", () => {
    const { rerender } = render(<ArchiveForm dogId={dogId} organizationSlug="northstar" />);
    expect(screen.getByRole("button", { name: /archive dog/i })).toBeEnabled();

    rerender(
      <ArchiveFields
        dogId={dogId}
        formAction={vi.fn()}
        organizationSlug="northstar"
        pending
        state={{ status: "error", message: "Only administrators can archive dogs." }}
      />,
    );
    expect(screen.getByRole("button", { name: /archiving/i })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/administrators/i);
  });
});
