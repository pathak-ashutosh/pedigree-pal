import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getCurrentClaims = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return null;
  }

  return data.claims;
});

export const requireUser = cache(async () => {
  const claims = await getCurrentClaims();
  if (!claims) {
    redirect("/login");
  }

  return claims;
});
