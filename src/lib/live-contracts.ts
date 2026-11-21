import { z } from "zod";
export const userSchema = z.object({
  id: z.string().uuid(),
  operatorId: z.string().uuid().nullable(),
  fullName: z.string(),
  phone: z.string(),
  role: z.enum([
    "PLATFORM_ADMIN",
    "OWNER",
    "ACCOUNTANT",
    "DISPATCHER",
    "SELLER",
    "ASSISTANT",
  ]),
  mfaEnabled: z.boolean(),
});
export const staffStatusSchema = z.enum(["ACTIVE", "DISABLED"]);
export const staffRoleSchema = z.enum([
  "OWNER",
  "DISPATCHER",
  "ACCOUNTANT",
  "SELLER",
  "ASSISTANT",
]);
export const staffUserSchema = userSchema.extend({ status: staffStatusSchema });
export const staffListSchema = z.object({ users: z.array(staffUserSchema) });
export type StaffUser = z.infer<typeof staffUserSchema>;
export const sessionSchema = z.object({
  user: userSchema,
  scope: z.enum(["full", "mfa_setup"]),
  /** Quyền máy chủ cấp (API mới); thiếu = API cũ, giữ menu mặc định. */
  permissions: z.array(z.string().max(64)).max(100).optional(),
  /** OWNER vừa đặt mật khẩu tạm: phải đổi trước khi dùng dashboard (thiếu = API cũ). */
  mustChangePassword: z.boolean().optional(),
});
export const issuedSchema = sessionSchema.extend({
  accessToken: z
    .string()
    .min(20)
    .max(4096)
    .regex(/^[\w.-]+$/),
  expiresAt: z.string().datetime(),
  /** API có phiên refresh (đợt ghi nhớ đăng nhập); thiếu = API cũ. */
  refreshToken: z
    .string()
    .min(20)
    .max(200)
    .regex(/^[\w.-]+$/)
    .nullable()
    .optional(),
  sessionExpiresAt: z.string().datetime().nullable().optional(),
  remember: z.boolean().optional(),
});
export type Session = z.infer<typeof sessionSchema>;
export type AppUser = z.infer<typeof userSchema>;
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const paymentSchema = z.object({
  id: z.string().uuid(),
  method: z.enum(["BANK_TRANSFER", "MANUAL_BANK", "CASH"]),
  amount: money,
  allocatedAmount: money,
  unallocatedAmount: money,
  content: z.string().nullable(),
  bankReference: z.string().nullable(),
  transactionAt: z.string(),
  receivedAt: z.string(),
  matchedBookingCode: z.string().nullable(),
  review: z.object({
    status: z.enum(["NONE", "NEEDS_REVIEW", "RESOLVED"]),
    reason: z.string().nullable(),
    note: z.string().nullable(),
  }),
  recordedBy: z.string().nullable(),
  allocations: z.array(
    z.object({ bookingCode: z.string(), amount: money, at: z.string() }),
  ),
});
export const tripSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  status: z.enum(["DRAFT", "OPEN", "CLOSED", "CANCELLED"]),
  depart_at: z.string(),
  sales_open_at: z.string(),
  sales_close_at: z.string(),
  contact_phone: z.string().nullable(),
  route_code: z.string(),
  vehicle_code: z.string(),
  vehicle_name: z.string(),
  available: z.number().int(),
  capacity: z.number().int(),
});
export const auditSchema = z.object({
  id: z.string(),
  action: z.string(),
  entity: z.string(),
  entity_id: z.string().nullable(),
  data: z.record(z.string(), z.unknown()).nullable(),
  at: z.string(),
  actor_name: z.string().nullable(),
  actor_role: z.string().nullable(),
});
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const signedMoney = z
  .number()
  .int()
  .min(-Number.MAX_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const moneyDay = {
  received: money,
  refunded: money,
  net: signedMoney,
  payments: count,
  refunds: count,
};
/** `GET reports/revenue`: thu thuần = đã nhận − đã hoàn trong kỳ (giờ VN). */
export const revenueReportSchema = z.object({
  from: isoDate,
  to: isoDate,
  totals: z.object(moneyDay),
  byDay: z.array(z.object({ date: isoDate, ...moneyDay })).max(366),
  byMethod: z
    .array(
      z.object({
        method: z.enum(["BANK_TRANSFER", "MANUAL_BANK", "CASH"]),
        amount: money,
        count,
      }),
    )
    .max(3),
  byHour: z
    .array(
      z.object({ hour: z.number().int().min(0).max(23), amount: money, count }),
    )
    .max(24),
  byRoute: z
    .array(
      z.object({
        code: z.string(),
        origin: z.string(),
        destination: z.string(),
        received: money,
        refunded: money,
        net: signedMoney,
        bookings: count,
      }),
    )
    .max(1000),
  unallocated: signedMoney,
});
const bookingDay = {
  bookings: count,
  cancelled: count,
  abandoned: count,
  holding: count,
  /** Số vé của đơn đã xác nhận; vé khứ hồi tính 1 (GB4, API cũ tính 2). */
  seats: count,
  /** Số vé khứ hồi trong `seats`; API cũ không có. */
  roundTrips: count.optional(),
};
/** `GET reports/bookings`: đơn theo ngày tạo; tỷ lệ hủy = đơn nhân viên hủy / đơn trong kỳ. */
export const bookingsReportSchema = z.object({
  from: isoDate,
  to: isoDate,
  totals: z.object({
    ...bookingDay,
    cancelRate: z.number().min(0).max(1).nullable(),
  }),
  byDay: z.array(z.object({ date: isoDate, ...bookingDay })).max(366),
});
/** `GET counters`: chuông thông báo + tab Sổ thu; nhóm tiền `null` khi không có `payment.read`. */
export const countersSchema = z.object({
  tripsClosingSoon: count,
  payments: z
    .object({
      total: count,
      NONE: count,
      NEEDS_REVIEW: count,
      RESOLVED: count,
    })
    .nullable(),
  refundsOpen: count.nullable(),
});
/** `GET search?q=`: chuyến (trip.read) và đơn (booking.read, `null` khi không có quyền). */
export const searchResultSchema = z.object({
  q: z.string(),
  trips: z
    .array(
      z.object({
        id: z.string().uuid(),
        code: z.string(),
        name: z.string(),
        status: z.string(),
        departAt: z.string(),
        routeCode: z.string(),
      }),
    )
    .max(20),
  bookings: z
    .array(
      z.object({
        code: z.string(),
        status: z.string(),
        contactName: z.string(),
        contactPhone: z.string(),
        totalAmount: money,
        trip: z.object({
          id: z.string().uuid(),
          code: z.string(),
          name: z.string(),
          departAt: z.string(),
        }),
      }),
    )
    .max(20)
    .nullable(),
});
export type RevenueReport = z.infer<typeof revenueReportSchema>;
export type BookingsReport = z.infer<typeof bookingsReportSchema>;
export type Counters = z.infer<typeof countersSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export const resourceSchemas = {
  payments: z.object({ payments: z.array(paymentSchema) }),
  "revenue-report": revenueReportSchema,
  "bookings-report": bookingsReportSchema,
  counters: countersSchema,
  search: searchResultSchema,
  users: z.object({ users: z.array(userSchema) }),
  trips: z.object({
    trips: z.array(tripSchema),
    nextCursor: z.string().nullable().optional(),
  }),
  "audit-logs": z.object({ entries: z.array(auditSchema) }),
};
export type Resource = keyof typeof resourceSchemas;
export type Payment = z.infer<typeof paymentSchema>;
export type Trip = z.infer<typeof tripSchema>;
export type AuditEntry = z.infer<typeof auditSchema>;
export const methodLabels = {
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
  MANUAL_BANK: "Chuyển khoản ghi nhận thủ công",
  CASH: "Tiền mặt",
};
export const reviewLabels = {
  NONE: "Không cần kiểm tra",
  NEEDS_REVIEW: "Cần kiểm tra",
  RESOLVED: "Đã xử lý",
};
export const reasonLabels: Record<string, string> = {
  UNMATCHED: "Chưa khớp đơn",
  AMBIGUOUS: "Khớp nhiều đơn",
  LATE: "Thanh toán trễ",
  OVERPAID: "Thanh toán thừa",
  BOOKING_CLOSED: "Đơn đã đóng",
  POSSIBLE_DUPLICATE: "Có thể trùng lặp",
};
export const roleLabels: Record<AppUser["role"], string> = {
  PLATFORM_ADMIN: "Quản trị nền tảng",
  OWNER: "Chủ nhà xe",
  ACCOUNTANT: "Kế toán",
  DISPATCHER: "Điều hành",
  SELLER: "Bán vé",
  ASSISTANT: "Phụ xe",
};
export const vnd = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
export const vnDateTime = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour12: false,
      });
};
/** Ngày (YYYY-MM-DD) theo giờ Việt Nam của một thời điểm ISO. */
export const vnDateOf = (value: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
/** Giờ:phút theo giờ Việt Nam. */
export const vnTime = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
};
export const vnToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
