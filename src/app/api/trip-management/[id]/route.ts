import { z } from "zod";
import { operatorSession, json, errorResponse } from "@/lib/server/session";
import { backendRequest } from "@/lib/backend-client";
import { ApiError, requirePermission } from "@/lib/access-policy";
import { tripDetailSchema } from "@/lib/trip-detail";
/** Trip details for users with trip.read in the authenticated operator. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { token, session } = await operatorSession();
    requirePermission(session, "trip.read");
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success)
      throw new ApiError(400, "VALIDATION_FAILED", "Mã chuyến không hợp lệ.");
    const detail = tripDetailSchema.parse(
      await backendRequest(
        `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/trips/${id}`,
        { token },
      ),
    );
    return json({ ...detail, meta: { fetchedAt: new Date().toISOString() } });
  } catch (e) {
    return errorResponse(e);
  }
}
