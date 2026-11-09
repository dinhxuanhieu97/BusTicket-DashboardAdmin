import { tripManager, tripOptions } from "@/lib/server/trip-management";
import {
  json,
  errorResponse,
  protectMutation,
  input,
} from "@/lib/server/session";
import { createTripInput, tripWriteResult } from "@/lib/trip-management";
import { backendRequest } from "@/lib/backend-client";
import { ApiError } from "@/lib/access-policy";
import { idempotencyKey } from "@/lib/trip-detail";
export async function POST(req: Request) {
  try {
    protectMutation(req);
    const { base, token } = await tripManager();
    const body = await input(req, createTripInput);
    const key = idempotencyKey.safeParse(req.headers.get("idempotency-key"));
    if (!key.success)
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        "Thiếu hoặc sai Idempotency-Key. Vui lòng tải lại trang.",
      );
    const options = await tripOptions(base, token),
      vehicle = options.vehicles.find((v) => v.id === body.vehicleId);
    if (!options.routes.some((r) => r.id === body.routeId) || !vehicle?.usable)
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        "Tuyến hoặc xe không khả dụng. Vui lòng tải lại danh sách.",
      );
    const keys = vehicle.fares.map((f) => `${f.floor}:${f.occupancy}`);
    if (
      body.fares.length !== keys.length ||
      body.fares.some((f) => !keys.includes(`${f.floor}:${f.occupancy}`))
    )
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        "Bảng giá chưa khớp sơ đồ xe.",
      );
    const trip = tripWriteResult.parse(
      await backendRequest(base + "/trips", {
        token,
        method: "POST",
        body,
        idempotencyKey: key.data,
      }),
    );
    return json({ trip }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
