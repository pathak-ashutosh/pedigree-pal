import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { getPublicEnv } from "@/lib/env";
import { logger } from "@/lib/server/logger";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appOrigin = new URL(getPublicEnv().NEXT_PUBLIC_APP_URL).origin;
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      logger.info({ event: "auth.callback.succeeded" }, "auth callback succeeded");
      return NextResponse.redirect(new URL(next, appOrigin));
    }

    logger.warn({ event: "auth.callback.failed", errorCode: error.code }, "auth callback failed");
  } else {
    logger.warn({ event: "auth.callback.missing_code" }, "auth callback missing code");
  }

  return NextResponse.redirect(new URL("/login?error=auth", appOrigin));
}
