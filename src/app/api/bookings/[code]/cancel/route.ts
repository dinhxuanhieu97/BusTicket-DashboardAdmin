import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import { cancelInput, cancelResultSchema } from "@/lib/passenger-ops";
import {
  errorResponse,
  input,
  json,
  operatorSession,
  protectMutation,
} from "@/lib/server/session";

/** Hủy đơn thay khách (`booking.cancel`): bắt buộc lý do; đơn đã thu tiền tạo khoản cần hoàn cho kế toán. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    protectMutation(req);
    const { token, session } = await operatorSession();
    requirePermission(session, "booking.cancel");
    const { code } = await params;
    if (!/^[A-Za-z0-9]{4,12}$/.test(code))
      throw new ApiError(400, "VALIDATION_FAILED", "Mã vé không hợp lệ.");
    const body = await input(req, cancelInput);
    return json(
      cancelResultSchema.parse(
        await backendRequest(
          `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/bookings/${code.toUpperCase()}/cancel`,
          { token, method: "POST", body },
        ),
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
