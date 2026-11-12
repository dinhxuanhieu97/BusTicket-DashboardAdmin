import { z } from "zod";
import {
  passengerBookingSchema,
  tripPassengersSchema,
} from "./trip-assistants";
import type { TripDetail } from "./trip-detail";

/**
 * Danh sách khách theo chuyến cho nhân viên nhà xe (khớp `apps/api/src/trips/trip-passengers.ts`).
 * Quyền: `booking.read` để xem, `booking.export` để xuất file.
 */
export const passengerScopeSchema = z.enum(["active", "all"]);
export type PassengerScope = z.infer<typeof passengerScopeSchema>;
export const exportFormatSchema = z.enum(["xlsx", "csv"]);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

export const adminPassengerBookingSchema = passengerBookingSchema.extend({
  channel: z.string(),
  contactErased: z.boolean(),
  holdUntil: z.string().nullable(),
  createdAt: z.string(),
});
export const adminTripPassengersSchema = tripPassengersSchema.extend({
  bookings: z.array(adminPassengerBookingSchema).max(500),
  holding: z.object({
    bookings: z.number().int().nonnegative(),
    seats: z.number().int().nonnegative(),
  }),
});
export type AdminPassengerBooking = z.infer<typeof adminPassengerBookingSchema>;
export type AdminTripPassengers = z.infer<typeof adminTripPassengersSchema>;

export const bookingStatusLabels: Record<string, string> = {
  HOLDING: "Đang giữ chỗ",
  CONFIRMED: "Đã xác nhận",
  COMPLETED: "Đã hoàn tất",
  EXPIRED: "Hết hạn giữ chỗ",
  CANCELLED: "Đã hủy",
};
export const channelLabels: Record<string, string> = {
  ONLINE: "Mini App",
  STAFF: "Tại quầy",
};
export const ERASED_LABEL = "Khách đã xóa thông tin";

/** Lọc theo mã đơn, tên, SĐT hoặc chỗ (không phân biệt hoa thường, bỏ dấu cách trong SĐT). */
export function filterPassengers(
  bookings: readonly AdminPassengerBooking[],
  query: string,
) {
  const q = query.trim().toLowerCase();
  if (!q) return [...bookings];
  const digits = q.replace(/\D/g, "");
  return bookings.filter((b) => {
    if (b.code.toLowerCase().includes(q)) return true;
    if (b.seats.some((s) => s.code.toLowerCase() === q)) return true;
    if (b.contactErased) return false;
    if (b.contactName.toLowerCase().includes(q)) return true;
    if (digits.length >= 3) {
      const phone = b.contactPhone.replace(/\D/g, "");
      const local = phone.startsWith("84") ? "0" + phone.slice(2) : phone;
      return phone.includes(digits) || local.includes(digits);
    }
    return false;
  });
}

/** SĐT dạng +84… → 0… để đọc và gọi quen thuộc với nhân viên. */
export function localPhone(phone: string) {
  return phone.startsWith("+84") ? "0" + phone.slice(3) : phone;
}

/** 17 cột của sheet `DanhSachKhach` theo `templates/mau-danh-sach-khach-theo-chuyen.xlsx`. */
export const MANIFEST_COLUMNS = [
  "STT",
  "Mã vé",
  "Phòng/Chỗ",
  "Loại",
  "Số người",
  "Trẻ <2 tuổi",
  "Họ tên khách",
  "SĐT",
  "Điểm đón",
  "Giờ đón dự kiến",
  "Điểm trả",
  "Tổng tiền",
  "Đã trả",
  "Còn phải thu",
  "Ghi chú",
  "Đã lên xe",
  "Thực thu trên xe",
] as const;

export type ManifestCell = string | number | null;

const vnFormat = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hourCycle: "h23",
    ...opts,
  }).format(new Date(iso));
export const vnDate = (iso: string) =>
  vnFormat(iso, { day: "2-digit", month: "2-digit", year: "numeric" });
export const vnTime = (iso: string) =>
  vnFormat(iso, { hour: "2-digit", minute: "2-digit" });

/** Mã chuyến trên file: tuyến + ngày + giờ đi (giờ Việt Nam), ví dụ `HCM-HA-20270201-1800`. */
export function manifestTripCode(routeCode: string, departAt: string) {
  const [d, m, y] = vnDate(departAt).split("/");
  return `${routeCode}-${y}${m}${d}-${vnTime(departAt).replace(":", "")}`;
}

function seatType(detail: TripDetail, seatCode: string, floor: string) {
  const seat = detail.seats.find((s) => s.code === seatCode);
  const floorLabel =
    detail.layout.floors.find((f) => f.code === floor)?.label ?? floor;
  const unit = detail.layout.unit.trim();
  const unitName = unit.charAt(0).toUpperCase() + unit.slice(1);
  if (detail.layout.kind === "room" && seat)
    return `${unitName} ${seat.maxOccupancy > 1 ? "đôi" : "đơn"}`;
  return floorLabel;
}

/**
 * Một dòng cho mỗi chỗ, giống file mẫu. Tiền của đơn nhiều chỗ chỉ ghi ở dòng đầu để cộng cột không bị trùng.
 * Đơn đang giữ chỗ ghi rõ ở cột ghi chú; khách đã xóa thông tin không có tên/SĐT.
 */
export function manifestRows(
  data: AdminTripPassengers,
  detail: TripDetail,
): ManifestCell[][] {
  const rows: ManifestCell[][] = [];
  for (const b of data.bookings) {
    const notes = [
      b.status === "HOLDING" && b.holdUntil
        ? `Đang giữ chỗ đến ${vnTime(b.holdUntil)} ${vnDate(b.holdUntil)}`
        : b.status !== "CONFIRMED" && b.status !== "COMPLETED"
          ? (bookingStatusLabels[b.status] ?? b.status)
          : "",
      b.note ?? "",
    ].filter(Boolean);
    b.seats.forEach((s, i) => {
      const extra = s.occupancy > 1 ? ` (+${s.occupancy - 1})` : "";
      rows.push([
        rows.length + 1,
        b.code,
        s.code,
        seatType(detail, s.code, s.floor),
        s.occupancy,
        s.infantCount || null,
        b.contactErased ? ERASED_LABEL : b.contactName + extra,
        b.contactErased ? null : localPhone(b.contactPhone),
        null,
        null,
        null,
        i === 0 ? b.totalAmount : null,
        i === 0 ? b.paidAmount : null,
        i === 0 ? b.dueAmount : null,
        i === 0 ? notes.join(" · ") || null : null,
        null,
        null,
      ]);
    });
  }
  return rows;
}

/**
 * Ô CSV an toàn: bọc ngoặc kép khi cần và chặn công thức (ô bắt đầu bằng = + - @ tab CR) bị Excel thực thi.
 * Số giữ nguyên để cộng được.
 */
export function csvCell(value: ManifestCell) {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV UTF-8 có BOM (Excel tiếng Việt mở đúng dấu), xuống dòng CRLF. */
export function toCsv(
  header: readonly string[],
  rows: readonly ManifestCell[][],
) {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** Tên file an toàn cho header `Content-Disposition` (ASCII) kèm bản UTF-8. */
export function attachmentHeader(fileName: string) {
  const ascii = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9._-]+/g, "-");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
