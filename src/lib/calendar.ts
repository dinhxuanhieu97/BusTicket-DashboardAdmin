/**
 * Hàm lịch thuần cho bộ chọn khoảng ngày. Ngày luôn ở dạng `YYYY-MM-DD` (lịch, không giờ, không múi giờ máy).
 */
import { addDays } from "./overview";

export type DateRangeValue = { from: string; to: string };

const parts = (d: string) =>
  d.split("-").map(Number) as [number, number, number];

/** Ngày đầu tháng (`YYYY-MM-01`) của ngày `d`. */
export const monthOf = (d: string) => `${d.slice(0, 7)}-01`;

/** Cộng `n` tháng vào tháng `month` (`YYYY-MM-01`). */
export function addMonths(month: string, n: number) {
  const [y, m] = parts(month);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}

/** 0 = Thứ Hai … 6 = Chủ nhật (tuần Việt Nam bắt đầu thứ Hai). */
export function weekdayMon(d: string) {
  const [y, m, day] = parts(d);
  return (new Date(Date.UTC(y, m - 1, day)).getUTCDay() + 6) % 7;
}

/** 42 ô (6 tuần) của tháng, bắt đầu thứ Hai; ô ngoài tháng có `inMonth: false`. */
export function monthGrid(month: string) {
  const start = addDays(month, -weekdayMon(month));
  const ym = month.slice(0, 7);
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i);
    return { date, inMonth: date.startsWith(ym) };
  });
}

/** Số ngày từ `from` đến `to`, tính cả hai đầu. */
export function spanDays(from: string, to: string) {
  return (
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86_400_000,
    ) + 1
  );
}

/** Hai đầu đã sắp xếp: bấm ngày kết thúc trước ngày bắt đầu thì đảo lại. */
export function orderedRange(a: string, b: string): DateRangeValue {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

/** `dd/mm/yyyy`. */
export const vnDate = (d: string) =>
  `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** "16/11/2026 – 22/11/2026", một ngày thì "16/11/2026". */
export const vnRange = (r: DateRangeValue) =>
  r.from === r.to ? vnDate(r.from) : `${vnDate(r.from)} – ${vnDate(r.to)}`;

/** "Thg 11 2026" như lịch của Shopee/Google. */
export const monthTitle = (month: string) =>
  `Thg ${Number(month.slice(5, 7))} ${month.slice(0, 4)}`;

const WEEKDAY_NAMES = [
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
  "Chủ nhật",
];
export const WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Nhãn đọc cho trình đọc màn hình: "Thứ Hai, 16 tháng 11 năm 2026". */
export function dayLabel(d: string) {
  const [y, m, day] = parts(d);
  return `${WEEKDAY_NAMES[weekdayMon(d)]}, ${day} tháng ${m} năm ${y}`;
}

/**
 * Ngày được chọn được không: trong `[min, max]` và, khi đang chọn đầu kia, không làm khoảng dài quá `maxDays`.
 */
export function dayDisabled(
  d: string,
  opts: {
    min?: string;
    max?: string;
    anchor?: string | null;
    maxDays?: number;
  },
) {
  if (opts.min && d < opts.min) return true;
  if (opts.max && d > opts.max) return true;
  if (opts.anchor && opts.maxDays) {
    const r = orderedRange(opts.anchor, d);
    if (spanDays(r.from, r.to) > opts.maxDays) return true;
  }
  return false;
}
