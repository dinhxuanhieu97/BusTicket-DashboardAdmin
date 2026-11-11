import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  assertOperatorSession,
  assertPlatformSession,
  assertSignedInSession,
  checkOrigin,
} from "../access-policy";
import { backendRequest } from "../backend-client";
import { sessionSchema, issuedSchema } from "../live-contracts";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAccessWrites,
  clearWrites,
  cookieWrites,
} from "../session-tokens";
import { appOrigin, applyCookieWrites, cookieOptions } from "./cookies";
export { appOrigin, cookieOptions };
export const COOKIE = ACCESS_COOKIE;
export function protectMutation(request: Request) {
  checkOrigin(request, appOrigin());
}
/** Như protectMutation nhưng thân là tệp có kiểu nằm trong `types` (vd. ảnh logo). */
export function protectUpload(request: Request, types: readonly string[]) {
  checkOrigin(request, appOrigin(), types);
}
export const noStore = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noStore });
}
export function clearSession(response: NextResponse) {
  return applyCookieWrites(response, clearWrites());
}
export function issueSession(raw: unknown) {
  const issued = issuedSchema.parse(raw);
  assertSignedInSession(issued, true);
  const expiry = Date.parse(issued.expiresAt);
  if (expiry <= Date.now())
    throw new ApiError(502, "INVALID_RESPONSE", "API trả về phiên đã hết hạn.");
  // Token chỉ nằm trong cookie HttpOnly; JSON trả về trình duyệt không chứa token.
  return applyCookieWrites(
    json({
      scope: issued.scope,
      mustChangePassword: issued.mustChangePassword ?? false,
    }),
    cookieWrites(issued),
  );
}
/** Đăng xuất: thu hồi phiên phía API (lỗi mạng không chặn việc xóa cookie). */
export async function revokeCurrentSession() {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (!access && !refresh) return;
  try {
    await backendRequest("/api/v1/auth/logout", {
      method: "POST",
      token: access && /^[\w.-]+$/.test(access) ? access : undefined,
      body: refresh ? { refreshToken: refresh } : {},
    });
  } catch {
    // Vẫn xóa cookie; phiên tự hết hạn phía API.
  }
}
async function currentSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) throw new ApiError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập.");
  const session = sessionSchema.parse(
    await backendRequest("/api/v1/auth/me", { token }),
  );
  return { token, session };
}
/** Tài khoản nhà xe (mọi route nghiệp vụ). */
export async function operatorSession(allowSetup = false) {
  const current = await currentSession();
  assertOperatorSession(current.session, allowSetup);
  return current;
}
/** Tài khoản nhà xe hoặc quản trị nền tảng (2FA, đổi mật khẩu, đọc phiên). */
export async function userSession(allowSetup = false) {
  const current = await currentSession();
  assertSignedInSession(current.session, allowSetup);
  return current;
}
/** Chỉ quản trị nền tảng. */
export async function platformSession(allowSetup = false) {
  const current = await currentSession();
  assertPlatformSession(current.session, allowSetup);
  return current;
}
export function errorResponse(e: unknown) {
  const error =
    e instanceof ApiError
      ? e
      : e instanceof z.ZodError
        ? new ApiError(
            502,
            "INVALID_RESPONSE",
            "Dữ liệu API chưa tương thích. Vui lòng liên hệ quản trị.",
          )
        : new ApiError(500, "INTERNAL_ERROR", "Không thể xử lý yêu cầu.");
  const res = json(
    { error: { code: error.code, message: error.message } },
    error.status,
  );
  if (error.retryAfter && /^\d+$/.test(error.retryAfter))
    res.headers.set("Retry-After", error.retryAfter);
  // 401: chỉ bỏ access token — có thể chỉ do access vừa hết hạn hoặc đồng hồ lệch; request sau proxy dùng refresh
  // token để gia hạn, nếu refresh cũng bị từ chối thì proxy xóa cả hai cookie. 403 sai khu (nhà xe/nền tảng) giữ phiên.
  if (error.status === 401) applyCookieWrites(res, clearAccessWrites());
  return res;
}
export async function input<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const length = Number(req.headers.get("content-length") || 0);
  if (length > 4096)
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Dữ liệu quá lớn.");
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > 4096) throw new Error();
    raw = JSON.parse(text);
  } catch {
    throw new ApiError(400, "VALIDATION_FAILED", "Dữ liệu không hợp lệ.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      "Vui lòng kiểm tra thông tin đã nhập.",
    );
  return parsed.data;
}
