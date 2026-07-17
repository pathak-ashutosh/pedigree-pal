"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getPublicEnv } from "@/lib/env";
import { logger } from "@/lib/server/logger";
import { createClient } from "@/lib/supabase/server";
import type { AuthState } from "@/lib/auth/state";

const magicLinkSchema = z.object({ email: z.email() });

export async function requestMagicLink(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const result = magicLinkSchema.safeParse({ email: formData.get("email") });
  if (!result.success) {
    return {
      status: "error",
      message: "Enter a valid email address.",
      errors: z.flattenError(result.error).fieldErrors,
    };
  }

  const supabase = await createClient();
  const env = getPublicEnv();
  const { error } = await supabase.auth.signInWithOtp({
    email: result.data.email,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    logger.warn({ event: "auth.magic_link.failed", errorCode: error.code }, "magic link failed");
    return {
      status: "error",
      message: "We could not send the sign-in link. Try again shortly.",
    };
  }

  logger.info({ event: "auth.magic_link.sent" }, "magic link sent");
  return {
    status: "sent",
    message: "Check your inbox for a secure sign-in link.",
  };
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  logger.info({ event: "auth.signed_out" }, "user signed out");
  redirect("/login");
}
