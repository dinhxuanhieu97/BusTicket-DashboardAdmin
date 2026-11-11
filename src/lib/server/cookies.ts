import type { NextResponse } from "next/server";
import { ApiError } from "../access-policy";
import { CookieWrite } from "../session-tokens";
/** Dùng chung cho route handler và `proxy.ts` (proxy không dùng được `next/headers`). */
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
export function cookieOptions() {
  return {
    httpOnly: true,
    secure: new URL(appOrigin()).protocol === "https:",
    sameSite: "strict" as const,
    path: "/",
  };
}
export function applyCookieWrites(
  response: NextResponse,
  writes: CookieWrite[],
) {
  const base = cookieOptions();
  for (const w of writes)
    response.cookies.set(w.name, w.value, {
      ...base,
      ...(w.expires ? { expires: w.expires } : {}),
      ...(w.maxAge !== undefined ? { maxAge: w.maxAge } : {}),
    });
  return response;
}
