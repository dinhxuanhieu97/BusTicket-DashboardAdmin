import { z } from "zod";
import { ApiError } from "@/lib/access-policy";
import { backendRequest } from "@/lib/backend-client";
import { loginProxyFor } from "@/lib/server/login-proxy";
import {
  errorResponse,
  input,
  json,
  protectMutation,
} from "@/lib/server/session";

const schema = z
  .object({
    phone: z.string().min(1).max(30),
    otp: z.string().regex(/^\d{6}$/),
    newPassword: z.string().min(10).max(128),
  })
  .strict();

/** Quên mật khẩu: đặt lại bằng mã Authenticator. Không cấp phiên, người dùng đăng nhập lại bằng mật khẩu mới. */
export async function POST(req: Request) {
  try {
    protectMutation(req);
    const body = await input(req, schema);
    try {
      await backendRequest("/api/v1/auth/password/reset", {
        method: "POST",
        body,
        loginProxy: loginProxyFor(req),
      });
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 401 &&
        e.code === "INVALID_CREDENTIALS"
      )
        throw new ApiError(
          400,
          "INVALID_CREDENTIALS",
          "Số điện thoại hoặc mã xác thực không đúng, tài khoản chưa bật 2FA, hoặc đang tạm khóa do thử sai nhiều lần.",
        );
      throw e;
    }
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
