import { z } from "zod";

/**
 * Đổi chỗ / chuyến / tiền của đơn đã đặt (khớp `apps/api/src/bookings/booking-changes.service.ts`).
 * `booking.update` đổi chỗ/chuyến (giá tính lại theo bảng giá chuyến đích); chỉnh tay tổng tiền, cọc hoặc giảm
 * "đã thu" (tạo khoản cần hoàn) cần thêm `payment.manage`.
 */
const SEAT_CODE = /^[A-Z]{1,2}[1-9]\d?$/;
const MAX_MONEY = 2_000_000_000;
const money = z.number().int().min(0).max(MAX_MONEY);

export const bookingChangeInput = z
  .object({
    fromTripId: z.string().uuid().optional(),
    toTripId: z.string().uuid().optional(),
    items: z
      .array(
        z
          .object({
            seatCode: z.string().regex(SEAT_CODE),
            occupancy: z.number().int().min(1).max(2),
            infantCount: z.number().int().min(0).max(2),
          })
          .strict(),
      )
      .min(1, "Chọn ít nhất một chỗ.")
      .max(20)
      .optional(),
    totalAmount: money.optional(),
    depositAmount: money.optional(),
    refundAmount: z.number().int().min(1).max(MAX_MONEY).optional(),
    reason: z.string().trim().max(300, "Lý do tối đa 300 ký tự.").optional(),
    notifyCustomer: z.boolean().default(true),
  })
  .strict();
export type BookingChangeInput = z.input<typeof bookingChangeInput>;

/** Có trường tiền chỉnh tay → proxy kiểm thêm quyền `payment.manage`. */
export const touchesMoney = (b: BookingChangeInput) =>
  b.totalAmount !== undefined ||
  b.depositAmount !== undefined ||
  b.refundAmount !== undefined;

const stopPoint = z.object({
  name: z.string(),
  time: z.string(),
  day: z.number().int(),
});
const snapshot = z.object({
  tripId: z.string(),
  status: z.string(),
  seats: z.array(
    z.object({
      tripId: z.string(),
      seatCode: z.string(),
      occupancy: z.number().int(),
      infantCount: z.number().int(),
      lineTotal: z.number().int(),
    }),
  ),
  totalAmount: z.number().int(),
  depositAmount: z.number().int(),
  paidAmount: z.number().int(),
  dueAmount: z.number().int(),
  paymentStatus: z.string(),
  pickupStop: stopPoint.nullable(),
  dropoffStop: stopPoint.nullable(),
});
export type BookingSnapshot = z.infer<typeof snapshot>;
export const bookingChangeResultSchema = z.object({
  booking: snapshot.extend({ code: z.string() }),
  before: snapshot,
  changed: z.array(z.string()),
  refundAmount: z.number().int(),
  warnings: z.array(z.string()),
  replayed: z.boolean(),
});
export type BookingChangeResult = z.infer<typeof bookingChangeResultSchema>;

export interface ChangeSeat {
  seatCode: string;
  occupancy: number;
  infantCount: number;
}

/** "1.400.000", "1,400,000đ", "700000" → số; trống → undefined; không đọc được → NaN. */
export function parseMoney(raw: string): number | undefined {
  const s = raw.trim().replace(/\s|đ|₫/gi, "");
  if (!s) return undefined;
  if (/^\d+$/.test(s)) return Number(s);
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
  return NaN;
}

const seatKey = (xs: ChangeSeat[]) =>
  xs
    .map((x) => `${x.seatCode}:${x.occupancy}:${x.infantCount}`)
    .sort()
    .join("|");

/**
 * Dựng body gửi API từ trạng thái hộp sửa đơn. Trả `null` khi chưa có gì để đổi; ném Error (tiếng Việt) khi
 * số tiền nhập sai. Chỉ gửi `items` khi danh sách chỗ khác hiện tại — đổi chuyến mà giữ nguyên chỗ thì API tự
 * giữ mã chỗ, số người, số bé.
 */
export function buildChangeBody(s: {
  fromTripId: string;
  currentSeats: ChangeSeat[];
  toTripId: string;
  seats: ChangeSeat[];
  totalAmount: string;
  depositAmount: string;
  refundAmount: string;
  reason: string;
  notifyCustomer: boolean;
}): BookingChangeInput | null {
  const body: BookingChangeInput = { fromTripId: s.fromTripId };
  if (s.toTripId && s.toTripId !== s.fromTripId) body.toTripId = s.toTripId;
  if (seatKey(s.seats) !== seatKey(s.currentSeats)) {
    if (!s.seats.length) throw new Error("Chọn ít nhất một chỗ.");
    body.items = s.seats.map(({ seatCode, occupancy, infantCount }) => ({
      seatCode,
      occupancy,
      infantCount,
    }));
  }
  const fields = [
    ["totalAmount", s.totalAmount, "Tổng tiền"],
    ["depositAmount", s.depositAmount, "Tiền cọc"],
    ["refundAmount", s.refundAmount, "Số giảm đã thu"],
  ] as const;
  for (const [key, raw, label] of fields) {
    const v = parseMoney(raw);
    if (v === undefined) continue;
    if (!Number.isInteger(v) || v < 0 || v > MAX_MONEY)
      throw new Error(`${label} phải là số tiền hợp lệ (VND).`);
    if (key === "refundAmount" && v === 0) continue;
    body[key] = v;
  }
  if (!body.toTripId && !body.items && !touchesMoney(body)) return null;
  if (s.reason.trim()) body.reason = s.reason.trim();
  body.notifyCustomer = s.notifyCustomer;
  return body;
}

/** Nhãn thay đổi trả về từ API (dùng trong thông báo đã lưu). */
export const changeLabels: Record<string, string> = {
  trip: "đổi chuyến",
  seats: "đổi chỗ",
  totalAmount: "tổng tiền",
  depositAmount: "tiền cọc",
  paidAmount: "đã thu",
  status: "xác nhận vé",
  stops: "điểm đón/trả",
};
