import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import { bookingEditInput, bookingEditResultSchema } from "@/lib/passenger-ops";
import {
  errorResponse,
  input,
  json,
  operatorSession,
  protectMutation,
} from "@/lib/server/session";

/** Sửa họ tên, SĐT, điểm đón/trả, ghi chú của đơn (`booking.update`). Không đổi chỗ hay tiền. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    protectMutation(req);
    const { token, session } = await operatorSession();
    requirePermission(session, "booking.update");
    const { code } = await params;
    if (!/^[A-Za-z0-9]{4,12}$/.test(code))
      throw new ApiError(400, "VALIDATION_FAILED", "Mã vé không hợp lệ.");
    const body = await input(req, bookingEditInput);
    return json(
      bookingEditResultSchema.parse(
        await backendRequest(
          `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/bookings/${code.toUpperCase()}`,
          { token, method: "PATCH", body },
        ),
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
