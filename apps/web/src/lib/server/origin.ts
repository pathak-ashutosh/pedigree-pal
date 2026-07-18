import { headers } from "next/headers";
import { getPublicEnv } from "@/lib/env";

function firstValue(header: string | null): string | null {
  const value = header?.split(",")[0]?.trim();
  return value ? value : null;
}

export function originFromHeaders(requestHeaders: Headers, fallback: string): string {
  const host = firstValue(requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"));
  const proto = firstValue(requestHeaders.get("x-forwarded-proto"));
  if (!host || !proto) {
    return fallback;
  }

  return `${proto}://${host}`;
}

export async function getRequestOrigin(): Promise<string> {
  return originFromHeaders(await headers(), getPublicEnv().NEXT_PUBLIC_APP_URL);
}
