import { vnDateOf, vnDateTime, type SearchResult } from "./live-contracts";

export type SearchHit = {
  kind: "booking" | "trip";
  href: string;
  label: string;
  group: "Vé" | "Chuyến";
  /** Dòng phụ (SĐT, mã chuyến, giờ chạy). */
  detail: string;
  /** Vé: mở chi tiết ngay trong hộp tìm; `href` là danh sách Hành khách của chuyến đó. */
  booking?: { code: string; tripId: string };
};

/** Chuỗi gửi API `search` (2–64 ký tự sau khi bỏ khoảng trắng hai đầu, giống backend); ngắn/dài quá → `null`. */
export function searchQuery(raw: string): string | null {
  const term = raw.trim();
  return term.length >= 2 && term.length <= 64 ? term : null;
}

const validDate = (value: string) => !Number.isNaN(new Date(value).getTime());

/**
 * Kết quả API `search` → mục trong hộp ⌘K (GF1). Vé đứng trước chuyến; vé mở chi tiết vé tại chỗ, kèm link
 * Hành khách đúng ngày chạy (giờ VN) và chuyến; chuyến mở Sơ đồ chỗ. Ngày chạy không đọc được thì bỏ `date` thay vì làm hỏng cả danh sách.
 */
export function searchHits(result: SearchResult): SearchHit[] {
  return [
    ...(result.bookings ?? []).map((b) => {
      const query = new URLSearchParams();
      if (validDate(b.trip.departAt))
        query.set("date", vnDateOf(b.trip.departAt));
      query.set("trip", b.trip.id);
      return {
        kind: "booking" as const,
        href: `/admin/passengers?${query}`,
        label: `${b.code} · ${b.contactName}`,
        group: "Vé" as const,
        detail: [b.contactPhone, b.trip.code].filter(Boolean).join(" · "),
        booking: { code: b.code, tripId: b.trip.id },
      };
    }),
    ...result.trips.map((t) => ({
      kind: "trip" as const,
      href: `/admin/seats?${new URLSearchParams({ trip: t.id })}`,
      label: t.name,
      group: "Chuyến" as const,
      detail: `${t.code} · ${vnDateTime(t.departAt)}`,
    })),
  ];
}
