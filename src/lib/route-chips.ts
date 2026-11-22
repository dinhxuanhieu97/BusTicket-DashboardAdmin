/**
 * Chip lọc tuyến ở trang Chuyến xe (GF13).
 * - `routes`: tuyến đã thấy trong kỳ + tuyến của trang đang tải + tuyến đang chọn (để chip không biến mất khi
 *   đang lọc, kể cả sau khi đổi ngày làm danh sách đã thấy bị xóa).
 * - `show`: có từ hai tuyến, hoặc đang lọc một tuyến (luôn có chip "Tất cả tuyến" để bỏ lọc).
 * - `rows`: backend đã lọc (`serverFiltered`) thì giữ nguyên; backend cũ thì lọc trong trang đã tải.
 */
export function routeChips<T extends { route_code: string }>(input: {
  known: string[];
  loaded: T[];
  selected: string;
  serverFiltered: boolean;
}) {
  const { known, loaded, selected, serverFiltered } = input;
  const routes = [
    ...new Set([
      ...known,
      ...loaded.map((t) => t.route_code),
      ...(selected ? [selected] : []),
    ]),
  ].sort();
  return {
    routes,
    active: selected,
    show: routes.length > 1 || selected !== "",
    rows:
      selected && !serverFiltered
        ? loaded.filter((t) => t.route_code === selected)
        : loaded,
  };
}
