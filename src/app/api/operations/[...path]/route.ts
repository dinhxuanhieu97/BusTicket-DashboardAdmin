import { z } from "zod";
import { backendRequest } from "@/lib/backend-client";
import {
  ownerSession,
  protectMutation,
  json,
  errorResponse,
} from "@/lib/server/session";
import { assertTripManager } from "@/lib/trip-management";
import { ApiError } from "@/lib/access-policy";

const uuid = "[0-9a-fA-F-]{36}";
const allowed = {
  GET: [
    /^profile$/,
    /^trip-schedules$/,
    new RegExp(`^trip-schedules/${uuid}/preview$`),
  ],
  POST: [
    /^trip-schedules$/,
    /^routes$/,
    /^route-pairs$/,
    new RegExp(`^trip-schedules/${uuid}/generate$`),
  ],
  PUT: [
    /^profile$/,
    new RegExp(`^routes/${uuid}/stops$`),
    new RegExp(`^trip-schedules/${uuid}/exception$`),
  ],
  PATCH: [
    new RegExp(`^trip-schedules/${uuid}$`),
    new RegExp(`^vehicles/${uuid}$`),
  ],
};
async function handle(
  req: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: parts } = await context.params;
    const path = parts.join("/"),
      method = req.method as keyof typeof allowed;
    if (
      !allowed[method]?.some((pattern) => pattern.test(path)) ||
      new URL(req.url).search
    )
      throw new ApiError(404, "NOT_FOUND", "Không tìm thấy thao tác.");
    const { token, session } = await ownerSession();
    let body: unknown;
    if (method !== "GET") {
      protectMutation(req);
      if (path.startsWith("trip-schedules"))
        assertTripManager(session, process.env.PNTICKET_TRIP_WRITE_OPERATOR_ID);
      const raw = await req.text();
      if (raw.length > 30000)
        throw new ApiError(413, "TOO_LARGE", "Dữ liệu quá lớn.");
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        throw new ApiError(400, "VALIDATION_FAILED", "JSON không hợp lệ.");
      }
      // Route/resource-specific strict validation remains authoritative in the API.
      z.record(z.string(), z.unknown()).parse(body);
    }
    const payload = await backendRequest(
      `/api/v1/admin/operators/${session.user.operatorId}/${path}`,
      {
        token,
        method,
        ...(body !== undefined ? { body } : {}),
        ...(path === "trip-schedules" &&
        method === "POST" &&
        req.headers.has("idempotency-key")
          ? {
              idempotencyKey: z
                .string()
                .uuid()
                .parse(req.headers.get("idempotency-key")),
            }
          : {}),
      },
    );
    return json(payload);
  } catch (e) {
    return errorResponse(e);
  }
}
export const GET = handle,
  POST = handle,
  PUT = handle,
  PATCH = handle;
