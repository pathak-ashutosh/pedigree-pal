const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40, silent: 100 });
const DEFAULT_LEVEL = import.meta.env.MODE === "production" ? "info" : "debug";
const ADDRESS_PATTERN = /0x[a-fA-F0-9]{40}/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SECRET_KEY_PATTERN = /authorization|cookie|email|password|private|secret|signature|token/i;
const MAX_DEPTH = 5;
const MAX_STRING_LENGTH = 500;

function redactString(value) {
  const truncated = value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}…`
    : value;

  return truncated
    .replace(ADDRESS_PATTERN, "[REDACTED_ADDRESS]")
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
}

export function sanitizeLogValue(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return redactString(value);
  if (typeof value === "function") return "[FUNCTION]";
  if (depth >= MAX_DEPTH) return "[MAX_DEPTH]";

  if (value instanceof Error) {
    return sanitizeLogValue({
      name: value.name,
      code: value.code,
      message: value.message,
    }, depth + 1, seen);
  }

  if (typeof value === "object") {
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeLogValue(item, depth + 1, seen));
    }

    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : sanitizeLogValue(item, depth + 1, seen),
    ]));
  }

  return redactString(String(value));
}

export function errorContext(error) {
  return {
    error: {
      name: error?.name ?? "Error",
      code: error?.code ?? "UNKNOWN",
      message: error?.message ?? "Unknown error",
    },
  };
}

export function createLogger({
  service = "pedigree-pal-web",
  release = import.meta.env.VITE_RELEASE || "development",
  minLevel = import.meta.env.VITE_LOG_LEVEL || DEFAULT_LEVEL,
  sink = console,
  clock = () => new Date().toISOString(),
} = {}) {
  const threshold = LEVELS[minLevel] ?? LEVELS.info;

  function write(level, event, context = {}) {
    if (LEVELS[level] < threshold) return;

    const entry = {
      timestamp: clock(),
      level,
      service,
      release,
      event,
      context: sanitizeLogValue(context),
    };
    const method = level === "debug" ? "debug" : level === "info" ? "info" : level === "warn" ? "warn" : "error";
    sink[method](JSON.stringify(entry));
  }

  return Object.freeze({
    debug: (event, context) => write("debug", event, context),
    info: (event, context) => write("info", event, context),
    warn: (event, context) => write("warn", event, context),
    error: (event, context) => write("error", event, context),
  });
}

export function installGlobalErrorLogging(target = window, activeLogger = logger) {
  const onError = (event) => {
    activeLogger.error("browser.uncaught_error", errorContext(event.error ?? new Error(event.message)));
  };
  const onUnhandledRejection = (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    activeLogger.error("browser.unhandled_rejection", errorContext(error));
  };

  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onUnhandledRejection);

  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}

export const logger = createLogger();
