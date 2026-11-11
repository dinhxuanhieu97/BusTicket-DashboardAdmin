import { z } from "zod";
import { backendRequest } from "@/lib/backend-client";
import {
  operatorSession,
  protectMutation,
  json,
  errorResponse,
} from "@/lib/server/session";
import { assertTripManager } from "@/lib/trip-management";
import { ApiError, requirePermission } from "@/lib/access-policy";

const uuid = "[0-9a-fA-F-]{36}";
const allowed = {
  GET: [
    { path: /^profile$/, permission: "policy.read" },
    // Chính sách đặt vé (giữ chỗ, cọc cố định...): API kiểm quyền và validate đầy đủ.
    { path: /^policy$/, permission: "policy.read" },
    { path: /^trip-schedules$/, permission: "trip.read" },
    {
      path: new RegExp(`^trip-schedules/${uuid}/preview$`),
      permission: "trip.read",
    },
  ],
  POST: [
    { path: /^trip-schedules$/, permission: "trip.write" },
    { path: /^routes$/, permission: "route.write" },
    { path: /^route-pairs$/, permission: "route.write" },
    {
      path: new RegExp(`^trip-schedules/${uuid}/generate$`),
      permission: "trip.write",
    },
  ],
  PUT: [
    { path: /^profile$/, permission: "policy.write" },
    { path: /^policy$/, permission: "policy.write" },
    { path: new RegExp(`^routes/${uuid}/stops$`), permission: "route.write" },
    {
      path: new RegExp(`^trip-schedules/${uuid}/exception$`),
      permission: "trip.write",
    },
  ],
  PATCH: [
    { path: new RegExp(`^trip-schedules/${uuid}$`), permission: "trip.write" },
    { path: new RegExp(`^vehicles/${uuid}$`), permission: "fleet.write" },
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
    const operation = allowed[method]?.find((rule) => rule.path.test(path));
    if (!operation || new URL(req.url).search)
      throw new ApiError(404, "NOT_FOUND", "Không tìm thấy thao tác.");
    const { token, session } = await operatorSession();
    requirePermission(session, operation.permission);
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
