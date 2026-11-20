import { vnDateOf, type Payment } from "./live-contracts";
import { addDays } from "./overview";

export type RevenueDays = 7 | 30;
export type PaymentMethod = Payment["method"];

const vnHour = (value: string) =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(value)),
  );

/**
 * Báo cáo doanh thu tính từ danh sách khoản thu đã tải (API trả tối đa `limit` khoản mới nhất).
 * Ngày theo giờ Việt Nam của `receivedAt`, giống thẻ "Thu 7 ngày" ở Tổng quan.
 * Kỳ trước = `days` ngày liền trước kỳ hiện tại, xếp cùng chỉ số để vẽ nét đứt.
 * `complete*` = chắc chắn đủ dữ liệu: tập tải chưa chạm giới hạn, hoặc khoản cũ nhất đã trước đầu kỳ.
 */
export function revenueReport(
  payments: Payment[],
  today: string,
  days: RevenueDays,
  limit = 200,
) {
  const first = addDays(today, -(days - 1));
  const prevFirst = addDays(first, -days);
  const current = Array.from({ length: days }, (_, i) => ({
    date: addDays(first, i),
    amount: 0,
  }));
  const previous = Array.from({ length: days }, (_, i) => ({
    date: addDays(prevFirst, i),
    amount: 0,
  }));
  const index = new Map(
    [...current, ...previous].map((point) => [point.date, point]),
  );
  const methods: Record<PaymentMethod, number> = {
    BANK_TRANSFER: 0,
    MANUAL_BANK: 0,
    CASH: 0,
  };
  const hours = new Array<number>(24).fill(0);
  let count = 0;
  let oldest: string | null = null;

  for (const p of payments) {
    const date = vnDateOf(p.receivedAt);
    if (!oldest || date < oldest) oldest = date;
    const point = index.get(date);
    if (!point) continue;
    point.amount += p.amount;
    if (date >= first) {
      count += 1;
      methods[p.method] += p.amount;
      hours[vnHour(p.receivedAt)] += p.amount;
    }
  }

  const sum = (series: { amount: number }[]) =>
    series.reduce((total, point) => total + point.amount, 0);
  const total = sum(current);
  const previousTotal = sum(previous);
  const capped = payments.length >= limit;
  const completeCurrent = !capped || (oldest !== null && oldest < first);
  const completePrevious = !capped || (oldest !== null && oldest < prevFirst);
  const peak = Math.max(...hours);

  return {
    first,
    current,
    previous,
    total,
    previousTotal,
    /** % thay đổi so với kỳ trước; `null` khi kỳ trước thiếu dữ liệu hoặc bằng 0. */
    change:
      completePrevious && previousTotal > 0
        ? Math.round(((total - previousTotal) / previousTotal) * 1000) / 10
        : null,
    count,
    average: count ? Math.round(total / count) : 0,
    methods,
    /** Giờ (0–23, giờ VN) thu nhiều tiền nhất trong kỳ; `null` khi kỳ không có khoản nào. */
    peakHour: peak > 0 ? hours.indexOf(peak) : null,
    completeCurrent,
    completePrevious,
  };
}

/** Tỉ lệ phần trăm (làm tròn) của từng phần trên tổng; tổng 0 → mọi phần 0. */
export function shares<K extends string>(parts: Record<K, number>) {
  const total = Object.values<number>(parts).reduce((a, b) => a + b, 0);
  return Object.fromEntries(
    Object.entries<number>(parts).map(([k, v]) => [
      k,
      total ? Math.round((v / total) * 100) : 0,
    ]),
  ) as Record<K, number>;
}
