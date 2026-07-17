import { z } from "zod";
import { hashApiKey, readBearerApiKey } from "@/lib/api/keys";
import { logger } from "@/lib/server/logger";
import { getRequestId } from "@/lib/server/request";
import { createAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  search: z.string().trim().max(80).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const defaultDependencies = {
  admin: createAdminClient,
  requestId: getRequestId,
  activeLogger: logger,
};

function json(body: unknown, status: number, requestId: string, headers?: Record<string, string>) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-request-id": requestId,
      ...headers,
    },
  });
}

export function createDogsApiHandler(overrides: Partial<typeof defaultDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function GET(request: Request): Promise<Response> {
    const requestId = dependencies.requestId(request);
    const rawKey = readBearerApiKey(request.headers.get("authorization"));
    if (!rawKey) {
      return json({ error: "A valid bearer API key is required." }, 401, requestId);
    }

    const admin = dependencies.admin();
    const credential = await admin
      .from("api_keys")
      .select("id, organization_id, scopes, revoked_at")
      .eq("key_hash", hashApiKey(rawKey))
      .maybeSingle();
    if (credential.error) {
      dependencies.activeLogger.error(
        { event: "api.authentication_failed", errorCode: credential.error.code, requestId },
        "API authentication failed",
      );
      return json({ error: "API authentication is temporarily unavailable." }, 503, requestId);
    }
    if (!credential.data || credential.data.revoked_at) {
      return json({ error: "API key is invalid or revoked." }, 401, requestId);
    }
    const scopes = Array.isArray(credential.data.scopes) ? credential.data.scopes : [];
    if (!scopes.includes("dogs:read")) {
      return json({ error: "API key lacks dogs:read scope." }, 403, requestId);
    }

    const parsedQuery = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsedQuery.success) {
      return json({ error: "Invalid search or limit query." }, 400, requestId);
    }

    const organizationId = String(credential.data.organization_id);
    const quota = await admin.rpc("consume_api_request", {
      target_organization_id: organizationId,
      max_requests: 120,
    });
    if (quota.error) {
      dependencies.activeLogger.error(
        { event: "api.quota_failed", errorCode: quota.error.code, requestId },
        "API quota check failed",
      );
      return json({ error: "API quota is temporarily unavailable." }, 503, requestId);
    }
    if (quota.data !== true) {
      return json(
        { error: "Rate limit exceeded." },
        429,
        requestId,
        { "retry-after": "60", "x-ratelimit-limit": "120" },
      );
    }

    let dogsQuery = admin
      .from("dogs")
      .select("id, registered_name, call_name, breed, sex, birth_date, status, created_at, updated_at")
      .eq("organization_id", organizationId)
      .neq("status", "archived")
      .order("registered_name")
      .limit(parsedQuery.data.limit);
    if (parsedQuery.data.search) {
      dogsQuery = dogsQuery.ilike("registered_name", `%${parsedQuery.data.search}%`);
    }
    const dogs = await dogsQuery;
    if (dogs.error) {
      dependencies.activeLogger.error(
        { event: "api.dogs_list_failed", errorCode: dogs.error.code, requestId },
        "API dog query failed",
      );
      return json({ error: "Dog registry is temporarily unavailable." }, 503, requestId);
    }

    const lastUsed = await admin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", String(credential.data.id))
      .select("id")
      .maybeSingle();
    if (lastUsed.error) {
      dependencies.activeLogger.warn(
        { event: "api.key_usage_update_failed", errorCode: lastUsed.error.code, requestId },
        "API key usage timestamp failed",
      );
    }

    dependencies.activeLogger.info(
      { event: "api.dogs_listed", count: dogs.data?.length ?? 0, requestId },
      "API dogs listed",
    );
    return json(
      { data: dogs.data ?? [], meta: { count: dogs.data?.length ?? 0, requestId } },
      200,
      requestId,
      { "x-ratelimit-limit": "120" },
    );
  };
}

export const GET = createDogsApiHandler();
