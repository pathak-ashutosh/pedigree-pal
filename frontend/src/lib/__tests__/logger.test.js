import { describe, expect, it, vi } from "vitest";
import {
  createLogger,
  errorContext,
  installGlobalErrorLogging,
  sanitizeLogValue,
} from "../logger";

function createSink() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("logger", () => {
  it("emits stable structured JSON", () => {
    const sink = createSink();
    const logger = createLogger({
      service: "web",
      release: "abc123",
      minLevel: "debug",
      sink,
      clock: () => "2026-07-15T12:00:00.000Z",
    });

    logger.info("wallet.connected", { chainId: 31337 });

    expect(JSON.parse(sink.info.mock.calls[0][0])).toEqual({
      timestamp: "2026-07-15T12:00:00.000Z",
      level: "info",
      service: "web",
      release: "abc123",
      event: "wallet.connected",
      context: { chainId: 31337 },
    });
  });

  it("redacts secrets, emails, and wallet addresses recursively", () => {
    const result = sanitizeLogValue({
      authorization: "Bearer secret",
      contact: "owner@example.com",
      nested: { wallet: "0x1234567890123456789012345678901234567890" },
    });

    expect(result).toEqual({
      authorization: "[REDACTED]",
      contact: "[REDACTED_EMAIL]",
      nested: { wallet: "[REDACTED_ADDRESS]" },
    });
  });

  it("handles errors, bigint, functions, cycles, and depth limits", () => {
    const cyclic = { amount: 2n, callback: () => {} };
    cyclic.self = cyclic;

    expect(sanitizeLogValue(cyclic)).toEqual({
      amount: "2",
      callback: "[FUNCTION]",
      self: "[CIRCULAR]",
    });
    expect(sanitizeLogValue(new Error("failed"))).toMatchObject({ name: "Error", message: "failed" });
    const deeplyNested = { a: { b: { c: { d: { e: { f: true } } } } } };
    const deep = sanitizeLogValue(deeplyNested);
    expect(deep.a.b.c.d.e).toBe("[MAX_DEPTH]");
  });

  it("enforces the configured minimum level", () => {
    const sink = createSink();
    const logger = createLogger({ minLevel: "warn", sink });

    logger.debug("debug.event");
    logger.info("info.event");
    logger.warn("warn.event");
    logger.error("error.event");

    expect(sink.debug).not.toHaveBeenCalled();
    expect(sink.info).not.toHaveBeenCalled();
    expect(sink.warn).toHaveBeenCalledOnce();
    expect(sink.error).toHaveBeenCalledOnce();
  });

  it("normalizes error context without provider payloads", () => {
    const error = Object.assign(new Error("reverted"), { code: "CALL_EXCEPTION", data: { secret: true } });
    expect(errorContext(error)).toEqual({
      error: { name: "Error", code: "CALL_EXCEPTION", message: "reverted" },
    });
  });

  it("captures global errors and removes handlers during cleanup", () => {
    const handlers = new Map();
    const target = {
      addEventListener: vi.fn((name, handler) => handlers.set(name, handler)),
      removeEventListener: vi.fn((name, handler) => {
        if (handlers.get(name) === handler) handlers.delete(name);
      }),
    };
    const activeLogger = { error: vi.fn() };
    const cleanup = installGlobalErrorLogging(target, activeLogger);

    handlers.get("error")({ error: new Error("render failed") });
    handlers.get("unhandledrejection")({ reason: "promise failed" });

    expect(activeLogger.error).toHaveBeenNthCalledWith(
      1,
      "browser.uncaught_error",
      expect.objectContaining({ error: expect.objectContaining({ message: "render failed" }) })
    );
    expect(activeLogger.error).toHaveBeenNthCalledWith(
      2,
      "browser.unhandled_rejection",
      expect.objectContaining({ error: expect.objectContaining({ message: "promise failed" }) })
    );

    cleanup();
    expect(handlers.size).toBe(0);
  });
});
