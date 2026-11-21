import type { Session, Resource } from "./live-contracts";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfter?: string,
    /** Lỗi theo dòng/chỗ (vd. nhập file khách) — chỉ số dòng và thông báo, không chứa họ tên/SĐT. */
    public issues?: { rows: number[]; message: string }[],
  ) {
    super(message);
  }
}

/** Đọc `error.details.issues` của API (chỉ nhận đúng dạng {rows, message}, tối đa 300 mục). */
export function issuesFrom(details: unknown) {
  const raw = (details as { issues?: unknown } | null | undefined)?.issues;
  if (!Array.isArray(raw)) return undefined;
  const out: { rows: number[]; message: string }[] = [];
  for (const i of raw.slice(0, 300)) {
    const rows = (i as { rows?: unknown })?.rows;
    const message = (i as { message?: unknown })?.message;
    if (
      typeof message === "string" &&
      message.length <= 500 &&
      Array.isArray(rows) &&
      rows.length <= 50 &&
      rows.every((r) => Number.isInteger(r))
    )
      out.push({ rows: rows as number[], message });
  }
  return out.length ? out : undefined;
}
export const isPlatformAdmin = (session: Session) =>
  session.user.role === "PLATFORM_ADMIN" && session.user.operatorId === null;

/** Phiên hợp lệ của tài khoản nhà xe hoặc quản trị nền tảng (dùng cho đăng nhập, 2FA, đổi mật khẩu). */
export function assertSignedInSession(session: Session, allowSetup = false) {
  if (!isPlatformAdmin(session) && !session.user.operatorId)
    throw new ApiError(
      403,
      "OPERATOR_REQUIRED",
      "Khu quản trị này dành cho tài khoản thuộc nhà xe.",
    );
  if (!allowSetup && session.scope !== "full")
    throw new ApiError(
      403,
      "MFA_SETUP_REQUIRED",
      "Vui lòng hoàn tất xác thực hai yếu tố.",
    );
  return session;
}

/** Khu quản trị nền tảng: chỉ PLATFORM_ADMIN. */
export function assertPlatformSession(session: Session, allowSetup = false) {
  if (!isPlatformAdmin(session))
    throw new ApiError(
      403,
      "PLATFORM_REQUIRED",
      "Khu này dành cho quản trị nền tảng.",
    );
  return assertSignedInSession(session, allowSetup);
}

export function assertOperatorSession(session: Session, allowSetup = false) {
  if (session.user.role === "PLATFORM_ADMIN" || !session.user.operatorId)
    throw new ApiError(
      403,
      "OPERATOR_REQUIRED",
      "Khu quản trị này dành cho tài khoản thuộc nhà xe.",
    );
  if (!allowSetup && session.scope !== "full")
    throw new ApiError(
      403,
      "MFA_SETUP_REQUIRED",
      "Vui lòng hoàn tất xác thực hai yếu tố.",
    );
  return session;
}

export function hasPermission(session: Session, permission: string) {
  return (
    session.scope === "full" &&
    (session.permissions?.includes(permission) ?? session.user.role === "OWNER")
  );
}

export function requirePermission(session: Session, permission: string) {
  if (!hasPermission(session, permission))
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Bạn không có quyền thực hiện thao tác này.",
    );
}

