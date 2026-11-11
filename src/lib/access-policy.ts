import type { Session, Resource } from "./live-contracts";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfter?: string,
  ) {
    super(message);
  }
}
export function assertOwner(session: Session, allowSetup = false) {
  if (session.user.role !== "OWNER" || !session.user.operatorId)
    throw new ApiError(
      403,
      "OWNER_REQUIRED",
      "Khu quản trị này chỉ dành cho tài khoản OWNER của nhà xe.",
    );
  if (!allowSetup && session.scope !== "full")
    throw new ApiError(
      403,
      "MFA_SETUP_REQUIRED",
      "Vui lòng hoàn tất xác thực hai yếu tố.",
    );
  return session;
}
export function readPath(
  resource: Resource,
  operatorId: string,
  params: URLSearchParams,
) {
  const allowed: Record<Resource, string[]> = {
    payments: ["review"],
    users: [],
    trips: ["date", "from", "to", "limit", "cursor"],
    "audit-logs": [],
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
  if (resource === "trips" && !params.has("date")) {
    const from = params.get("from") ?? "",
      to = params.get("to") ?? "";
    const valid = (v: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v;
    const span = Date.parse(to) - Date.parse(from);
    if (!valid(from) || !valid(to) || span <= 0 || span > 366 * 86400000)
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        "Khoảng xem phải từ 1 đến 366 ngày.",
      );
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
  return `/api/v1/admin/operators/${encodeURIComponent(operatorId)}/${resource}${query.size ? "?" + query.toString() : ""}`;
}
export function checkOrigin(request: Request, configuredOrigin: string) {
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
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError(415, "INVALID_CONTENT_TYPE", "Yêu cầu phải dùng JSON.");
}
