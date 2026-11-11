import { z } from "zod";
import { ApiError } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import {
  errorResponse,
  input,
  issueSession,
  userSession,
  protectMutation,
} from "@/lib/server/session";

const schema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(10).max(128),
  })
  .strict();

/** Đổi mật khẩu của chính mình (kể cả mật khẩu tạm OWNER vừa đặt). API thu hồi phiên cũ và cấp phiên mới. */
export async function POST(req: Request) {
  try {
    protectMutation(req);
    const { token } = await userSession();
    const body = await input(req, schema);
    let issued: unknown;
    try {
      issued = await backendRequest("/api/v1/auth/password", {
        token,
        method: "POST",
        body,
      });
    } catch (e) {
      // Sai mật khẩu hiện tại là lỗi nhập liệu: trả 400 để không xóa cookie phiên đang dùng.
      if (
        e instanceof ApiError &&
        e.status === 401 &&
        e.code === "INVALID_CREDENTIALS"
      )
        throw new ApiError(
          400,
          "INVALID_CREDENTIALS",
          "Mật khẩu hiện tại không đúng.",
        );
      throw e;
    }
    return issueSession(issued);
  } catch (e) {
    return errorResponse(e);
  }
}
