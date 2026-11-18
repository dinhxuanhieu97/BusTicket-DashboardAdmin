import { z } from "zod";

/** Đội xe của nhà xe (khớp `apps/api/src/vehicles/vehicles.service.ts`). Quyền: `fleet.read` xem, `fleet.write` sửa. */
export const VEHICLE_TYPES = ["LIMOUSINE", "SLEEPER", "SEATER"] as const;
export const VEHICLE_STATUSES = ["ACTIVE", "MAINTENANCE", "RETIRED"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const vehicleTypeLabels: Record<VehicleType, string> = {
  LIMOUSINE: "Limousine (phòng)",
  SLEEPER: "Giường nằm",
  SEATER: "Ghế ngồi",
};
export const vehicleStatusLabels: Record<VehicleStatus, string> = {
  ACTIVE: "Đang chạy",
  MAINTENANCE: "Bảo trì",
  RETIRED: "Ngừng chạy",
};
/** Loại sơ đồ phải khớp loại xe (API kiểm tra lại). */
export const LAYOUT_KIND: Record<VehicleType, "room" | "bed" | "seat"> = {
  LIMOUSINE: "room",
  SLEEPER: "bed",
  SEATER: "seat",
};

export const fleetVehicleSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  type: z.enum(VEHICLE_TYPES),
  plate_number: z.string().nullable(),
  seat_layout_id: z.string().uuid(),
  status: z.enum(VEHICLE_STATUSES),
});
export const fleetVehiclesSchema = z.object({
  vehicles: z.array(fleetVehicleSchema).max(500),
});
export const fleetLayoutsSchema = z.object({
  layouts: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        kind: z.enum(["room", "bed", "seat"]),
        capacity: z.number().int().nonnegative().optional(),
        /** Sơ đồ mẫu chung của nền tảng (không thuộc riêng nhà xe). */
        shared: z.boolean().optional(),
      }),
    )
    .max(500),
});
export type FleetVehicle = z.infer<typeof fleetVehicleSchema>;
export type FleetLayout = z.infer<typeof fleetLayoutsSchema>["layouts"][number];

/** Mã xe = mã nhà xe + 2–3 chữ số (vd. PN03); gợi ý mã kế tiếp chưa dùng. */
export function nextVehicleCode(
  prefix: string,
  vehicles: readonly { code: string }[],
) {
  const used = new Set(vehicles.map((v) => v.code));
  for (let n = 1; n < 1000; n++) {
    const code = `${prefix}${String(n).padStart(2, "0")}`;
    if (!used.has(code)) return code;
  }
  return "";
}

export const vehicleCodePattern = (prefix: string) =>
  new RegExp(`^${prefix.replace(/[^A-Z]/g, "")}\\d{2,3}$`);
