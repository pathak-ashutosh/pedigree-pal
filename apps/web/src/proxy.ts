import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPublicEnv } from "@/lib/env";
import { hasCanonicalHost } from "@/lib/server/origin";
import { updateSession } from "@/lib/supabase/proxy";

export function buildContentSecurityPolicy(nonce: string, supabaseUrl: string): string {
  const supabase = new URL(supabaseUrl);
  const websocketOrigin = `${supabase.protocol === "https:" ? "wss:" : "ws:"}//${supabase.host}`;
  const development = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'${development ? " 'unsafe-inline'" : ""}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self' ${supabase.origin} ${websocketOrigin}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const env = getPublicEnv();
  if (!hasCanonicalHost(request.headers, env.NEXT_PUBLIC_APP_URL)) {
    return new NextResponse("Misdirected request", {
      status: 421,
      headers: { "cache-control": "no-store" },
    });
  }

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const nonce = crypto.randomUUID();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce, env.NEXT_PUBLIC_SUPABASE_URL);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", contentSecurityPolicy);
  requestHeaders.set("x-nonce", nonce);

  const shouldRefreshSession = pathname.startsWith("/dashboard") || pathname === "/onboarding";
  const response = shouldRefreshSession
    ? await updateSession(request, requestHeaders)
    : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
