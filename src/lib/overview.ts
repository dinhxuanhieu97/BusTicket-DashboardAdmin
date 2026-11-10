import type { Trip } from "./live-contracts";

export const tripStates = [
  { status: "OPEN", label: "Đang mở bán", color: "#34d399" },
  { status: "DRAFT", label: "Bản nháp", color: "#818cf8" },
  { status: "CLOSED", label: "Đã đóng bán", color: "#fbbf24" },
  { status: "CANCELLED", label: "Đã hủy", color: "#fb7185" },
] as const;

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
    states: tripStates.map((state) => ({
      ...state,
      count: trips.filter((t) => t.status === state.status).length,
    })),
  };
}
