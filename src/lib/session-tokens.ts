/**
 * Quy tắc cookie phiên dashboard (không phụ thuộc Next.js để test được):
 * - `pnticket_owner_session`: access token ngắn hạn (15 phút).
 * - `pnticket_owner_refresh`: refresh token xoay vòng; sống tới hạn phiên nếu "Ghi nhớ đăng nhập", ngược lại là
 *   cookie phiên (đóng trình duyệt là hết).
 * Cả hai: HttpOnly, SameSite=Strict, Secure khi HTTPS. Token không bao giờ trả về JavaScript phía trình duyệt.
 */
export const ACCESS_COOKIE = "pnticket_owner_session";
export const REFRESH_COOKIE = "pnticket_owner_refresh";
/** Gia hạn trước khi access token hết hạn một chút để request đang đi không bị 401. */
export const REFRESH_SKEW_MS = 30_000;

export interface IssuedTokens {
  accessToken: string;
  expiresAt: string;
  refreshToken?: string | null;
  sessionExpiresAt?: string | null;
  remember?: boolean;
}

export interface CookieWrite {
  name: string;
  value: string;
  /** undefined = cookie phiên; 0 = xóa. */
  expires?: Date;
  maxAge?: number;
}

/** Đọc `exp` (giây) trong payload JWT mà KHÔNG kiểm chữ ký — chỉ để quyết định có cần refresh; backend mới là nơi xác thực. */
export function accessExpiryMs(token: string | undefined): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf8"),
    ) as { exp?: unknown };
    return typeof json.exp === "number" && Number.isFinite(json.exp)
      ? json.exp * 1000
      : null;
  } catch {
    return null;
  }
}

export function needsRefresh(
  access: string | undefined,
  refresh: string | undefined,
  now: number,
): boolean {
  if (!refresh) return false;
  const exp = accessExpiryMs(access);
  return exp === null || exp - now < REFRESH_SKEW_MS;
}

/**
 * Cookie cần ghi sau khi API cấp token (đăng nhập, xác nhận 2FA, refresh).
 * - Có refresh token mới → ghi đè.
 * - Không có phiên (token thiết lập 2FA) → xóa refresh token cũ nếu còn.
 * - Có phiên nhưng không có token mới (refresh trong ân hạn) → giữ refresh cookie hiện tại.
 */
export function cookieWrites(issued: IssuedTokens): CookieWrite[] {
  const remember = issued.remember === true;
  const sessionEnd = issued.sessionExpiresAt
    ? new Date(issued.sessionExpiresAt)
    : null;
  const writes: CookieWrite[] = [];
  if (sessionEnd)
    writes.push({
      name: ACCESS_COOKIE,
      value: issued.accessToken,
      ...(remember ? { expires: sessionEnd } : {}),
    });
  else
    writes.push({
      name: ACCESS_COOKIE,
      value: issued.accessToken,
      expires: new Date(issued.expiresAt),
    });
  if (issued.refreshToken)
    writes.push({
      name: REFRESH_COOKIE,
      value: issued.refreshToken,
      ...(remember && sessionEnd ? { expires: sessionEnd } : {}),
    });
  else if (!sessionEnd)
    writes.push({ name: REFRESH_COOKIE, value: "", maxAge: 0 });
  return writes;
}

export function clearWrites(): CookieWrite[] {
  return [
    { name: ACCESS_COOKIE, value: "", maxAge: 0 },
    { name: REFRESH_COOKIE, value: "", maxAge: 0 },
  ];
}

/** Trang cần đăng nhập mà không có cookie phiên nào → về trang đăng nhập ngay, không render. */
export function requiresLogin(pathname: string): boolean {
  return /^\/(admin|mfa)(\/|$)/.test(pathname);
}
