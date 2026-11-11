import { requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import { errorResponse, json, operatorSession } from "@/lib/server/session";
import { assignedTripsSchema } from "@/lib/trip-assistants";

/** Chuyến được giao cho phụ xe đang đăng nhập (máy chủ lọc theo người dùng của phiên). */
export async function GET() {
  try {
    const { token, session } = await operatorSession();
    requirePermission(session, "trip.assigned.read");
    const data = assignedTripsSchema.parse(
      await backendRequest(
        `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/my-trips`,
        { token },
      ),
    );
    return json({ ...data, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return errorResponse(e);
  }
}
