import { z } from "zod";
import { backendRequest } from "@/lib/backend-client";
import { ApiError } from "@/lib/access-policy";
import { loginProxyFor } from "@/lib/server/login-proxy";
import {
  protectMutation,
  input,
  issueSession,
  errorResponse,
} from "@/lib/server/session";
const schema = z
  .object({
    phone: z.string().min(1).max(30),
    password: z.string().min(1).max(128),
    otp: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    rememberMe: z.boolean().optional(),
  })
  .strict();
export async function POST(req: Request) {
  try {
    protectMutation(req);
    const body = await input(req, schema);
    const loginProxy = loginProxyFor(req);
    const login = (payload: unknown) =>
      backendRequest("/api/v1/auth/login", {
        method: "POST",
        body: payload,
        loginProxy,
      });
    let issued: unknown;
    try {
      issued = await login(body);
    } catch (e) {
      // API chưa có "ghi nhớ đăng nhập" (schema strict) từ chối key `rememberMe` bằng 400 trước khi
      // kiểm tra mật khẩu. Thử lại không có key này để vẫn đăng nhập được (phiên thường) trong lúc
      // dashboard được deploy trước backend hoặc chạy local trỏ vào API cũ.
      if (
        body.rememberMe === undefined ||
        !(e instanceof ApiError) ||
        e.status !== 400 ||
        e.code !== "VALIDATION_FAILED"
      )
        throw e;
      const { rememberMe: _ignored, ...legacy } = body;
      issued = await login(legacy);
    }
    return issueSession(issued);
  } catch (e) {
    return errorResponse(e);
  }
}
