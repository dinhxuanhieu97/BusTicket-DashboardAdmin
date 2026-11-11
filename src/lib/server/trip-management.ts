import "server-only";
import { operatorSession } from "./session";
import { assertTripManager } from "../trip-management";
import { backendRequest } from "../backend-client";
import {
  routesSchema,
  vehiclesSchema,
  layoutsSchema,
  layoutSchema,
  fareRequirements,
} from "../trip-management";
export async function tripManager() {
  const auth = await operatorSession();
  assertTripManager(auth.session, process.env.PNTICKET_TRIP_WRITE_OPERATOR_ID);
  return {
    ...auth,
    base: `/api/v1/admin/operators/${encodeURIComponent(auth.session.user.operatorId!)}`,
  };
}
export async function tripOptions(base: string, token: string) {
  const [r, v, l] = await Promise.all([
    backendRequest(base + "/routes", { token }),
    backendRequest(base + "/vehicles", { token }),
    backendRequest(base + "/seat-layouts", { token }),
  ]);
  const routes = routesSchema.parse(r).routes,
    vehicles = vehiclesSchema.parse(v).vehicles,
    layouts = layoutsSchema.parse(l).layouts;
  // Danh sách chỉ có bản mới nhất mỗi mẫu; xe còn gắn bản cũ → đọc đúng bản đó theo ID.
  const missing = [
    ...new Set(
      vehicles
        .filter((v) => v.status === "ACTIVE")
        .map((v) => v.seat_layout_id)
        .filter((id) => !layouts.some((l) => l.id === id)),
    ),
  ];
  for (const id of missing) {
    try {
      layouts.push(
        layoutSchema.parse(
          await backendRequest(
            base + "/seat-layouts/" + encodeURIComponent(id),
            { token },
          ),
        ).layout,
      );
    } catch {
      // API cũ chưa có endpoint hoặc sơ đồ không đọc được: xe giữ trạng thái chưa khả dụng.
    }
  }
  return {
    routes,
    vehicles: vehicles
      .filter((v) => v.status === "ACTIVE")
      .map((v) => {
        const layout = layouts.find((l) => l.id === v.seat_layout_id);
        const fares = layout ? fareRequirements(layout.definition) : [];
        return {
          ...v,
          layoutName: layout?.name ?? "Sơ đồ chưa khả dụng",
          fares,
          usable: fares.length > 0,
        };
      }),
  };
}
