import type { Counters } from "./live-contracts";

export type AttentionKey = "review" | "refunds" | "closing";
export type AttentionItem = {
  key: AttentionKey;
  count: number;
  label: string;
  href: string;
};

/** Việc cần chú ý từ `GET counters` cho chuông thông báo (GF2); mục bằng 0 không hiện, thứ tự cố định. */
export function attentionItems(c: Counters): AttentionItem[] {
  return [
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
    for (const key of ["review", "refunds", "closing"] as const) {
      const n = (v as Record<string, unknown>)[key];
      if (typeof n === "number" && Number.isInteger(n) && n > 0) out[key] = n;
    }
    return out;
  } catch {
    return {};
  }
}
