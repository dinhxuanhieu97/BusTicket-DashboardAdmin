/**
 * Ẩn thanh trên cùng và thanh điều hướng dưới khi cuộn xuống, hiện lại khi cuộn lên.
 * Gần đầu trang và khi chạm cuối trang luôn hiện (đọc hết trang thường cần chuyển trang tiếp);
 * cuộn ít hơn `threshold` px không đổi trạng thái (tránh nháy khi tay rung).
 */
export const SCROLL_THRESHOLD = 8;
export const TOP_ZONE = 64;

export type ScrollChrome = { hidden: boolean; anchor: number };

/** `anchor` là vị trí lần đổi hướng gần nhất; chỉ dời khi đã cuộn quá ngưỡng. */
export function nextScrollChrome(
  prev: ScrollChrome,
  y: number,
  threshold = SCROLL_THRESHOLD,
  topZone = TOP_ZONE,
  atBottom = false,
): ScrollChrome {
  if (y <= topZone) return { hidden: false, anchor: Math.max(y, 0) };
  if (atBottom) return { hidden: false, anchor: y };
  const delta = y - prev.anchor;
  if (Math.abs(delta) < threshold) return prev;
  return { hidden: delta > 0, anchor: y };
}
