import { z } from "zod";
import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import { errorResponse, json, operatorSession } from "@/lib/server/session";
import { tripPassengersSchema } from "@/lib/trip-assistants";

/** Danh sách khách của một chuyến được giao; chuyến không được giao trả 404 từ máy chủ. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { token, session } = await operatorSession();
    requirePermission(session, "trip.assigned.read");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(400, "VALIDATION_FAILED", "Mã chuyến không hợp lệ.");
    return json(
      tripPassengersSchema.parse(
        await backendRequest(
          `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/my-trips/${id}/passengers`,
          { token },
        ),
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
