import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getAdminEnv, getPublicEnv } from "@/lib/env";

type AdminDatabase = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      }
    >;
    Views: Record<string, never>;
    Functions: Record<
      string,
      {
        Args: Record<string, unknown>;
        Returns: unknown;
      }
    >;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let adminClient: ReturnType<typeof createClient<AdminDatabase>> | undefined;

export function createAdminClient() {
  if (!adminClient) {
    const publicEnv = getPublicEnv();
    const adminEnv = getAdminEnv();
    adminClient = createClient<AdminDatabase>(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      adminEnv.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
  }

  return adminClient;
}
