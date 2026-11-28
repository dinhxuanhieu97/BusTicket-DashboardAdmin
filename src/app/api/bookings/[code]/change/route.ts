import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import {
  bookingChangeInput,
  bookingChangeResultSchema,
  touchesMoney,
} from "@/lib/booking-change";
import { idempotencyKey } from "@/lib/trip-detail";
import {
  errorResponse,
  input,
  json,
  operatorSession,
  protectMutation,
} from "@/lib/server/session";

/**
 * Đổi chỗ / chuyến / tiền của đơn (`booking.update`; chỉnh tiền tay cần thêm `payment.manage`).
 * `?dryRun=true`: xem trước giá mới, tiền còn thu, khoản cần hoàn — không ghi. Ghi thật bắt buộc Idempotency-Key.
 */
export async function POST(
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
    const dryRun = new URL(req.url).searchParams.get("dryRun") === "true";
    const body = await input(req, bookingChangeInput);
    if (touchesMoney(body)) requirePermission(session, "payment.manage");
    let key: string | undefined;
    if (!dryRun) {
      const parsed = idempotencyKey.safeParse(
        req.headers.get("idempotency-key"),
      );
      if (!parsed.success)
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          "Thiếu hoặc sai Idempotency-Key. Vui lòng tải lại trang.",
        );
      key = parsed.data;
    }
    return json(
      bookingChangeResultSchema.parse(
        await backendRequest(
          `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/bookings/${code.toUpperCase()}/change${dryRun ? "?dryRun=true" : ""}`,
          { token, method: "POST", body, idempotencyKey: key },
        ),
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
