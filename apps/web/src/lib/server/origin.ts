import { headers } from "next/headers";
import { getPublicEnv } from "@/lib/env";

function matchesHost(header: string | null, expectedHost: string): boolean {
  const value = header?.trim();
  if (!value || value.includes(",") || value.includes("/") || value.includes("@")) {
    return false;
  }

  return value.toLowerCase() === expectedHost.toLowerCase();
}

export function canonicalOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Application URL must use HTTP or HTTPS.");
  }
  return url.origin;
}

export function originFromHeaders(_requestHeaders: Headers, fallback: string): string {
  return canonicalOrigin(fallback);
}

export function hasCanonicalHost(requestHeaders: Headers, expectedOrigin: string): boolean {
  const expectedHost = new URL(canonicalOrigin(expectedOrigin)).host;
  if (!matchesHost(requestHeaders.get("host"), expectedHost)) {
    return false;
  }

  const forwardedHost = requestHeaders.get("x-forwarded-host");
  return forwardedHost === null || matchesHost(forwardedHost, expectedHost);
}

export function hasTrustedOrigin(request: Request, expectedOrigin: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }

  try {
    return canonicalOrigin(origin) === canonicalOrigin(expectedOrigin);
  } catch {
    return false;
  }
}

export async function getRequestOrigin(): Promise<string> {
  return originFromHeaders(await headers(), getPublicEnv().NEXT_PUBLIC_APP_URL);
}
