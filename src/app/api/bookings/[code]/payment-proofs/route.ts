import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import { bookingPaymentProofsSchema } from "@/lib/payment-proofs";
import { errorResponse, json, operatorSession } from "@/lib/server/session";

/** Danh sách ảnh lệnh chuyển khoản khách gửi cho đơn (`payment.read`); không kèm dữ liệu ảnh. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { token, session } = await operatorSession();
    requirePermission(session, "payment.read");
    const { code } = await params;
    if (!/^[A-Za-z0-9]{4,12}$/.test(code))
      throw new ApiError(400, "VALIDATION_FAILED", "Mã vé không hợp lệ.");
    return json(
      bookingPaymentProofsSchema.parse(
        await backendRequest(
          `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/bookings/${code.toUpperCase()}/payment-proofs`,
          { token },
        ),
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
