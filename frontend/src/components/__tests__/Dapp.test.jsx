import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const web3 = vi.hoisted(() => {
  const contract = {
    registerDog: vi.fn(),
    retrieveDog: vi.fn(),
  };
  const provider = { getSigner: vi.fn(async () => ({ signer: true })) };

  return {
    contract,
    provider,
    BrowserProvider: vi.fn(function BrowserProvider() {
      return provider;
    }),
    Contract: vi.fn(function Contract() {
      return contract;
    }),
  };
});

const log = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("ethers", () => ({
  ethers: {
    BrowserProvider: web3.BrowserProvider,
    Contract: web3.Contract,
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: log,
  errorContext: (error) => ({
    error: {
      name: error?.name ?? "Error",
      code: error?.code ?? "UNKNOWN",
      message: error?.message ?? "Unknown error",
    },
  }),
}));

import { Dapp } from "../Dapp";

const ADDRESS = "0x1234567890123456789012345678901234567890";

function installEthereum({ networkVersion = "31337", request } = {}) {
  const listeners = new Map();
  const ethereum = {
    networkVersion,
    request: request ?? vi.fn(async ({ method }) => {
      if (method === "eth_requestAccounts") return [ADDRESS];
      if (method === "wallet_switchEthereumChain") return null;
      throw new Error(`Unexpected method: ${method}`);
    }),
    on: vi.fn((event, handler) => listeners.set(event, handler)),
    removeListener: vi.fn((event, handler) => {
      if (listeners.get(event) === handler) listeners.delete(event);
    }),
  };
  Object.defineProperty(window, "ethereum", { configurable: true, value: ethereum });
  return { ethereum, listeners };
}

async function renderConnected(options) {
  const wallet = installEthereum(options);
  render(<Dapp />);
  await userEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
  await screen.findByText("What would you like to do?");
  return wallet;
}

describe("Dapp integration", () => {
  beforeEach(() => {
    web3.provider.getSigner.mockResolvedValue({ signer: true });
    web3.contract.registerDog.mockReset();
    web3.contract.retrieveDog.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(window, "ethereum", { configurable: true, value: undefined });
  });

  it("shows wallet installation guidance when no provider exists", () => {
    Object.defineProperty(window, "ethereum", { configurable: true, value: undefined });
    render(<Dapp />);
    expect(screen.getByRole("heading", { name: "No Wallet Found" })).toBeInTheDocument();
  });

  it("connects a wallet, initializes ethers, and handles account changes", async () => {
    const { listeners } = await renderConnected();

    expect(web3.BrowserProvider).toHaveBeenCalledWith(window.ethereum);
    expect(web3.Contract).toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith("wallet.connected");

    await act(async () => {
      await listeners.get("accountsChanged")(["0xabcdef"]);
    });
    expect(log.info).toHaveBeenCalledWith("wallet.account_changed");

    await act(async () => {
      await listeners.get("accountsChanged")([]);
    });
    expect(await screen.findByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
    expect(log.info).toHaveBeenCalledWith("wallet.disconnected");
  });

  it("switches to the configured network before initialization", async () => {
    const request = vi.fn(async ({ method }) => {
      if (method === "eth_requestAccounts") return [ADDRESS];
      if (method === "wallet_switchEthereumChain") return null;
      throw new Error(`Unexpected method: ${method}`);
    });

    await renderConnected({ networkVersion: "1", request });

    expect(request).toHaveBeenCalledWith({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x7a69" }],
    });
    expect(log.info).toHaveBeenCalledWith("wallet.network_switch_succeeded", { chainId: "31337" });
  });

  it("shows and dismisses a safe connection error", async () => {
    const error = Object.assign(new Error("provider unavailable"), { code: "NETWORK_ERROR" });
    installEthereum({ request: vi.fn().mockRejectedValue(error) });
    render(<Dapp />);

    await userEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Network error");
    expect(log.error).toHaveBeenCalledWith("wallet.connection_failed", expect.any(Object));

    await userEvent.click(within(alert).getByRole("button"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("handles a cancelled wallet connection without an error", async () => {
    const error = Object.assign(new Error("cancelled"), { code: "ACTION_REJECTED" });
    installEthereum({ request: vi.fn().mockRejectedValue(error) });
    render(<Dapp />);

    await userEvent.click(screen.getByRole("button", { name: /connect wallet/i }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(log.info).toHaveBeenCalledWith("wallet.connection_cancelled");
  });

  it("registers a dog and records lifecycle logs", async () => {
    web3.contract.registerDog.mockResolvedValue({
      hash: "0xtransaction",
      wait: vi.fn().mockResolvedValue({ status: 1, blockNumber: 42 }),
    });
    await renderConnected();

    await userEvent.click(screen.getByRole("button", { name: /register dog/i }));
    await userEvent.type(screen.getByLabelText("Name"), "Rex");
    await userEvent.type(screen.getByLabelText("Breed"), "Labrador");
    await userEvent.type(screen.getByLabelText("Age (years)"), "3");
    await userEvent.selectOptions(screen.getByLabelText("Sex"), "M");
    await userEvent.type(screen.getByLabelText("Mother ID"), "0");
    await userEvent.type(screen.getByLabelText("Father ID"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(web3.contract.registerDog).toHaveBeenCalledWith("Rex", "Labrador", "M", "3", "0", "0");
    expect(await screen.findByText("Dog registered! 🐾")).toBeInTheDocument();
    expect(log.info).toHaveBeenCalledWith("dog.registration_succeeded", { blockNumber: 42 });
  });

  it("surfaces a failed registration and supports dismissal", async () => {
    web3.contract.registerDog.mockRejectedValue(Object.assign(new Error("reverted"), { code: "CALL_EXCEPTION" }));
    await renderConnected();

    await userEvent.click(screen.getByRole("button", { name: /register dog/i }));
    await userEvent.type(screen.getByLabelText("Name"), "Rex");
    await userEvent.type(screen.getByLabelText("Breed"), "Labrador");
    await userEvent.type(screen.getByLabelText("Age (years)"), "3");
    await userEvent.selectOptions(screen.getByLabelText("Sex"), "M");
    await userEvent.type(screen.getByLabelText("Mother ID"), "0");
    await userEvent.type(screen.getByLabelText("Father ID"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Register" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Transaction was rejected by the contract");
    expect(log.error).toHaveBeenCalledWith("dog.registration_failed", expect.any(Object));
    await userEvent.click(within(alert).getByRole("button"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("looks up and renders an existing dog", async () => {
    web3.contract.retrieveDog.mockResolvedValue({
      id: 7n,
      name: "Luna",
      breed: "Poodle",
      sex: "F",
      age: 4n,
      mother: 1n,
      father: 2n,
      owner: ADDRESS,
    });
    await renderConnected();

    await userEvent.click(screen.getByRole("button", { name: /check pedigree/i }));
    await userEvent.type(screen.getByLabelText("Dog ID"), "7");
    await userEvent.click(screen.getByRole("button", { name: /look up/i }));

    expect(await screen.findByRole("heading", { name: "Luna" })).toBeInTheDocument();
    expect(screen.getByText("Poodle")).toBeInTheDocument();
    expect(log.info).toHaveBeenCalledWith("dog.lookup_succeeded", { dogId: "7" });
  });

  it("reports an unknown dog without leaking provider internals", async () => {
    web3.contract.retrieveDog.mockRejectedValue({ code: "BAD_DATA", value: "0x" });
    await renderConnected();

    await userEvent.click(screen.getByRole("button", { name: /check pedigree/i }));
    await userEvent.type(screen.getByLabelText("Dog ID"), "99");
    await userEvent.click(screen.getByRole("button", { name: /look up/i }));

    expect(await screen.findByText("No dog found with ID 99")).toBeInTheDocument();
    expect(log.warn).toHaveBeenCalledWith("dog.lookup_not_found", { dogId: "99" });
  });

  it("logs generic lookup failures and supports keyboard navigation and cancel", async () => {
    web3.contract.retrieveDog.mockRejectedValue(Object.assign(new Error("offline"), { code: "NETWORK_ERROR" }));
    await renderConnected();

    const lookupCard = screen.getByRole("button", { name: /check pedigree/i });
    fireEvent.keyDown(lookupCard, { key: "Enter" });
    await userEvent.type(screen.getByLabelText("Dog ID"), "5");
    await userEvent.click(screen.getByRole("button", { name: /look up/i }));

    expect(await screen.findByText("Network error. Check your connection and try again.")).toBeInTheDocument();
    expect(log.error).toHaveBeenCalledWith(
      "dog.lookup_failed",
      expect.objectContaining({ dogId: "5" })
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("What would you like to do?")).toBeInTheDocument();
  });

  it("shows loading while the signer is initializing", async () => {
    let resolveSigner;
    web3.provider.getSigner.mockReturnValue(new Promise((resolve) => { resolveSigner = resolve; }));
    installEthereum();
    render(<Dapp />);

    await userEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    expect(await screen.findByText("Connecting to the chain...")).toBeInTheDocument();

    resolveSigner({ signer: true });
    expect(await screen.findByText("What would you like to do?")).toBeInTheDocument();
  });

  it("logs account reinitialization failures", async () => {
    const { listeners } = await renderConnected();
    web3.provider.getSigner.mockRejectedValueOnce(Object.assign(new Error("offline"), { code: "NETWORK_ERROR" }));

    await act(async () => {
      await listeners.get("accountsChanged")(["0xabcdef"]);
    });

    await waitFor(() => {
      expect(log.error).toHaveBeenCalledWith("wallet.account_change_failed", expect.any(Object));
    });
  });
});
