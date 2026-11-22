import type { TripStop } from "./trip-management";

export type RouteStops = { pickup: TripStop[]; dropoff: TripStop[] };

const cleanName = (name: string) =>
  name.normalize("NFC").trim().replace(/\s+/g, " ");

/**
 * Sắp điểm theo thứ tự xe chạy (ngày, rồi giờ); trùng giờ thì giữ thứ tự nhập.
 * API từ chối danh sách lệch giờ, nên dashboard tự sắp thay vì bắt nhập đúng thứ tự (RT5b).
 */
export function orderStops(list: readonly TripStop[]): TripStop[] {
  return list
    .map((stop, i) => ({ stop: { ...stop, name: cleanName(stop.name) }, i }))
    .sort(
      (a, b) =>
        a.stop.day - b.stop.day ||
        a.stop.time.localeCompare(b.stop.time) ||
        a.i - b.i,
    )
    .map((x) => x.stop);
}

/** Tên đầu tiên bị lặp trong một danh sách (không phân biệt hoa thường, khoảng trắng). */
export function duplicateStopName(list: readonly TripStop[]): string | null {
  const seen = new Set<string>();
  for (const stop of list) {
    const key = cleanName(stop.name).toLocaleLowerCase("vi");
    if (seen.has(key)) return cleanName(stop.name);
    seen.add(key);
  }
  return null;
}

/** Chuẩn bị điểm để lưu: sắp lại thứ tự; tên trùng thì báo lỗi (khách chọn điểm theo tên). */
export function prepareStops(
  stops: RouteStops,
): { ok: true; stops: RouteStops } | { ok: false; error: string } {
  for (const kind of ["pickup", "dropoff"] as const) {
    const dup = duplicateStopName(stops[kind]);
    if (dup)
      return {
        ok: false,
        error: `${kind === "pickup" ? "Điểm đón" : "Điểm trả"} "${dup}" bị trùng tên. Mỗi điểm cần một tên riêng.`,
      };
  }
  return {
    ok: true,
    stops: {
      pickup: orderStops(stops.pickup),
      dropoff: orderStops(stops.dropoff),
    },
  };
}

/** "17:00" hoặc "06:00 (+1 ngày)". */
export function stopTimeText(stop: TripStop) {
  return stop.day > 0 ? `${stop.time} (+${stop.day} ngày)` : stop.time;
}
