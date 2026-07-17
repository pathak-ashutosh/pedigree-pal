import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("marketing home", () => {
  it("explains the product and provides entry points", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /every pedigree should hold up under scrutiny/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/example three-generation pedigree/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /sign in|create your workspace/i })).not.toHaveLength(0);
    expect(screen.getByText(/GPL-3.0-only/i)).toBeInTheDocument();
  });

  it("renders every workflow step", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: /build the record/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /review with your team/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /publish proof selectively/i })).toBeInTheDocument();
  });
});
