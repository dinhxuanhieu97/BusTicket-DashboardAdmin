import type { Trip } from "./live-contracts";

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