export const resourcePermissions: Record<Resource, string> = {
  trips: "trip.read",
  payments: "payment.read",
  users: "user.manage",
  "audit-logs": "audit.read",
  "revenue-report": "payment.read",
  "bookings-report": "booking.read",
  counters: "trip.read",
  search: "trip.read",
};
/** Đường dẫn backend khác tên resource. */
const backendSegments: Partial<Record<Resource, string>> = {
  "revenue-report": "reports/revenue",
  "bookings-report": "reports/bookings",
};
const validDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
/** Khoảng `[from, to)` 1–366 ngày; ném lỗi 400 nếu sai. */
function dateRange(params: URLSearchParams) {
  const from = params.get("from") ?? "",
    to = params.get("to") ?? "";
  const span = Date.parse(to) - Date.parse(from);
  if (!validDate(from) || !validDate(to) || span <= 0 || span > 366 * 86400000)
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      "Khoảng xem phải từ 1 đến 366 ngày.",
    );
  return { from, to };
}
export function readPath(
  resource: Resource,
  operatorId: string,
  params: URLSearchParams,
) {
  const allowed: Record<Resource, string[]> = {
    payments: ["review"],
    users: [],
    trips: ["date", "from", "to", "limit", "cursor", "route"],
    "audit-logs": [],
    "revenue-report": ["from", "to"],
    "bookings-report": ["from", "to"],
    counters: [],
    search: ["q"],
  };
  if (!Object.hasOwn(allowed, resource))
    throw new ApiError(404, "NOT_FOUND", "Không tìm thấy dữ liệu.");
  for (const k of params.keys())
    if (!allowed[resource].includes(k))
      throw new ApiError(400, "VALIDATION_FAILED", "Bộ lọc không được hỗ trợ.");
  const query = new URLSearchParams();
  if (resource === "payments" && params.has("review")) {
    const review = params.get("review")!;
    if (!["NONE", "NEEDS_REVIEW", "RESOLVED"].includes(review))
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        "Trạng thái kiểm tra không hợp lệ.",
      );
    query.set("review", review);
  }
  if (resource === "revenue-report" || resource === "bookings-report") {
    const { from, to } = dateRange(params);
    query.set("from", from);
    query.set("to", to);
  }
  if (resource === "search") {
    const q = (params.get("q") ?? "").trim();
    if (q.length < 2 || q.length > 64)
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        "Nhập từ 2 đến 64 ký tự để tìm.",
      );
    query.set("q", q);
  }
  if (resource === "trips" && !params.has("date")) {
    const { from, to } = dateRange(params);
    if (params.has("route")) {
      const route = params.get("route")!;
      if (!/^[A-Z0-9-]{2,32}$/.test(route))
        throw new ApiError(400, "VALIDATION_FAILED", "Mã tuyến không hợp lệ.");
      query.set("route", route);
    }
    const limit = params.get("limit") ?? "25";
    if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100)
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        "Số hàng mỗi trang không hợp lệ.",
      );
    query.set("from", from);
    query.set("to", to);
    query.set("limit", limit);
    if (params.has("cursor")) {
      const cursor = params.get("cursor")!;
      if (cursor.length > 150)
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          "Vị trí phân trang không hợp lệ.",
        );
      query.set("cursor", cursor);
    }
  }
  if (resource === "trips" && params.has("date")) {
    if ([...params.keys()].some((k) => k !== "date"))
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        "Không kết hợp ngày với khoảng thời gian.",
      );
    const date = params.get("date");
    if (
      !date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        "Ngày phải có định dạng YYYY-MM-DD hợp lệ.",
      );
    query.set("date", date);
  }
  const segment = backendSegments[resource] ?? resource;
  return `/api/v1/admin/operators/${encodeURIComponent(operatorId)}/${segment}${query.size ? "?" + query.toString() : ""}`;
}
/**
 * Chống CSRF: Origin phải là dashboard và thân phải là kiểu form HTML không gửi được (JSON, hoặc ảnh khi tải logo) —
 * trình duyệt buộc preflight CORS cho các kiểu này nên trang khác không tự gửi được.
 */
export function checkOrigin(
  request: Request,
  configuredOrigin: string,
  contentTypes: readonly string[] = ["application/json"],
) {
  const base = new URL(configuredOrigin);
  const allowed = new Set([base.origin]);
  if (
    base.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(base.hostname)
  ) {
    const alias = new URL(base);
    alias.hostname = base.hostname === "localhost" ? "127.0.0.1" : "localhost";
    allowed.add(alias.origin);
  }
  const origin = request.headers.get("origin");
  if (
    !origin ||
    !allowed.has(origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new ApiError(
      403,
      "ORIGIN_REJECTED",
      "Yêu cầu không hợp lệ. Vui lòng mở lại trang đăng nhập.",
    );
  const type = request.headers.get("content-type")?.split(";")[0]?.trim();
  if (!type || !contentTypes.includes(type.toLowerCase()))
    throw new ApiError(
      415,
      "INVALID_CONTENT_TYPE",
      contentTypes.includes("application/json")
        ? "Yêu cầu phải dùng JSON."
        : "Định dạng tệp không được hỗ trợ.",
    );
}
