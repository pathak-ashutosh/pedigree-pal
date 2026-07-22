import type { Logger } from "pino";
import { logger } from "@/lib/server/logger";
import { getRequestId } from "@/lib/server/request";

type HealthDependencies = {
  activeLogger?: Pick<Logger, "info">;
  now?: () => number;
  requestId?: (request: Request) => string;
};

export function createHealthHandler({
  activeLogger = logger,
  now = Date.now,
  requestId = getRequestId,
}: HealthDependencies = {}) {
  return async function GET(request: Request): Promise<Response> {
    const startedAt = now();
    const id = requestId(request);
    const body = {
      status: "ok",
      service: "pedigree-pal-web",
      release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.RELEASE_SHA || "development",
    } as const;

    activeLogger.info(
      {
        event: "health.checked",
        requestId: id,
        method: request.method,
        path: new URL(request.url).pathname,
        statusCode: 200,
        durationMs: now() - startedAt,
      },
      "health check",
    );

    return Response.json(body, {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "x-request-id": id,
      },
    });
  };
}

export const GET = createHealthHandler();
export const dynamic = "force-dynamic";
