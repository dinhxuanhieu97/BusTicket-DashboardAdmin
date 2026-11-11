import { z } from "zod";
import { backendRequest } from "@/lib/backend-client";
import { ownerAccountSchema, temporaryPasswordInput } from "@/lib/platform";
import {
  platformOwnerAccess,
  rejectQuery,
  uuidParam,
} from "@/lib/server/platform";
import {
  errorResponse,
  input,
  json,
  protectMutation,
} from "@/lib/server/session";

type Context = { params: Promise<{ operatorId: string; userId: string }> };
const response = z.object({ owner: ownerAccountSchema });

/** Đặt mật khẩu tạm cho chủ xe. API yêu cầu mật khẩu (và mã 2FA nếu đã bật) của chính quản trị nền tảng. */
export async function POST(request: Request, { params }: Context) {
  try {
    protectMutation(request);
    rejectQuery(request);
    const p = await params;
    const operatorId = uuidParam(p.operatorId, "nhà xe");
    const userId = uuidParam(p.userId, "chủ xe");
    const { token } = await platformOwnerAccess("owner.password.reset");
    const body = await input(request, temporaryPasswordInput);
    return json(
      response.parse(
        await backendRequest(
          `/api/v1/admin/operators/${operatorId}/owners/${userId}/temporary-password`,
          { token, method: "POST", body },
        ),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
