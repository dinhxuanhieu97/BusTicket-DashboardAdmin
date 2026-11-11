import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { ApiError, hasPermission } from "../access-policy";
import { operatorSession, platformSession, userSession } from "./session";
import { isAssistantOnly } from "../trip-assistants";
type Loader = typeof operatorSession;
function access(load: Loader) {
  return async function () {
    try {
      return { ok: true as const, ...(await load(true)) };
    } catch (e) {
      return {
        ok: false as const,
        status: e instanceof ApiError ? e.status : 502,
        code: e instanceof ApiError ? e.code : "INTERNAL_ERROR",
        message:
          e instanceof ApiError
            ? e.message
            : "Không đọc được phiên đăng nhập. Vui lòng thử lại.",
      };
    }
  };
}
/** Trang của nhà xe (`/admin`). */
export const pageAccess = cache(access(operatorSession));
/** Trang dùng chung cho mọi tài khoản đăng nhập (`/mfa`, `/change-password`). */
export const userPageAccess = cache(access(userSession));
/** Trang quản trị nền tảng (`/platform`). */
export const platformPageAccess = cache(access(platformSession));
/** Trang chủ theo vai trò. */
export const homeFor = (role: string) =>
  role === "PLATFORM_ADMIN" ? "/platform" : "/admin";

export async function requirePagePermission(permission: string) {
  const access = await pageAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/login");
    return null;
  }
  if (access.session.scope !== "full") redirect("/mfa");
  if (!hasPermission(access.session, permission))
    redirect(
      access.session.scope === "full" &&
        isAssistantOnly(access.session.permissions)
        ? "/admin/assigned-trips"
        : "/admin/settings",
    );
  return access.session;
}
