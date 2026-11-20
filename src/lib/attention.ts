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
