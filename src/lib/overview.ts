import {
  vnDateOf,
  type BookingsReport,
  type Payment,
  type Trip,
} from "./live-contracts";

export const tripStates = {
  OPEN: { label: "Đang mở bán", tone: "success", color: "var(--success)" },
  DRAFT: { label: "Bản nháp", tone: "neutral", color: "var(--muted)" },
  CLOSED: { label: "Đã đóng bán", tone: "warning", color: "var(--warning)" },
  CANCELLED: { label: "Đã hủy", tone: "danger", color: "var(--danger)" },
} as const satisfies Record<
  Trip["status"],
  { label: string; tone: string; color: string }
>;

export function overviewMetrics(trips: Trip[]) {
  const open = trips.filter((t) => t.status === "OPEN");
  const routes = new Map<
    string,
    { route: string; available: number; capacity: number }
  >();
  for (const trip of open) {
    const row = routes.get(trip.route_code) ?? {
      route: trip.route_code,
      available: 0,
      capacity: 0,
    };
    row.available += trip.available;
    row.capacity += trip.capacity;
    routes.set(row.route, row);
  }
  return {
    total: trips.length,
    open: open.length,
    available: open.reduce((sum, t) => sum + t.available, 0),
    drafts: trips.filter((t) => t.status === "DRAFT").length,
    routes: [...routes.values()].sort((a, b) => a.route.localeCompare(b.route)),
    states: Object.entries(tripStates).map(([status, state]) => ({
      status,
      ...state,
      count: trips.filter((t) => t.status === status).length,
    })),
  };
}

