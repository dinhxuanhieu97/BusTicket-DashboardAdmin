import { vnDateOf } from "./live-contracts";

/** Nhóm thao tác để lọc nhật ký (T5). */
export const auditGroups = {
  trip: "Chuyến và vé",
  payment: "Thanh toán",
  user: "Nhân viên",
  fleet: "Xe và tuyến",
  other: "Khác",
} as const;
export type AuditGroup = keyof typeof auditGroups;

export function auditGroup(action: string): AuditGroup {
  const prefix = action.split(".")[0];
  if (
    prefix === "trip" ||
    prefix === "booking" ||
    prefix === "schedule" ||
    prefix === "passenger"
  )
    return "trip";
  if (
    prefix === "payment" ||
    prefix === "payment_account" ||
    prefix === "refund"
  )
    return "payment";
  if (prefix === "user" || prefix === "owner") return "user";
  if (prefix === "vehicle" || prefix === "route") return "fleet";
  return "other";
}

/** Tên hiện ở cột Người thực hiện; bản ghi không có người là "Hệ thống". */
export const auditActor = (entry: { actor_name: string | null }) =>
  entry.actor_name?.trim() || "Hệ thống";

export type AuditFilter = {
  group?: AuditGroup | "";
  actor?: string;
  /** YYYY-MM-DD theo giờ Việt Nam, tính cả hai đầu. */
  from?: string;
  to?: string;
};

/** Lọc trên tập đã tải. Ngày so theo giờ Việt Nam; `from` > `to` thì không còn dòng nào. */
export function filterAudit<
  T extends { action: string; actor_name: string | null; at: string },
>(entries: readonly T[], f: AuditFilter): T[] {
  return entries.filter((e) => {
    if (f.group && auditGroup(e.action) !== f.group) return false;
    if (f.actor && auditActor(e) !== f.actor) return false;
    if (f.from || f.to) {
      const t = new Date(e.at);
      if (Number.isNaN(t.getTime())) return false;
      const day = vnDateOf(e.at);
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
    }
    return true;
  });
}
