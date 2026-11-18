/** Một điểm đi/đến và số tuyến dùng nó (khớp `PUT places` của API: đổi tên trên mọi tuyến). */
export interface PlaceUsage {
  name: string;
  asOrigin: number;
  asDestination: number;
}

/** Gom điểm đi/đến từ danh sách tuyến, sắp theo tên tiếng Việt. */
export function listPlaces(
  routes: readonly { origin: string; destination: string }[],
): PlaceUsage[] {
  const map = new Map<string, PlaceUsage>();
  const at = (name: string) => {
    let p = map.get(name);
    if (!p) map.set(name, (p = { name, asOrigin: 0, asDestination: 0 }));
    return p;
  };
  for (const r of routes) {
    at(r.origin).asOrigin++;
    at(r.destination).asDestination++;
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
}
