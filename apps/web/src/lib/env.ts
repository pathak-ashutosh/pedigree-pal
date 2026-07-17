import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

const serverEnvSchema = z.object({
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  RELEASE_SHA: z.string().min(1).default("development"),
});

const adminEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

const billingEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PRICE_STARTER: z.string().startsWith("price_"),
  STRIPE_PRICE_PRO: z.string().startsWith("price_"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type AdminEnv = z.infer<typeof adminEnvSchema>;
export type BillingEnv = z.infer<typeof billingEnvSchema>;

type EnvironmentInput = Record<string, string | undefined>;

export function parsePublicEnv(input: EnvironmentInput): PublicEnv {
  return publicEnvSchema.parse(input);
}

export function parseServerEnv(input: EnvironmentInput): ServerEnv {
  return serverEnvSchema.parse(input);
}

export function getPublicEnv(): PublicEnv {
  return parsePublicEnv(process.env);
}

export function getServerEnv(): ServerEnv {
  return parseServerEnv(process.env);
}

export function parseAdminEnv(input: EnvironmentInput): AdminEnv {
  return adminEnvSchema.parse(input);
}

export function getAdminEnv(): AdminEnv {
  return parseAdminEnv(process.env);
}

export function parseBillingEnv(input: EnvironmentInput): BillingEnv {
  return billingEnvSchema.parse(input);
}

export function getBillingEnv(): BillingEnv {
  return parseBillingEnv(process.env);
}
