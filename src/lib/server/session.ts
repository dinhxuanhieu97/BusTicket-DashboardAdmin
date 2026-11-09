import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, assertOwner, checkOrigin } from "../access-policy";
import { backendRequest } from "../backend-client";
import { sessionSchema, issuedSchema } from "../live-contracts";
export const COOKIE = "pnticket_owner_session";
export function appOrigin() {
  const raw = process.env.APP_ORIGIN;
  if (!raw)
    throw new ApiError(503, "NOT_CONFIGURED", "Chưa cấu hình APP_ORIGIN.");
  const url = new URL(raw);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new ApiError(
      503,
      "NOT_CONFIGURED",
      "Dashboard cần dùng HTTPS khi triển khai.",
    );
  return url.origin;
}
export function protectMutation(request: Request) {
  checkOrigin(request, appOrigin());
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
export function cookieOptions() {
  return {
    httpOnly: true,
    secure: new URL(appOrigin()).protocol === "https:",
    sameSite: "strict" as const,
    path: "/",
  };
}
export function clearSession(response: NextResponse) {
  response.cookies.set(COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}
export function issueSession(raw: unknown) {
  const issued = issuedSchema.parse(raw);
  assertOwner(issued, true);
  const expiry = Date.parse(issued.expiresAt);
  if (expiry <= Date.now())
    throw new ApiError(502, "INVALID_RESPONSE", "API trả về phiên đã hết hạn.");
  const response = json({ scope: issued.scope });
  response.cookies.set(COOKIE, issued.accessToken, {
    ...cookieOptions(),
    expires: new Date(expiry),
  });
  return response;
}
export async function ownerSession(allowSetup = false) {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) throw new ApiError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập.");
  const session = sessionSchema.parse(
    await backendRequest("/api/v1/auth/me", { token }),
  );
  assertOwner(session, allowSetup);
  return { token, session };
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
  if (error.status === 401 || error.code === "OWNER_REQUIRED")
    clearSession(res);
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
