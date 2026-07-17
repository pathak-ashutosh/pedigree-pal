import pino, { type DestinationStream, type Logger } from "pino";
import { getServerEnv } from "@/lib/env";

export const LOG_REDACT_PATHS = [
  "password",
  "token",
  "secret",
  "email",
  "walletAddress",
  "apiKey",
  "idempotencyKey",
  "stripeSignature",
  "key_hash",
  "request_hash",
  "payload",
  "req.headers.authorization",
  "req.headers.cookie",
  "request.headers.authorization",
  "request.headers.cookie",
  "*.password",
  "*.token",
  "*.secret",
  "*.email",
  "*.*.password",
  "*.*.token",
  "*.*.secret",
  "*.*.email",
  "*.apiKey",
  "*.idempotencyKey",
  "*.stripeSignature",
] as const;

export function createServerLogger(destination?: DestinationStream): Logger {
  const env = getServerEnv();
  return pino(
    {
      level: env.LOG_LEVEL,
      base: {
        service: "pedigree-pal-web",
        release: env.RELEASE_SHA,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: [...LOG_REDACT_PATHS],
        censor: "[REDACTED]",
      },
    },
    destination,
  );
}

export const logger = createServerLogger();