/** Cộng `days` ngày vào ngày dạng YYYY-MM-DD (lịch, không phụ thuộc múi giờ máy). */
export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Lời chào theo giờ Việt Nam (0–23). */
export function greeting(hour: number) {
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

/**
 * Lấp đầy của các chuyến đang/đã bán (OPEN, CLOSED): chỗ đã bán = sức chứa − còn trống.
 * Bản nháp và chuyến hủy không tính. Không có sức chứa → `pct` là null (không bịa 0%).
 */
export function seatFill(trips: Trip[]) {
  const selling = trips.filter(
    (t) => t.status === "OPEN" || t.status === "CLOSED",
  );
  const capacity = selling.reduce((sum, t) => sum + Math.max(0, t.capacity), 0);
  const sold = selling.reduce(
    (sum, t) =>
      sum + Math.min(Math.max(0, t.capacity - t.available), t.capacity),
    0,
  );
  return {
    trips: selling.length,
    capacity,
    sold,
    free: capacity - sold,
    pct: capacity > 0 ? sold / capacity : null,
  };
}

/** Chuyến đang mở bán khởi hành sớm nhất sau `now`. */
export function nextDeparture(trips: Trip[], now: Date) {
  return (
    trips
      .filter(
        (t) => t.status === "OPEN" && Date.parse(t.depart_at) > now.getTime(),
      )
      .sort((a, b) => Date.parse(a.depart_at) - Date.parse(b.depart_at))[0] ??
    null
  );
}

/**
 * Tiền thu theo ngày (giờ VN) trong `days` ngày tới `today`, từ danh sách khoản thu mới nhất.
 * API chỉ trả tối đa `limit` khoản: khi chạm giới hạn mà khoản cũ nhất vẫn nằm trong khoảng,
 * các ngày đầu có thể thiếu → `complete = false` để giao diện ghi "ít nhất".
 */
export function paymentStats(
  payments: Payment[],
  today: string,
  days = 7,
  limit = 200,
) {
  const first = addDays(today, -(days - 1));
  const series = Array.from({ length: days }, (_, i) => ({
    date: addDays(first, i),
    amount: 0,
  }));
  const byDate = new Map(series.map((p) => [p.date, p]));
  let oldest: string | null = null;
  for (const p of payments) {
    const date = vnDateOf(p.receivedAt);
    if (!oldest || date < oldest) oldest = date;
    const point = byDate.get(date);
    if (point) point.amount += p.amount;
  }
  return {
    today: byDate.get(today)!.amount,
    series,
    needsReview: payments.filter((p) => p.review.status === "NEEDS_REVIEW")
      .length,
    complete: payments.length < limit || (oldest !== null && oldest < first),
  };
}

/**
 * Vé bán (số chỗ của đơn đã xác nhận) hôm nay so với hôm qua và tỷ lệ hủy của kỳ, từ `reports/bookings`
 * (ngày theo ngày tạo đơn, giờ VN). `change` = `null` khi hôm qua không bán chỗ nào.
 */
export function salesStats(report: BookingsReport, today: string) {
  const seatsOn = (date: string) =>
    report.byDay.find((d) => d.date === date)?.seats ?? 0;
  const seatsToday = seatsOn(today);
  const seatsYesterday = seatsOn(addDays(today, -1));
  return {
    seatsToday,
    seatsYesterday,
    roundTripsToday:
      report.byDay.find((d) => d.date === today)?.roundTrips ?? 0,
    change: seatsYesterday
      ? Math.round(((seatsToday - seatsYesterday) / seatsYesterday) * 100)
      : null,
    series: report.byDay.map((d) => d.seats),
    cancelRate: report.totals.cancelRate,
    cancelled: report.totals.cancelled,
    bookings: report.totals.bookings,
  };
}

/**
 * Thẻ tiền của Tổng quan từ API báo cáo (GF8): `today` = thu thuần của ngày cuối kỳ (kỳ kết thúc hôm nay),
 * chuỗi 7 ngày theo thu thuần, luôn đủ dữ liệu (không giới hạn 200 khoản).
 */
export function reportMoney(
  report: { byDay: { date: string; net: number }[] },
  needsReview: number,
) {
  return {
    today: report.byDay.at(-1)?.net ?? 0,
    series: report.byDay.map((d) => ({ date: d.date, amount: d.net })),
    needsReview,
    complete: true,
    net: true,
  };
}

/** Tỷ lệ hủy (0–1) → "12,5" (một chữ số thập phân, dấu phẩy VN); chưa có đơn → `null`. */
export function cancelPercent(rate: number | null) {
  return rate === null
    ? null
    : (Math.round(rate * 1000) / 10).toLocaleString("vi-VN");
}

/** Ngưỡng cảnh báo tỷ lệ hủy (từ 10%). */
export const CANCEL_WARN = 0.1;

/** Dòng so sánh với hôm qua của thẻ "Vé bán hôm nay"; vé khứ hồi tính 2 vé, lượt đi và lượt về (GB4). */
export function salesChangeText(s: {
  change: number | null;
  seatsYesterday: number;
  roundTripsToday?: number;
}) {
  const round = s.roundTripsToday ? ` · ${s.roundTripsToday} vé khứ hồi` : "";
  if (s.change === null) return `Hôm qua ${s.seatsYesterday} vé${round}`;
  if (s.change === 0) return `Bằng hôm qua (${s.seatsYesterday})${round}`;
  return `${s.change > 0 ? "↑" : "↓"} ${Math.abs(s.change)}% so với hôm qua (${s.seatsYesterday})${round}`;
}

/** Số tiền gọn cho thẻ: 1,25 tr / 1,94 tỷ / 850.000. */
export function shortVnd(value: number) {
  // Thu thuần có thể âm (GF17): chọn đơn vị theo độ lớn.
  const f = (n: number) =>
    n.toLocaleString("vi-VN", {
      maximumFractionDigits: Math.abs(n) < 10 ? 2 : 1,
    });
  const size = Math.abs(value);
  if (size >= 1e9) return { value: f(value / 1e9), unit: "tỷ ₫" };
  if (size >= 1e6) return { value: f(value / 1e6), unit: "tr ₫" };
  return { value: value.toLocaleString("vi-VN"), unit: "₫" };
}

const topbarFormat = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Ho_Chi_Minh",
});

/** Ngày giờ ở thanh trên theo giờ Việt Nam: "Thứ Bảy, 21/11/2026 · 12:08". */
export function topbarDateTime(d: Date) {
  const p = Object.fromEntries(
    topbarFormat.formatToParts(d).map((x) => [x.type, x.value]),
  );
  const weekday = p.weekday.charAt(0).toUpperCase() + p.weekday.slice(1);
  return `${weekday}, ${p.day}/${p.month}/${p.year} · ${p.hour}:${p.minute}`;
}
