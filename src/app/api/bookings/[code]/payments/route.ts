import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import {
  bookingPaymentInput,
  bookingPaymentResultSchema,
} from "@/lib/passenger-ops";
import { idempotencyKey } from "@/lib/trip-detail";
import {
  errorResponse,
  input,
  json,
  operatorSession,
  protectMutation,
} from "@/lib/server/session";

/**
 * Ghi nhận tiền khách trả cho đơn (`payment.record`): tiền mặt, hoặc chuyển khoản thấy trong app ngân hàng
 * (chỉ chủ xe/kế toán — API kiểm tra). Bắt buộc Idempotency-Key để bấm hai lần không ghi hai khoản.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    protectMutation(req);
    const { token, session } = await operatorSession();
    requirePermission(session, "payment.record");
    const { code } = await params;
    if (!/^[A-Za-z0-9]{4,12}$/.test(code))
      throw new ApiError(400, "VALIDATION_FAILED", "Mã vé không hợp lệ.");
    const key = idempotencyKey.safeParse(req.headers.get("idempotency-key"));
    if (!key.success)
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        "Thiếu hoặc sai Idempotency-Key. Vui lòng tải lại trang.",
      );
    const body = await input(req, bookingPaymentInput);
    return json(
      bookingPaymentResultSchema.parse(
        await backendRequest(
          `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/payments/manual`,
          {
            token,
            method: "POST",
            body: { ...body, bookingCode: code.toUpperCase() },
            idempotencyKey: key.data,
          },
        ),
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
