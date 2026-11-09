import { z } from "zod";

/** Giờ chạy mặc định của PN (giờ Việt Nam). Ngày lễ tết có thể khác: chỉnh tay khi tạo chuyến. */
export const PN_SCHEDULE = {
  depart: "17:30",
  arrive: "07:00",
  arriveDayOffset: 1,
};

const money = z.number().int().nonnegative().max(20_000_000);
const seatStatus = z.enum(["AVAILABLE", "HELD", "BOOKED", "BLOCKED"]);
export type SeatStatus = z.infer<typeof seatStatus>;

export const tripDetailSchema = z.object({
  trip: z.object({
    id: z.string().uuid(),
    name: z.string(),
    status: z.enum(["DRAFT", "OPEN", "CLOSED", "CANCELLED"]),
    departAt: z.string().datetime(),
    arriveAt: z.string().datetime().nullable(),
    salesOpenAt: z.string().datetime(),
    salesCloseAt: z.string().datetime(),
    contactPhone: z.string().nullable(),
    onSale: z.boolean(),
  }),
  route: z.object({
    code: z.string(),
    origin: z.string(),
    destination: z.string(),
  }),
  vehicle: z.object({
    code: z.string(),
    name: z.string(),
    plateNumber: z.string().nullable(),
    layoutChangedSinceTrip: z.boolean(),
  }),
  layout: z.object({
    code: z.string(),
    version: z.number().int().positive(),
    name: z.string(),
    unit: z.string(),
    kind: z.enum(["room", "bed", "seat"]),
    floors: z
      .array(
        z.object({
          code: z.string(),
          label: z.string(),
          rows: z.array(z.string()).max(30),
        }),
      )
      .min(1)
      .max(3),
  }),
  fares: z
    .array(
      z.object({
        floor: z.string(),
        floorLabel: z.string(),
        occupancy: z.union([z.literal(1), z.literal(2)]),
        price: money,
      }),
    )
    .max(6),
  seats: z
    .array(
      z.object({
        code: z.string(),
        floor: z.string(),
        maxOccupancy: z.union([z.literal(1), z.literal(2)]),
        sellable: z.boolean(),
        status: seatStatus,
        bookingCode: z.string().nullable(),
        holdExpiresAt: z.string().datetime().nullable(),
      }),
    )
    .max(200),
  summary: z.object({
    capacity: z.number().int().nonnegative(),
    available: z.number().int().nonnegative(),
    held: z.number().int().nonnegative(),
    booked: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
  }),
});
export type TripDetail = z.infer<typeof tripDetailSchema>;

export const seatStatusLabels: Record<SeatStatus, string> = {
  AVAILABLE: "Còn trống",
  HELD: "Đang giữ",
  BOOKED: "Đã đặt",
  BLOCKED: "Không bán",
};

export type MapCell =
  | { kind: "seat"; seat: TripDetail["seats"][number] }
  | { kind: "marker"; label: string }
  | { kind: "gap" };

const markers: Record<string, string> = { TX: "Tài xế", CUA: "Cửa", WC: "WC" };

/** Dựng lưới sơ đồ theo đúng hàng/cột trong định nghĩa đã chụp vào chuyến. */
export function seatGrid(detail: TripDetail) {
  const byCode = new Map(detail.seats.map((s) => [s.code, s]));
  return detail.layout.floors.map((floor) => ({
    code: floor.code,
    label: floor.label,
    rows: floor.rows.map((row) =>
      row
        .trim()
        .split(/\s+/)
        .map((token): MapCell => {
          const seat = byCode.get(token);
          if (seat && seat.floor === floor.code) return { kind: "seat", seat };
          if (markers[token]) return { kind: "marker", label: markers[token] };
          return { kind: "gap" };
        }),
    ),
  }));
}

/** Giờ tới: theo điểm trả cuối của tuyến; chưa khai báo → quy tắc mặc định PN (07:00 hôm sau). */
export function arrival(detail: TripDetail): {
  at: string;
  source: "route" | "default";
} {
  if (detail.trip.arriveAt)
    return { at: detail.trip.arriveAt, source: "route" };
  const vnDate = new Date(Date.parse(detail.trip.departAt) + 7 * 3600_000);
  vnDate.setUTCDate(vnDate.getUTCDate() + PN_SCHEDULE.arriveDayOffset);
  const day = vnDate.toISOString().slice(0, 10);
  return {
    at: new Date(`${day}T${PN_SCHEDULE.arrive}:00+07:00`).toISOString(),
    source: "default",
  };
}

/** Idempotency-Key gửi kèm khi tạo chuyến (8–100 ký tự chữ, số, "-", "_"). */
export const idempotencyKey = z.string().regex(/^[\w-]{8,100}$/);
