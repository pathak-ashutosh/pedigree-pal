import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { CheckoutForm, requestCheckout } from "./checkout-form";

describe("billing checkout form", () => {
  it("sends a versioned idempotent checkout request", async () => {
    const requester = vi.fn().mockResolvedValue(
      Response.json({ url: "https://checkout.stripe.test/session" }, { status: 201 }),
    );
    await expect(requestCheckout("northstar", "pro", requester, "checkout_key_12345"))
      .resolves.toBe("https://checkout.stripe.test/session");
    expect(requester).toHaveBeenCalledWith(
      "/api/v1/billing/checkout",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "idempotency-key": "checkout_key_12345" }),
        body: JSON.stringify({ organizationSlug: "northstar", plan: "pro" }),
      }),
    );
  });

  it("surfaces provider and malformed response failures", async () => {
    await expect(requestCheckout(
      "northstar",
      "starter",
      vi.fn().mockResolvedValue(Response.json({ error: "Billing is unavailable." }, { status: 503 })),
      "checkout_key_12345",
    )).rejects.toThrow("Billing is unavailable.");
    await expect(requestCheckout(
      "northstar",
      "starter",
      vi.fn().mockResolvedValue(new Response("not-json", { status: 201 })),
      "checkout_key_12345",
    )).rejects.toThrow("Checkout could not start.");
  });

  it("navigates on success", async () => {
    const navigate = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ url: "https://checkout.stripe.test/session" }, { status: 201 }),
    );
    render(<CheckoutForm organizationSlug="northstar" plan="starter" navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose starter" }));
    expect(screen.getByRole("button")).toBeDisabled();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("https://checkout.stripe.test/session"));
  });

  it("re-enables after a safe error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ error: "Try later." }, { status: 502 }),
    );
    render(<CheckoutForm organizationSlug="northstar" plan="pro" navigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose pro" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try later.");
    expect(screen.getByRole("button", { name: "Choose pro" })).toBeEnabled();
  });
});
