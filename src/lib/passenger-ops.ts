import { z } from "zod";
import { issueSchema } from "./staff-booking";

/**
 * Hợp đồng API vận hành hành khách (khớp `apps/api/src/bookings/passenger-ops.service.ts`): hủy đơn thay khách,
 * khoản cần hoàn, đánh dấu lên xe (nút, quét vé) và nhập lại file đã xuất (lên xe + thực thu trên xe).
 */
const BOOKING_CODE = /^[A-Za-z0-9]{4,12}$/;
const SEAT_CODE = /^[A-Z]{1,2}[1-9]\d?$/;

export const cancelInput = z
  .object({
    reason: z
      .string()
      .trim()
      .min(3, "Vui lòng ghi lý do hủy (ít nhất 3 ký tự).")
      .max(300, "Lý do tối đa 300 ký tự."),
    notifyCustomer: z.boolean().default(true),
  })
  .strict();
export type CancelInput = z.infer<typeof cancelInput>;

export const refundSchema = z.object({
  id: z.string(),
  /** CANCEL: hủy đơn đã thu tiền; ADJUST: khách trả dư sau khi đổi vé/giảm số đã thu. API cũ không có. */
  kind: z.enum(["CANCEL", "ADJUST"]).optional(),
  bookingCode: z.string(),
  amount: z.number().int(),
  reason: z.string(),
  status: z.enum(["OPEN", "REFUNDED", "WAIVED"]),
  createdAt: z.string(),
  createdBy: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  resolvedBy: z.string().nullable(),
  resolveNote: z.string().nullable(),
  contactName: z.string(),
  contactPhone: z.string(),
  contactErased: z.boolean(),
});
export type Refund = z.infer<typeof refundSchema>;
export const refundsSchema = z.object({
  refunds: z.array(refundSchema).max(200),
});
export const cancelResultSchema = z.object({
  booking: z.object({
    code: z.string(),
    status: z.string(),
    paidAmount: z.number().int(),
  }),
  refund: refundSchema.nullable(),
  alreadyCancelled: z.boolean(),
});
export type CancelResult = z.infer<typeof cancelResultSchema>;
export const resolveRefundInput = z
  .object({
    status: z.enum(["REFUNDED", "WAIVED"]),
    note: z.string().trim().max(300).optional(),
  })
  .strict();
export const refundResolveResultSchema = z.object({
  refund: refundSchema.nullable(),
  replayed: z.boolean(),
});

export const boardingInput = z
  .object({
    qr: z.string().trim().min(1).max(500).optional(),
    bookingCode: z
      .string()
      .trim()
      .regex(BOOKING_CODE, "Mã vé gồm 4–12 chữ hoặc số.")
      .transform((v) => v.toUpperCase())
      .optional(),
    seatCodes: z.array(z.string().regex(SEAT_CODE)).min(1).max(20).optional(),
    boarded: z.boolean().default(true),
  })
  .strict()
  .refine((v) => Boolean(v.qr) !== Boolean(v.bookingCode), {
    message: "Gửi mã QR hoặc mã vé.",
  });
export type BoardingInput = z.input<typeof boardingInput>;

export const boardingResultSchema = z.object({
  booking: z.object({
    code: z.string(),
    status: z.string(),
    contactName: z.string(),
    dueAmount: z.number().int(),
    seats: z.array(
      z.object({
        code: z.string(),
        occupancy: z.number().int(),
        boardedAt: z.string().nullable(),
      }),
    ),
  }),
  changed: z.number().int(),
});
export type BoardingResult = z.infer<typeof boardingResultSchema>;

/** Kết quả xem trước/ghi phần cập nhật (dòng có Mã vé) của file nhập lại. */
export const boardingPlanSchema = z.object({
  issues: z.array(issueSchema),
  updates: z
    .array(
      z.object({
        code: z.string(),
        rows: z.array(z.number().int()),
        boardSeats: z.array(z.string()),
        collectAmount: z.number().int(),
        dueAfter: z.number().int(),
      }),
    )
    .max(400),
  unchanged: z.number().int(),
  totals: z.object({
    bookings: z.number().int(),
    boardSeats: z.number().int(),
    collectAmount: z.number().int(),
  }),
  ok: z.boolean().optional(),
  replayed: z.boolean().optional(),
});
export type BoardingPlan = z.infer<typeof boardingPlanSchema>;

/** Nội dung QR trên vé hay mã vé gõ tay → thân request lên xe. */
export function boardingTarget(raw: string): BoardingInput | null {
  const v = raw.trim();
  if (!v) return null;
  if (/\/tickets\/[A-Z0-9]{4,12}\/verify\?/.test(v)) return { qr: v };
  return BOOKING_CODE.test(v) ? { bookingCode: v.toUpperCase() } : null;
}

export const refundStatusLabels: Record<Refund["status"], string> = {
  OPEN: "Chờ hoàn",
  REFUNDED: "Đã hoàn",
  WAIVED: "Không hoàn",
};

/** Sửa họ tên, SĐT, điểm đón/trả, ghi chú (`booking.update`). Chuỗi rỗng = xóa điểm đón/trả, ghi chú. */
export const bookingEditInput = z
  .object({
    contactName: z
      .string()
      .trim()
      .min(1, "Họ tên không được để trống.")
      .max(120, "Họ tên tối đa 120 ký tự.")
      .optional(),
    contactPhone: z
      .string()
      .trim()
      .min(1, "Nhập số điện thoại.")
      .max(30)
      .optional(),
    pickupStop: z.string().trim().max(160).nullable().optional(),
    dropoffStop: z.string().trim().max(160).nullable().optional(),
    note: z
      .string()
      .trim()
      .max(500, "Ghi chú tối đa 500 ký tự.")
      .nullable()
      .optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Chưa có thông tin nào để sửa.",
  });
export type BookingEditInput = z.input<typeof bookingEditInput>;

const stopPoint = z.object({
  name: z.string(),
  time: z.string(),
  day: z.number().int(),
});
export const bookingEditResultSchema = z.object({
  booking: z.object({
    code: z.string(),
    contactName: z.string(),
    contactPhone: z.string(),
    note: z.string().nullable(),
    pickupStop: stopPoint.nullable(),
    dropoffStop: stopPoint.nullable(),
  }),
  changed: z.array(z.string()),
});
export type BookingEditResult = z.infer<typeof bookingEditResultSchema>;

/**
 * Ghi nhận tiền khách trả cho một đơn (`payment.record`). Bán vé chỉ ghi tiền mặt; chuyển khoản thấy trong app
 * ngân hàng (cần mã giao dịch) chỉ chủ xe/kế toán — API kiểm tra vai trò.
 */
export const bookingPaymentInput = z
  .object({
    amount: z
      .number({ error: "Nhập số tiền." })
      .int("Số tiền phải là số nguyên.")
      .min(1, "Số tiền phải lớn hơn 0.")
      .max(2_000_000_000),
    method: z.enum(["CASH", "MANUAL_BANK"]),
    bankReference: z.string().trim().min(3).max(100).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((v) => v.method !== "MANUAL_BANK" || !!v.bankReference, {
    message: "Chuyển khoản cần mã giao dịch ngân hàng.",
    path: ["bankReference"],
  });
export type BookingPaymentInput = z.infer<typeof bookingPaymentInput>;
export const bookingPaymentResultSchema = z.object({
  id: z.string(),
  amount: z.number().int(),
  allocatedAmount: z.number().int().optional(),
  replayed: z.boolean().optional(),
});
