import type { Logger } from "pino";
import { logger } from "@/lib/server/logger";
import { getRequestId } from "@/lib/server/request";
import { createAdminClient } from "@/lib/supabase/admin";

const defaultDependencies = {
  admin: createAdminClient,
  activeLogger: logger as Pick<Logger, "info" | "error">,
  now: Date.now,
  requestId: getRequestId,
};

export function createReadyHandler(overrides: Partial<typeof defaultDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  return async function GET(request: Request): Promise<Response> {
    const startedAt = dependencies.now();
    const requestId = dependencies.requestId(request);
    let errorCode: string | undefined;
    try {
      const result = await dependencies.admin()
        .from("organizations")
        .select("id", { count: "exact", head: true });
      errorCode = result.error?.code;
    } catch {
      errorCode = "configuration_error";
    }
    const healthy = !errorCode;
    const fields = {
      event: healthy ? "readiness.checked" : "readiness.failed",
      requestId,
      statusCode: healthy ? 200 : 503,
      durationMs: dependencies.now() - startedAt,
      ...(errorCode ? { errorCode } : {}),
    };
    if (healthy) {
      dependencies.activeLogger.info(fields, "readiness check");
    } else {
      dependencies.activeLogger.error(fields, "readiness check failed");
    }
    return Response.json(
      { status: healthy ? "ready" : "unavailable", service: "pedigree-pal-web" },
      {
        status: healthy ? 200 : 503,
        headers: { "cache-control": "no-store", "x-request-id": requestId },
      },
    );
  };
}

export const GET = createReadyHandler();
export const dynamic = "force-dynamic";
