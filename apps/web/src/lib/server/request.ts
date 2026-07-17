import { randomUUID } from "node:crypto";

const requestIdPattern = /^[a-zA-Z0-9._:-]{1,64}$/;

export function getRequestId(request: Request, generate: () => string = randomUUID): string {
  const upstreamId = request.headers.get("x-request-id");
  return upstreamId && requestIdPattern.test(upstreamId) ? upstreamId : generate();
}
