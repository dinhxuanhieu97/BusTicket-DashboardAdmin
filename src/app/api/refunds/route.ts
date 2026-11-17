import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import { refundsSchema } from "@/lib/passenger-ops";
import { errorResponse, json, operatorSession } from "@/lib/server/session";

/** Khoản cần hoàn (`payment.read`). `?status=ALL` gồm cả khoản đã xử lý. */
export async function GET(req: Request) {
  try {
    const { token, session } = await operatorSession();
    requirePermission(session, "payment.read");
    const status = new URL(req.url).searchParams.get("status") ?? "OPEN";
    if (status !== "OPEN" && status !== "ALL")
      throw new ApiError(400, "VALIDATION_FAILED", "Tham số không hợp lệ.");
    return json(
      refundsSchema.parse(
        await backendRequest(
          `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/refunds?status=${status}`,
          { token },
        ),
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
