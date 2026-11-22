/**
 * Đọc nối các trang theo `nextCursor` (API chuyến trả tối đa 100 chuyến/lần) và gộp `trips` (GF9).
 * Dừng ở `maxPages` trang; khi đó `nextCursor` của trang cuối còn giá trị để giao diện ghi "ít nhất".
 * Con trỏ lặp lại (API lỗi) cũng dừng để không gọi vô hạn.
 */
export async function collectPages<
  T extends { trips: unknown[]; nextCursor?: string | null },
>(fetchPage: (cursor: string | null) => Promise<T>, maxPages = 10): Promise<T> {
  let page = await fetchPage(null);
  const trips = [...page.trips];
  const seen = new Set<string>();
  for (let i = 1; i < maxPages && page.nextCursor; i++) {
    if (seen.has(page.nextCursor)) break;
    seen.add(page.nextCursor);
    page = await fetchPage(page.nextCursor);
    trips.push(...page.trips);
  }
  return { ...page, trips };
}

/** Thêm `cursor` vào đường dẫn đã có query (`trips?from=…`). */
export const withCursor = (path: string, cursor: string | null) =>
  cursor === null
    ? path
    : `${path}${path.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}`;
