import { z } from "zod";
import { backendRequest } from "@/lib/backend-client";
import { ApiError } from "@/lib/access-policy";
import {
  userSession,
  protectMutation,
  input,
  issueSession,
  errorResponse,
} from "@/lib/server/session";
const schema = z
  .object({
    password: z.string().min(1).max(128),
    otp: z.string().regex(/^\d{6}$/),
  })
  .strict();
/** Tắt 2FA: API cần mật khẩu + mã hiện tại, thu hồi phiên cũ và cấp phiên mới (ghi lại cookie). */
export async function POST(req: Request) {
  try {
    protectMutation(req);
    const { token } = await userSession();
    const body = await input(req, schema);
    let issued: unknown;
    try {
      issued = await backendRequest("/api/v1/auth/mfa/disable", {
        token,
        method: "POST",
        body,
      });
    } catch (e) {
      // Sai mật khẩu/mã là lỗi nhập liệu, không phải phiên hết hạn: trả 400 để không xóa cookie phiên đang dùng.
      if (
        e instanceof ApiError &&
        e.status === 401 &&
        e.code === "INVALID_CREDENTIALS"
      )
        throw new ApiError(
          400,
          "INVALID_CREDENTIALS",
          "Mật khẩu hoặc mã xác thực không đúng.",
        );
      throw e;
    }
    return issueSession(issued);
  } catch (e) {
    return errorResponse(e);
  }
}
