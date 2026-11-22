import { z } from "zod";
import { ApiError, requirePermission } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import {
  refundResolveResultSchema,
  resolveRefundInput,
} from "@/lib/passenger-ops";
import {
  errorResponse,
  input,
  json,
  operatorSession,
  protectMutation,
} from "@/lib/server/session";

/** Kế toán đánh dấu khoản cần hoàn đã hoàn / không hoàn (`payment.manage`). Việc chuyển tiền làm ngoài hệ thống. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    protectMutation(req);
    const { token, session } = await operatorSession();
    requirePermission(session, "payment.manage");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        "Mã khoản hoàn không hợp lệ.",
      );
    const body = await input(req, resolveRefundInput);
    return json(
      refundResolveResultSchema.parse(
        await backendRequest(
          `/api/v1/admin/operators/${encodeURIComponent(session.user.operatorId!)}/refunds/${id}/resolve`,
          { token, method: "POST", body },
        ),
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
