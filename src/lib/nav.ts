/** Mục menu quản trị và quyền cần có (khớp `apps/api/src/auth/permissions.ts`). */
export type NavKey =
  | "schedules"
  | "assigned"
  | "overview"
  | "payments"
  | "users"
  | "trips"
  | "audit"
  | "settings";

export const NAV: {
  key: NavKey;
  href: string;
  label: string;
  perm?: string;
  /** Ẩn mục khi người dùng đã có quyền này (vd. phụ xe thấy "Chuyến được giao", người xem mọi chuyến thì không). */
  hideWith?: string;
}[] = [
  {
    key: "assigned",
    href: "/admin/assigned-trips",
    label: "Chuyến được giao",
    perm: "trip.assigned.read",
    hideWith: "trip.read",
  },
  {
    key: "schedules",
    href: "/admin/schedules",
    label: "Lịch tự động",
    perm: "trip.write",
  },
  // Trang tổng quan hiển thị danh sách chuyến.
  {
    key: "overview",
    href: "/admin",
    label: "Tổng quan",
    perm: "trip.read",
  },
  {
    key: "payments",
    href: "/admin/payments",
    label: "Sổ thu",
    perm: "payment.read",
  },
  {
    key: "users",
    href: "/admin/users",
    label: "Nhân viên",
    perm: "user.manage",
  },
  { key: "trips", href: "/admin/trips", label: "Chuyến xe", perm: "trip.read" },
  {
    key: "audit",
    href: "/admin/audit-logs",
    label: "Nhật ký",
    perm: "audit.read",
  },
  { key: "settings", href: "/admin/settings", label: "Cài đặt" },
];

/**
 * Menu theo quyền máy chủ trả trong `/auth/me`. Đây chỉ là hiển thị — mỗi API vẫn kiểm tra quyền.
 * `undefined` = API cũ chưa trả `permissions` → giữ menu đầy đủ như trước (chỉ OWNER vào được dashboard).
 */
export function visibleNav(permissions: readonly string[] | undefined) {
  if (!permissions) return NAV.filter((item) => !item.hideWith);
  const granted = new Set(permissions);
  return NAV.filter(
    (item) =>
      (!item.perm || granted.has(item.perm)) &&
      !(item.hideWith && granted.has(item.hideWith)),
  );
}
