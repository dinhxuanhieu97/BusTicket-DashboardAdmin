import { z } from "zod";
import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import { errorResponse, json, operatorSession } from "@/lib/server/session";
import {
  adminTripPassengersSchema,
  passengerScopeSchema,
} from "@/lib/trip-passengers";

/** Danh sách khách (họ tên, SĐT) của một chuyến cho nhân viên có `booking.read`. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { token, session } = await operatorSession();
    requirePermission(session, "booking.read");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(400, "VALIDATION_FAILED", "Mã chuyến không hợp lệ.");
    const status = passengerScopeSchema.safeParse(
      new URL(req.url).searchParams.get("status") ?? "active",
    );
    if (!status.success)
      throw new ApiError(400, "VALIDATION_FAILED", "Bộ lọc không hợp lệ.");
    return json(
      adminTripPassengersSchema.parse(
        await backendRequest(
          `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/trips/${id}/passengers?status=${status.data}`,
          { token },
        ),
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
