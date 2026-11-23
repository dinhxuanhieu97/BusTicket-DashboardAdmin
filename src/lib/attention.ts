import type { Counters } from "./live-contracts";

export type AttentionKey = "proofs" | "review" | "refunds" | "closing";
export type AttentionItem = {
  key: AttentionKey;
  count: number;
  label: string;
  href: string;
  /** Mở hộp danh sách ngay tại trang (ảnh chuyển khoản chờ kiểm) thay vì chuyển trang. */
  opens?: "proofs";
};

/** Việc cần chú ý từ `GET counters` cho chuông thông báo (GF2); mục bằng 0 không hiện, thứ tự cố định. */
export function attentionItems(c: Counters): AttentionItem[] {
  return [
    {
      // Khách đang chờ: đứng đầu (QS01).
      key: "proofs" as const,
      count: c.proofsPending ?? 0,
      label: "ảnh chuyển khoản chờ kiểm",
      href: "/admin/payments",
      opens: "proofs" as const,
    },
    {
      key: "review" as const,
      count: c.payments?.NEEDS_REVIEW ?? 0,
      label: "khoản thu cần đối soát",
      href: "/admin/payments",
    },
    {
      key: "refunds" as const,
      count: c.refundsOpen ?? 0,
      label: "khoản cần hoàn cho khách",
      href: "/admin/payments",
    },
    {
      key: "closing" as const,
      count: c.tripsClosingSoon,
      label: "chuyến đóng bán trong 2 giờ",
      href: "/admin/trips",
    },
  ].filter((i) => i.count > 0);
}

/**
 * Số ảnh chuyển khoản chờ kiểm tăng so với lần tải trước → bật thông báo (QS01). Lần tải đầu (`previous` null) không báo,
 * để mở Dashboard không hiện thông báo cho việc đã có từ trước.
 */
export const newProofs = (
  previous: number | null,
  current: number | null | undefined,
) =>
  previous !== null && current != null && current > previous
    ? current - previous
    : 0;

/** Tổng số việc trên chuông. */
export const attentionTotal = (c: Counters) =>
  attentionItems(c).reduce((t, i) => t + i.count, 0);

/** Số trên mục menu (khóa trong `nav.ts`): Sổ thu = khoản cần đối soát, Chuyến xe = chuyến sắp đóng bán. */
export function navBadges(c: Counters | null): Partial<Record<string, number>> {
  if (!c) return {};
  return {
    payments: c.payments?.NEEDS_REVIEW ?? 0,
    trips: c.tripsClosingSoon,
  };
}

/** Chữ trên huy hiệu: tối đa hai chữ số, lớn hơn thì "99+". */
export const badgeText = (n: number) => (n > 99 ? "99+" : String(n));

/** Mốc "đã đọc" của từng loại việc (lưu trên máy người xem). */
export type AttentionSeen = Partial<Record<AttentionKey, number>>;
export const ATTENTION_SEEN_KEY = "pnticket_attention_seen";

/** "Đánh dấu đã đọc tất cả": ghi nhận số việc hiện tại của từng loại. */
export const markAllSeen = (items: AttentionItem[]): AttentionSeen =>
  Object.fromEntries(items.map((i) => [i.key, i.count]));

/** Số việc mới kể từ lần đánh dấu đã đọc: loại nào tăng thì tính phần tăng thêm. */
export const unreadCount = (items: AttentionItem[], seen: AttentionSeen) =>
  items.reduce((t, i) => t + Math.max(0, i.count - (seen[i.key] ?? 0)), 0);

/**
 * Việc đã xử lý bớt thì hạ mốc theo, để việc phát sinh sau đó vẫn được tính là mới
 * (vd. đã đọc 5, xử lý còn 3, có thêm 1 → 1 việc mới). Trả về chính `seen` khi không đổi.
 */
export function settleSeen(
  items: AttentionItem[],
  seen: AttentionSeen,
): AttentionSeen {
  let changed = false;
  const next: AttentionSeen = {};
  for (const [key, value] of Object.entries(seen) as [AttentionKey, number][]) {
    const now = items.find((i) => i.key === key)?.count ?? 0;
    if (now < value) changed = true;
    if (Math.min(now, value) > 0) next[key] = Math.min(now, value);
    else if (value > 0) changed = true;
  }
  return changed ? next : seen;
}

/** Đọc mốc đã lưu; dữ liệu hỏng hoặc không đọc được thì coi như chưa đọc gì. */
export function parseSeen(raw: string | null): AttentionSeen {
  try {
    const v: unknown = raw ? JSON.parse(raw) : {};
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: AttentionSeen = {};
    for (const key of ["proofs", "review", "refunds", "closing"] as const) {
      const n = (v as Record<string, unknown>)[key];
      if (typeof n === "number" && Number.isInteger(n) && n > 0) out[key] = n;
    }
    return out;
  } catch {
    return {};
  }
}

/** Số việc mới của một loại kể từ lần đánh dấu đã đọc. */
export const unreadOf = (item: AttentionItem, seen: AttentionSeen) =>
  Math.max(0, item.count - (seen[item.key] ?? 0));

/** Nơi bấm vào sẽ mở, hiện dưới mỗi thông báo. */
export const attentionPlace = (item: AttentionItem) =>
  item.opens === "proofs"
    ? "Xem ảnh tại chỗ"
    : item.href.startsWith("/admin/payments")
      ? "Sổ thu"
      : item.href.startsWith("/admin/trips")
        ? "Chuyến xe"
        : "Mở trang xử lý";

/** Bấm vào một thông báo: chỉ loại việc đó được tính là đã đọc (ghi nhận số việc hiện tại). */
export const markSeen = (
  seen: AttentionSeen,
  item: AttentionItem,
): AttentionSeen => ({ ...seen, [item.key]: item.count });
