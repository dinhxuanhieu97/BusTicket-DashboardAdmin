import type { ProofNotice } from "./live-contracts";

/** Thông báo "khách gửi ảnh chuyển khoản" đã đọc (F80), lưu trên máy người xem theo `id` thông báo. */
export const NOTICE_READ_KEY = "pnticket_proof_notice_read";
const MAX_READ = 200;

/** `null` = máy này chưa từng lưu (lần đầu dùng): coi mọi thông báo đang có là đã đọc, tránh dồn cả tuần. */
export function parseNoticeRead(raw: string | null): string[] | null {
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").slice(-MAX_READ)
      : [];
  } catch {
    return [];
  }
}

/** Mốc đã đọc hiệu lực: lần đầu lấy toàn bộ thông báo hiện có; sau đó chỉ giữ id còn trong danh sách. */
export function settleNoticeRead(
  items: ProofNotice[],
  read: string[] | null,
): string[] {
  if (read === null) return items.map((i) => i.id);
  const ids = new Set(items.map((i) => i.id));
  return read.filter((id) => ids.has(id));
}

export const isNoticeUnread = (item: ProofNotice, read: readonly string[]) =>
  !read.includes(item.id);

export const unreadNotices = (items: ProofNotice[], read: readonly string[]) =>
  items.filter((i) => isNoticeUnread(i, read)).length;

export const markNoticeRead = (read: readonly string[], item: ProofNotice) =>
  read.includes(item.id) ? [...read] : [...read, item.id].slice(-MAX_READ);

export const markAllNoticesRead = (items: ProofNotice[]) =>
  items.map((i) => i.id).slice(-MAX_READ);

/** Nhãn + tông màu trạng thái đơn hiện tại. */
export const noticeState: Record<
  ProofNotice["state"],
  { label: string; tone: "warning" | "success" | "neutral" | "danger" }
> = {
  PENDING: { label: "Chờ kiểm", tone: "warning" },
  CONFIRMED: { label: "Đã xác nhận", tone: "success" },
  EXPIRED: { label: "Hết hạn giữ chỗ", tone: "neutral" },
  CANCELLED: { label: "Đã hủy", tone: "neutral" },
};
