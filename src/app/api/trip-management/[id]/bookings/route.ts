import { z } from "zod";
import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import {
  errorResponse,
  input,
  json,
  operatorSession,
  protectMutation,
} from "@/lib/server/session";
import {
  counterInput,
  counterQuoteSchema,
  counterResultSchema,
} from "@/lib/staff-booking";
import { idempotencyKey } from "@/lib/trip-detail";

/**
 * Bán vé tại quầy (`booking.create`). `?dryRun=true`: tính giá và kiểm tra chỗ, không ghi.
 * Ghi thật cần header `Idempotency-Key` (trình duyệt tạo một khóa cho mỗi lần bấm bán).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    protectMutation(req);
    const { token, session } = await operatorSession();
    requirePermission(session, "booking.create");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(400, "VALIDATION_FAILED", "Mã chuyến không hợp lệ.");
    const search = new URL(req.url).searchParams;
    const dryRun = search.get("dryRun") === "true";
    if ([...search.keys()].some((k) => k !== "dryRun"))
      throw new ApiError(400, "VALIDATION_FAILED", "Tham số không hợp lệ.");
    const key = req.headers.get("idempotency-key") ?? "";
    if (!dryRun && !idempotencyKey.safeParse(key).success)
      throw new ApiError(400, "VALIDATION_FAILED", "Thiếu mã chống gửi trùng.");
    const body = await input(req, counterInput);
    const path = `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/trips/${id}/bookings`;
    const raw = await backendRequest(path + (dryRun ? "?dryRun=true" : ""), {
      token,
      method: "POST",
      body,
      ...(dryRun ? {} : { idempotencyKey: key }),
    });
    return json(
      dryRun ? counterQuoteSchema.parse(raw) : counterResultSchema.parse(raw),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
