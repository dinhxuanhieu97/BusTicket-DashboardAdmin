import type { Counters } from "./live-contracts";

export type ReviewStatus = "NONE" | "NEEDS_REVIEW" | "RESOLVED";

/**
 * Số trên tab Sổ thu (GF12). Có `counters` → số chính xác của cả sổ thu. Backend cũ → đếm trong tập đã tải
 * (không lọc, tối đa `meta.limit` khoản) và `partial` khi chạm giới hạn để tab ghi thêm "+".
 * Chưa có dữ liệu nào → `undefined` (tab không hiện số).
 */
export function paymentTabCounts(
  exact: Counters["payments"],
  loaded: {
    payments: { review: { status: ReviewStatus } }[];
    meta: { limit: number };
  } | null,
): {
  count: (status?: ReviewStatus) => number | undefined;
  partial: boolean;
} {
  if (exact)
    return {
      count: (status) => (status ? exact[status] : exact.total),
      partial: false,
    };
  if (!loaded) return { count: () => undefined, partial: false };
  return {
    count: (status) =>
      loaded.payments.filter((p) => !status || p.review.status === status)
        .length,
    partial: loaded.payments.length >= loaded.meta.limit,
  };
}
