import { z } from "zod";
import { ApiError, assertOwner } from "./access-policy";
import type { Session } from "./live-contracts";
export function canManageTrips(
  session: Session,
  operatorId: string | undefined,
) {
  return (
    !!operatorId &&
    session.user.operatorId === operatorId &&
    session.user.role === "OWNER" &&
    session.scope === "full" &&
    session.user.mfaEnabled
  );
}
export function assertTripManager(
  session: Session,
  operatorId: string | undefined,
) {
  assertOwner(session);
  if (!canManageTrips(session, operatorId))
    throw new ApiError(
      403,
      "TRIP_WRITE_DISABLED",
      "Nhà xe này chưa được mở quyền quản lý chuyến.",
    );
}
export function vnInputToISO(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Ngày giờ không hợp lệ.");
  const d = new Date(value + ":00+07:00");
  if (
    !Number.isFinite(d.getTime()) ||
    new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 16) !== value
  )
    throw new Error("Ngày giờ không hợp lệ.");
  return d.toISOString();
}
const instant = z.string().datetime();
export const createTripInput = z
  .object({
    routeId: z.string().uuid(),
    vehicleId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    contactPhone: z
      .string()
      .regex(/^(?:0|\+84)[35789]\d{8}$/)
      .optional(),
    departAt: instant,
    salesOpenAt: instant,
    salesCloseAt: instant,
    fares: z
      .array(
        z
          .object({
            floor: z.enum(["1", "2", "3"]),
            occupancy: z.union([z.literal(1), z.literal(2)]),
            price: z.number().int().min(0).max(20000000),
          })
          .strict(),
      )
      .min(1)
      .max(6),
    status: z.enum(["DRAFT", "OPEN"]),
  })
  .strict()
  .superRefine((v, c) => {
    if (!(v.salesOpenAt < v.salesCloseAt && v.salesCloseAt <= v.departAt))
      c.addIssue({ code: "custom", message: "Mở bán < đóng bán ≤ khởi hành." });
    if (
      new Set(v.fares.map((f) => `${f.floor}:${f.occupancy}`)).size !==
      v.fares.length
    )
      c.addIssue({ code: "custom", message: "Giá bị trùng." });
  });
export const statusInput = z
  .object({ status: z.enum(["OPEN", "CLOSED"]) })
  .strict();
export const tripWriteResult = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum(["DRAFT", "OPEN", "CLOSED", "CANCELLED"]),
  depart_at: z.string(),
});
export const routesSchema = z.object({
  routes: z.array(
    z.object({
      id: z.string().uuid(),
      code: z.string(),
      origin: z.string(),
      destination: z.string(),
    }),
  ),
});
export const vehiclesSchema = z.object({
  vehicles: z.array(
    z.object({
      id: z.string().uuid(),
      code: z.string(),
      name: z.string(),
      seat_layout_id: z.string().uuid(),
      status: z.enum(["ACTIVE", "MAINTENANCE", "RETIRED"]),
    }),
  ),
});
const definition = z.object({
  floors: z.array(
    z.object({
      code: z.enum(["1", "2", "3"]),
      label: z.string(),
      rows: z.array(z.string()),
    }),
  ),
  defaultMaxOccupancy: z.union([z.literal(1), z.literal(2)]).optional(),
  seatOverrides: z
    .record(
      z.string(),
      z.object({
        maxOccupancy: z.union([z.literal(1), z.literal(2)]).optional(),
        sellable: z.boolean().optional(),
      }),
    )
    .optional(),
});
const layoutItem = z.object({
  id: z.string().uuid(),
  name: z.string(),
  definition,
});
export const layoutsSchema = z.object({ layouts: z.array(layoutItem) });
export const layoutSchema = z.object({ layout: layoutItem });
export function fareRequirements(def: z.infer<typeof definition>) {
  return def.floors.flatMap((f) => {
    let max = 0;
    for (const token of f.rows.join(" ").split(/\s+/)) {
      if (!/^[A-Z]{1,2}[1-9]\d?$/.test(token)) continue;
      const o = def.seatOverrides?.[token];
      if (o?.sellable === false) continue;
      max = Math.max(max, o?.maxOccupancy ?? def.defaultMaxOccupancy ?? 1);
    }
    return Array.from({ length: max }, (_, i) => ({
      floor: f.code,
      occupancy: (i + 1) as 1 | 2,
      label: `${f.label} · ${i + 1} người`,
    }));
  });
}
export type TripOptions = {
  routes: z.infer<typeof routesSchema>["routes"];
  vehicles: (z.infer<typeof vehiclesSchema>["vehicles"][number] & {
    fares: ReturnType<typeof fareRequirements>;
    layoutName: string;
    usable: boolean;
  })[];
};
