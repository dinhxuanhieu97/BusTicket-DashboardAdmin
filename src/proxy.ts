import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { assertOwner } from "./lib/access-policy";
import { backendRequest } from "./lib/backend-client";
import { issuedSchema, sessionSchema } from "./lib/live-contracts";
import { appOrigin, applyCookieWrites } from "./lib/server/cookies";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessExpiryMs,
  clearWrites,
  CookieWrite,
  cookieWrites,
  needsRefresh,
  requiresLogin,
} from "./lib/session-tokens";

/**
 * Chạy trước mọi trang và API route:
 * 1. Access token sắp/đã hết hạn mà còn refresh token → đổi lấy token mới (im lặng), ghi cookie cho trình duyệt và
 *    chuyển luôn token mới vào request hiện tại để trang/API phía sau dùng được ngay.
 * 2. Trang quản trị/2FA không có phiên → về `/login`. `/login` có phiên hợp lệ (hỏi API) → vào `/admin`.
 * Đây chỉ là lớp tiện dụng; mọi route vẫn tự xác thực với API (`ownerSession`).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  let writes: CookieWrite[] = [];
  let refreshUnavailable = false;

  // Route đăng nhập/đăng xuất tự ghi cookie; refresh trước sẽ tranh Set-Cookie với chúng.
  const handlesOwnCookies =
    pathname === "/api/auth/login" || pathname === "/api/auth/logout";
  if (!handlesOwnCookies && needsRefresh(access, refresh, Date.now())) {
    const outcome = await tryRefresh(refresh!);
    if (outcome.kind === "ok") {
      writes = outcome.writes;
      access = outcome.accessToken;
      for (const w of writes) request.cookies.set(w.name, w.value);
    } else if (outcome.kind === "rejected") {
      writes = clearWrites();
      access = undefined;
      request.cookies.delete(ACCESS_COOKIE);
      request.cookies.delete(REFRESH_COOKIE);
    } else refreshUnavailable = true;
  }

  // API tạm lỗi đúng lúc access token đã hết hạn: báo 503 và GIỮ cookie, không để sự cố thoáng qua thành đăng xuất
  // (trang phía sau sẽ nhận 401 từ token cũ và xóa phiên).
  if (refreshUnavailable && isExpired(access)) {
    if (pathname.startsWith("/api/")) return unavailableJson();
    if (requiresLogin(pathname)) return unavailablePage();
  }

  // Không có cookie (chưa đăng nhập, hoặc mở link từ trang khác nên trình duyệt không gửi cookie SameSite=Strict):
  // chỉ chuyển hướng, không xóa gì — xóa ở đây sẽ làm mất phiên "Ghi nhớ đăng nhập" còn hạn.
  if (requiresLogin(pathname) && !access)
    return finish(NextResponse.redirect(target("/login", request)), writes);

  if (pathname === "/login" && access && !refreshUnavailable) {
    const where = await landingFor(access);
    if (where === "invalid") {
      writes = clearWrites();
      request.cookies.delete(ACCESS_COOKIE);
      request.cookies.delete(REFRESH_COOKIE);
    } else if (where) {
      return finish(NextResponse.redirect(target(where, request)), writes);
    }
  }

  return finish(
    NextResponse.next({ request: { headers: request.headers } }),
    writes,
  );
}

function isExpired(access: string | undefined) {
  const exp = accessExpiryMs(access);
  return exp === null || exp <= Date.now();
}

/** Chuyển hướng theo APP_ORIGIN (không tin Host của request khi chạy sau proxy/CDN). */
function target(path: string, request: NextRequest) {
  try {
    return new URL(path, appOrigin());
  } catch {
    return new URL(path, request.url);
  }
}

const UNAVAILABLE =
  "Không kết nối được API PNTicket. Vui lòng thử lại sau ít phút.";
function unavailableJson() {
  return NextResponse.json(
    { error: { code: "BACKEND_UNAVAILABLE", message: UNAVAILABLE } },
    {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "10" },
    },
  );
}
function unavailablePage() {
  return new NextResponse(
    `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PNTicket</title><body style="font-family:system-ui;padding:2rem;max-width:32rem;margin:auto"><p role="alert">${UNAVAILABLE}</p><p><a href="">Tải lại trang</a></p></body></html>`,
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "10",
      },
    },
  );
}

function finish(response: NextResponse, writes: CookieWrite[]) {
  if (writes.length) {
    applyCookieWrites(response, writes);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }
  return response;
}

type RefreshOutcome =
  | { kind: "ok"; accessToken: string; writes: CookieWrite[] }
  | { kind: "rejected" }
  | { kind: "unavailable" };

async function tryRefresh(refreshToken: string): Promise<RefreshOutcome> {
  try {
    const issued = issuedSchema.parse(
      await backendRequest("/api/v1/auth/refresh", {
        method: "POST",
        body: { refreshToken },
      }),
    );
    assertOwner(issued, true);
    return {
      kind: "ok",
      accessToken: issued.accessToken,
      writes: cookieWrites(issued),
    };
  } catch (e) {
    // API trả dữ liệu không đúng hợp đồng: lỗi cố định chứ không phải sự cố thoáng qua — coi như bị từ chối để người
    // dùng về trang đăng nhập (thay vì kẹt ở trang 503), và ghi log để phát hiện hợp đồng lệch.
    if (e instanceof ZodError) {
      console.error("auth refresh: response does not match issuedSchema", {
        issues: e.issues.map((i) => ({ path: i.path.join("."), code: i.code })),
      });
      return { kind: "rejected" };
    }
    const status = (e as { status?: unknown }).status;
    if (status === 401 || status === 403 || status === 400)
      return { kind: "rejected" };
    return { kind: "unavailable" };
  }
}

/** Nơi chuyển tới khi đang có phiên mà mở `/login`; null = không chắc (API lỗi) → cứ hiện trang đăng nhập. */
async function landingFor(
  token: string,
): Promise<"/admin" | "/mfa" | "invalid" | null> {
  try {
    const session = assertOwner(
      sessionSchema.parse(await backendRequest("/api/v1/auth/me", { token })),
      true,
    );
    return session.scope === "full" ? "/admin" : "/mfa";
  } catch (e) {
    const status = (e as { status?: unknown }).status;
    return status === 401 || status === 403 ? "invalid" : null;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|map|txt)$).*)",
  ],
};
