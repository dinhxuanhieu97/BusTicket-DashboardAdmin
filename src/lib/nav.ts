/** Mục menu quản trị và quyền cần có (khớp `apps/api/src/auth/permissions.ts`). */
export type NavKey =
  | "schedules"
  | "assigned"
  | "overview"
  | "payments"
  | "users"
  | "fleet"
  | "routes"
  | "trips"
  | "passengers"
  | "audit"
  | "settings"
  | "revenue"
  | "seats"
  | "help";

export const NAV: {
  key: NavKey;
  href: string;
  label: string;
  /** Nhãn ngắn cho thanh dưới trên điện thoại (tên đầy đủ vẫn là tên truy cập). */
  short?: string;
  perm?: string;
  /** Ẩn mục khi người dùng đã có quyền này (vd. phụ xe thấy "Chuyến được giao", người xem mọi chuyến thì không). */
  hideWith?: string;
}[] = [
  {
    key: "assigned",
    href: "/admin/assigned-trips",
    label: "Chuyến được giao",
    short: "Được giao",
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
  {
    key: "fleet",
    href: "/admin/vehicles",
    label: "Đội xe",
    perm: "fleet.read",
  },
  {
    key: "routes",
    href: "/admin/routes",
    label: "Tuyến đường",
    perm: "route.read",
  },
  {
    key: "trips",
    href: "/admin/trips",
    label: "Chuyến xe",
    short: "Chuyến",
    perm: "trip.read",
  },
  // Danh sách khách theo chuyến: họ tên, SĐT, chỗ, tiền còn thu.
  {
    key: "passengers",
    href: "/admin/passengers",
    label: "Hành khách",
    short: "Khách",
    perm: "booking.read",
  },
  {
    key: "audit",
    href: "/admin/audit-logs",
    label: "Nhật ký",
    perm: "audit.read",
  },
  { key: "settings", href: "/admin/settings", label: "Cài đặt" },
  // Báo cáo tính từ sổ thu nên dùng chung quyền xem sổ thu.
  {
    key: "revenue",
    href: "/admin/revenue",
    label: "Doanh thu",
    perm: "payment.read",
  },
  // Sơ đồ chỗ theo chuyến; bán tại quầy còn cần booking.create.
  {
    key: "seats",
    href: "/admin/seats",
    label: "Sơ đồ chỗ",
    short: "Chỗ",
    perm: "trip.read",
  },
  { key: "help", href: "/admin/help", label: "Trợ giúp" },
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

export type NavItem = (typeof NAV)[number];

/** Nhóm trên thanh bên, theo việc nhân viên đang làm. Mỗi mục `NAV` thuộc đúng một nhóm. */
export const NAV_GROUPS: { id: string; title: string; keys: NavKey[] }[] = [
  {
    id: "ops",
    title: "Vận hành",
    keys: [
      "assigned",
      "overview",
      "trips",
      "seats",
      "passengers",
      "schedules",
      "fleet",
      "routes",
    ],
  },
  { id: "finance", title: "Tài chính", keys: ["payments", "revenue"] },
  {
    id: "manage",
    title: "Quản lý",
    keys: ["users", "audit", "settings", "help"],
  },
];

/** Xếp các mục đã lọc theo quyền vào nhóm; bỏ nhóm không còn mục nào. */
export function groupNav<T extends { key: NavKey }>(items: readonly T[]) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.keys.flatMap((key) => items.filter((i) => i.key === key)),
  })).filter((group) => group.items.length > 0);
}

/**
 * Mục không đặt trong danh sách thanh bên mà mở từ menu tài khoản (avatar) — vẫn tìm được bằng ⌘K.
 * Giữ thanh bên ngắn để màn thấp không phải cuộn (GF18).
 */
export const ACCOUNT_MENU_KEYS: readonly NavKey[] = ["help"];

/** Nhóm cho danh sách thanh bên: bỏ các mục đã chuyển vào menu tài khoản. */
export function sidebarGroups<T extends { key: NavKey }>(
  groups: readonly { id: string; title: string; items: T[] }[],
) {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !ACCOUNT_MENU_KEYS.includes(i.key)),
    }))
    .filter((g) => g.items.length > 0);
}

/** Thứ tự ưu tiên cho thanh điều hướng dưới trên điện thoại; mục còn lại nằm trong "Thêm". */
const MOBILE_PRIORITY: NavKey[] = [
  "overview",
  "assigned",
  "trips",
  "passengers",
  "payments",
  "settings",
];

/** Tối đa `limit` mục cho thanh dưới, chọn theo `MOBILE_PRIORITY` trong các mục được phép. */
export function mobileNav<T extends { key: NavKey }>(
  items: readonly T[],
  limit = 4,
) {
  return MOBILE_PRIORITY.flatMap((key) =>
    items.filter((i) => i.key === key),
  ).slice(0, limit);
}
