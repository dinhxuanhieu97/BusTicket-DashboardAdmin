import { z } from "zod";
import { stopPointSchema } from "./trip-detail";

/**
 * Bán vé tại quầy (C1) và nhập danh sách khách mới từ file (B3).
 * Khớp `apps/api/src/bookings/staff-bookings.service.ts`; quyền `booking.create`.
 */
export const MAX_COUNTER_SEATS = 20;
export const MAX_IMPORT_ROWS = 200;
/** Tệp Excel tải lên tối đa 2 MB. */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const money = z.number().int().min(0).max(2_000_000_000);

/** Thân JSON trình duyệt gửi khi bán tại quầy (dưới 4 KB, giới hạn của proxy). */
export const counterInput = z
  .object({
    contactName: z.string().trim().min(1).max(120),
    contactPhone: z.string().trim().min(8).max(20),
    note: z.string().trim().max(500).optional(),
    pickupStop: z.string().trim().max(160).optional(),
    dropoffStop: z.string().trim().max(160).optional(),
    items: z
      .array(
        z
          .object({
            seatCode: z.string().regex(/^[A-Z]{1,2}[1-9]\d?$/),
            occupancy: z.union([z.literal(1), z.literal(2)]),
            infantCount: z.number().int().min(0).max(2),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_COUNTER_SEATS)
      .refine(
        (items) => new Set(items.map((i) => i.seatCode)).size === items.length,
      ),
    paidAmount: money,
    confirm: z.boolean(),
    notifyCustomer: z.boolean(),
  })
  .strict();
export type CounterInput = z.infer<typeof counterInput>;

export const issueSchema = z.object({
  rows: z.array(z.number().int()),
  message: z.string(),
});
export type Issue = z.infer<typeof issueSchema>;

const status = z.enum(["CONFIRMED", "HOLDING"]);
export const bookingPreviewSchema = z.object({
  rows: z.array(z.number().int()),
  contactName: z.string(),
  contactPhone: z.string(),
  note: z.string().nullable(),
  pickupStop: stopPointSchema.nullable(),
  dropoffStop: stopPointSchema.nullable(),
  seats: z.array(
    z.object({
      code: z.string(),
      occupancy: z.number().int(),
      infantCount: z.number().int(),
      lineTotal: money,
    }),
  ),
  status,
  totalAmount: money,
  depositAmount: money,
  paidAmount: money,
  dueAmount: z.number().int(),
  paymentStatus: z.string(),
});
export type BookingPreview = z.infer<typeof bookingPreviewSchema>;

export const bookingSummarySchema = z.object({
  code: z.string(),
  rows: z.array(z.number().int()),
  status: z.string(),
  seats: z.array(z.string()),
  totalAmount: money,
  depositAmount: money,
  paidAmount: money,
  dueAmount: z.number().int(),
  paymentStatus: z.string(),
  holdUntil: z.string().nullable(),
});
export type BookingSummary = z.infer<typeof bookingSummarySchema>;

export const counterQuoteSchema = z.object({
  ok: z.boolean(),
  issues: z.array(issueSchema),
  quote: bookingPreviewSchema.nullable(),
});
export const counterResultSchema = z.object({
  booking: bookingSummarySchema,
  replayed: z.boolean(),
});

export const importPreviewSchema = z.object({
  ok: z.boolean(),
  issues: z.array(issueSchema),
  warnings: z.array(issueSchema),
  bookings: z.array(bookingPreviewSchema).max(MAX_IMPORT_ROWS),
  totals: z.object({
    bookings: z.number().int(),
    seats: z.number().int(),
    totalAmount: z.number().int(),
    paidAmount: z.number().int(),
  }),
});
export const importResultSchema = z.object({
  bookings: z.array(bookingSummarySchema).max(MAX_IMPORT_ROWS),
  replayed: z.boolean(),
});

/** Thông tin đọc file kèm theo kết quả xem trước/ghi (dashboard tự thêm). */
export const fileInfoSchema = z.object({
  /** Dòng có Mã vé: khách đã có đơn — chỉ cập nhật lên xe/thực thu trên xe. */
  existingRows: z.number().int().nonnegative(),
  newRows: z.number().int().nonnegative(),
});
export type FileInfo = z.infer<typeof fileInfoSchema>;
/** Phần cập nhật dòng có Mã vé (null khi file không có dòng nào như vậy). */
export type BoardingPart = import("./passenger-ops").BoardingPlan | null;
export type ImportPreview = z.infer<typeof importPreviewSchema> & {
  file: FileInfo;
  boarding: BoardingPart;
};
export type ImportResult = z.infer<typeof importResultSchema> & {
  file: FileInfo;
  boarding: BoardingPart;
};
/** Xem trước rỗng khi file chỉ có dòng cập nhật (không gọi API tạo đơn). */
export const EMPTY_IMPORT_PREVIEW: z.infer<typeof importPreviewSchema> = {
  ok: true,
  issues: [],
  warnings: [],
  bookings: [],
  totals: { bookings: 0, seats: 0, totalAmount: 0, paidAmount: 0 },
};

/** Tùy chọn nhập file gửi qua query (thân request là chính tệp xlsx). */
export const importOptions = z
  .object({
    dryRun: z.enum(["true", "false"]).default("true"),
    confirm: z.enum(["true", "false"]).default("true"),
    notify: z.enum(["true", "false"]).default("true"),
    name: z.string().max(200).optional(),
  })
  .strict();

export const bookingStatusText: Record<string, string> = {
  CONFIRMED: "Xác nhận ngay",
  HOLDING: "Giữ chỗ chờ chuyển khoản",
};
