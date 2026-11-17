import { z } from "zod";
import type { TripDetail } from "./trip-detail";

/**
 * Cấp lại chỗ cho khoản tiền về muộn (LATE) — chốt 17/11/2026: mặc định chọn sẵn chỗ cũ nếu còn trống;
 * nhân viên đổi được sang chỗ khác cùng chuyến hoặc chuyến khác. Máy chủ tính giá chính thức.
 */
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const reinstateContextSchema = z.object({
  paymentId: z.string().uuid(),
  unallocatedAmount: money,
  eligible: z.boolean(),
  booking: z.object({
    code: z.string(),
    status: z.string(),
    previousTotal: money,
    paidAmount: money,
    pickupStop: z.string().nullable(),
    dropoffStop: z.string().nullable(),
  }),
  legs: z
    .array(
      z.object({
        tripId: z.string().uuid(),
        tripName: z.string(),
        tripCode: z.string().nullable(),
        departAt: z.string(),
        departed: z.boolean(),
        cancelled: z.boolean(),
        seats: z.array(
          z.object({
            seatCode: z.string(),
            occupancy: z.number().int().min(1).max(2),
            infantCount: z.number().int().min(0).max(2),
            available: z.boolean(),
          }),
        ),
      }),
    )
    .max(2),
});
export type ReinstateContext = z.infer<typeof reinstateContextSchema>;

export const reinstateResultSchema = z.object({
  booking: z.object({
    code: z.string(),
    status: z.enum(["CONFIRMED", "HOLDING"]),
    totalAmount: money,
    depositAmount: money,
    paidAmount: money,
    paymentStatus: z.string(),
    holdExpiresAt: z.string().nullable(),
  }),
});
export type ReinstateResult = z.infer<typeof reinstateResultSchema>;

export interface PickedSeat {
  seatCode: string;
  occupancy: number;
  infantCount: number;
}

export interface LegChoice {
  tripId: string;
  seats: PickedSeat[];
}

/** Lựa chọn ban đầu: chuyến cũ + các chỗ cũ còn trống (chuyến đã chạy/hủy thì để trống để nhân viên chọn chuyến khác). */
export function initialChoices(ctx: ReinstateContext): LegChoice[] {
  return ctx.legs.map((leg) => ({
    tripId: leg.tripId,
    seats:
      leg.departed || leg.cancelled
        ? []
        : leg.seats
            .filter((s) => s.available)
            .map(({ seatCode, occupancy, infantCount }) => ({
              seatCode,
              occupancy,
              infantCount,
            })),
  }));
}

/** Chỗ chọn được trên sơ đồ: còn trống, hoặc vẫn đang gắn với chính đơn này. */
export function selectable(
  seat: TripDetail["seats"][number],
  bookingCode: string,
) {
  return (
    seat.sellable &&
    (seat.status === "AVAILABLE" || seat.bookingCode === bookingCode)
  );
}

/** Bật/tắt một chỗ; chỗ mới mặc định 1 người, giữ số trẻ em nếu là chỗ cũ của đơn. */
export function toggleSeat(
  picked: PickedSeat[],
  seatCode: string,
  previous: PickedSeat[] = [],
): PickedSeat[] {
  if (picked.some((s) => s.seatCode === seatCode))
    return picked.filter((s) => s.seatCode !== seatCode);
  const old = previous.find((s) => s.seatCode === seatCode);
  return [
    ...picked,
    old ? { ...old } : { seatCode, occupancy: 1, infantCount: 0 },
  ].sort((a, b) =>
    a.seatCode.localeCompare(b.seatCode, "vi", { numeric: true }),
  );
}

/** Tạm tính theo bảng giá chuyến (chưa gồm phụ thu trẻ em); `null` khi thiếu giá cho một chỗ. */
export function estimateLeg(
  detail: Pick<TripDetail, "seats" | "fares">,
  seats: PickedSeat[],
): number | null {
  let total = 0;
  for (const s of seats) {
    const seat = detail.seats.find((x) => x.code === s.seatCode);
    const fare =
      seat &&
      detail.fares.find(
        (f) => f.floor === seat.floor && f.occupancy === s.occupancy,
      );
    if (!fare) return null;
    total += fare.price;
  }
  return total;
}

/** Tiền dư (>0, sẽ ở hàng chờ để hoàn) hoặc thiếu (<0, khách chuyển thêm) so với giá mới. */
export function balance(ctx: ReinstateContext, newTotal: number) {
  return ctx.booking.paidAmount + ctx.unallocatedAmount - newTotal;
}

export function requestBody(choices: LegChoice[], note: string) {
  return {
    legs: choices.map((c) => ({
      tripId: c.tripId,
      items: c.seats.map(({ seatCode, occupancy, infantCount }) => ({
        seatCode,
        occupancy,
        infantCount,
      })),
    })),
    ...(note.trim() ? { note: note.trim().slice(0, 500) } : {}),
  };
}
