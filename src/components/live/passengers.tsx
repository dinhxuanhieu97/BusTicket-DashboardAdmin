"use client";
import { PageHero } from "../ui/page-hero";
import { useEffect, useState } from "react";
import { Bus, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { type Trip, vnDateTime, vnTime, vnToday } from "@/lib/live-contracts";
import { tripStates } from "@/lib/overview";
import { useResource } from "./use-resource";
import { LoadState, RefreshButton, StatusBadge } from "./shared";
import { TripPassengersSection } from "./trip-passengers";

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Cộng/trừ ngày trên chuỗi YYYY-MM-DD (lịch thuần, không phụ thuộc múi giờ máy). */
export const shiftDate = (value: string, days: number) => {
  const d = new Date(value + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Trang "Hành khách": thanh chọn ngày/chuyến ở trên, danh sách khách rộng hết trang bên dưới (kiểu CardFlow) của chuyến (tên, SĐT, chỗ, tiền còn thu).
 * Bảng và nút xuất file dùng chung `TripPassengersSection`; quyền vẫn do API kiểm tra.
 */
export function Passengers({
  canExport,
  canCreate = false,
  canBoard = false,
  canCancel = false,
  canEdit = false,
  canPay = false,
  initialDate,
  initialTripId,
}: {
  canExport: boolean;
  /** `booking.create`: nút "Nhập danh sách" khách mới từ file. */
  canCreate?: boolean;
  /** `booking.board`: nút lên xe. */
  canBoard?: boolean;
  /** `booking.cancel`: nút hủy đơn. */
  canCancel?: boolean;
  /** `booking.update`: nút Sửa đơn (họ tên, SĐT, điểm đón/trả, ghi chú). */
  canEdit?: boolean;
  /** `payment.record`: thu thêm tiền trong hộp thoại Sửa. */
  canPay?: boolean;
  initialDate?: string;
  initialTripId?: string;
}) {
  const [date, setDate] = useState(
    initialDate && isDate(initialDate) ? initialDate : vnToday(),
  );
  const [tripId, setTripId] = useState(initialTripId ?? "");
  const { data, error, loading, reload } = useResource<{
    trips: Trip[];
    meta: { fetchedAt: string };
  }>("trips?date=" + date);
  const trips = [...(data?.trips ?? [])].sort((a, b) =>
    a.depart_at.localeCompare(b.depart_at),
  );
  const selected = trips.find((t) => t.id === tripId) ?? trips[0];

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("date", date);
    if (selected) url.searchParams.set("trip", selected.id);
    else url.searchParams.delete("trip");
    window.history.replaceState(null, "", url);
  }, [date, selected]);

  const changeDate = (next: string) => {
    if (!isDate(next)) return;
    setDate(next);
    setTripId("");
  };
  const sold = trips.reduce((n, t) => n + (t.capacity - t.available), 0);
  const seats = trips.reduce((n, t) => n + t.capacity, 0);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHero
        title="Hành khách"
        description="Chọn chuyến để xem khách, soát vé, bán tại quầy và xuất danh sách."
      />
      <section
        aria-labelledby="passenger-trips-heading"
        className="card pn-panel-inset flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <div>
              <h2
                id="passenger-trips-heading"
                className="text-base font-bold text-ink"
              >
                Chọn chuyến
              </h2>
              <p className="mt-0.5 text-xs text-muted" aria-live="polite">
                {data
                  ? trips.length
                    ? `${trips.length} chuyến · đã bán ${sold}/${seats} chỗ`
                    : "Không có chuyến"
                  : "Đang tải…"}
              </p>
            </div>
            <div>
              <label htmlFor="passenger-date" className="label mb-1.5">
                Ngày khởi hành · Giờ Việt Nam
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="btn px-2"
                  aria-label="Ngày trước"
                  onClick={() => changeDate(shiftDate(date, -1))}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <input
                  id="passenger-date"
                  type="date"
                  className="field w-auto max-w-full tabular-nums"
                  value={date}
                  onChange={(e) => changeDate(e.target.value)}
                />
                <button
                  type="button"
                  className="btn px-2"
                  aria-label="Ngày sau"
                  onClick={() => changeDate(shiftDate(date, 1))}
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
                {date !== vnToday() && (
                  <button
                    type="button"
                    className="btn px-3 text-xs"
                    onClick={() => changeDate(vnToday())}
                  >
                    Hôm nay
                  </button>
                )}
              </div>
            </div>
          </div>
          <RefreshButton reload={reload} loading={loading} />
        </div>

        <LoadState loading={loading} error={error} reload={reload} />

        {data && !trips.length && (
          <p className="text-sm text-muted">
            Không có chuyến nào khởi hành trong ngày này.
          </p>
        )}
        {trips.length > 0 && (
          <ul
            aria-label="Chuyến trong ngày"
            className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible"
          >
            {trips.map((t) => {
              const active = t.id === selected?.id;
              return (
                <li
                  key={t.id}
                  className="w-[15.5rem] shrink-0 snap-start md:w-auto md:min-w-60 md:max-w-sm md:flex-1"
                >
                  <button
                    type="button"
                    aria-pressed={active}
                    data-trip={t.id}
                    onClick={() => setTripId(t.id)}
                    className={`flex h-full w-full flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "border-accent bg-accent/10"
                        : "border-line/60 hover:bg-surface"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-mono text-sm font-bold text-ink">
                        <Clock
                          size={14}
                          className="text-muted"
                          aria-hidden="true"
                        />
                        {vnTime(t.depart_at)}
                      </span>
                      <StatusBadge
                        tone={tripStates[t.status].tone}
                        label={tripStates[t.status].label}
                      />
                    </span>
                    <span className="text-sm font-semibold leading-snug text-ink">
                      {t.name}
                    </span>
                    <span className="mt-auto flex items-center justify-between gap-x-3 text-xs text-muted">
                      <span className="font-mono">{t.code}</span>
                      <span>
                        Còn {t.available}/{t.capacity} chỗ
                      </span>
                    </span>
                    <SeatMeter trip={t} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selected && (
          <div
            role="region"
            aria-label="Chuyến đang xem"
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line/60 pt-4"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Đang xem
              </p>
              <p className="text-lg font-bold leading-snug text-ink">
                {selected.name}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span className="font-mono">{selected.code}</span>
                <span>Khởi hành {vnDateTime(selected.depart_at)}</span>
                <span className="flex items-center gap-1">
                  <Bus size={14} aria-hidden="true" />
                  {selected.vehicle_name} · {selected.vehicle_code}
                </span>
              </p>
            </div>
            <div className="w-full sm:w-56">
              <p className="flex items-baseline justify-between gap-2 text-xs text-muted">
                <span>Đã bán</span>
                <span className="font-mono text-sm font-semibold text-ink">
                  {selected.capacity - selected.available}/{selected.capacity}{" "}
                  chỗ
                </span>
              </p>
              <SeatMeter trip={selected} className="mt-1.5 h-2" />
              <p className="mt-1 text-right text-xs text-muted">
                Còn {selected.available} chỗ trống
              </p>
            </div>
          </div>
        )}
      </section>

      {selected ? (
        <TripPassengersSection
          key={selected.id}
          tripId={selected.id}
          canExport={canExport}
          canCreate={canCreate}
          canBoard={canBoard}
          canCancel={canCancel}
          canEdit={canEdit}
          canPay={canPay}
          className="card pn-panel-inset"
        />
      ) : (
        !loading &&
        !error && (
          <section className="card pn-panel-inset text-sm text-muted">
            Chọn ngày có chuyến để xem danh sách hành khách.
          </section>
        )
      )}
    </div>
  );
}

/** Thanh tỉ lệ chỗ đã bán; chỉ để nhìn, số liệu đã có ở chữ bên cạnh. */
function SeatMeter({
  trip,
  className = "h-1.5",
}: {
  trip: Pick<Trip, "available" | "capacity">;
  className?: string;
}) {
  const pct =
    trip.capacity > 0
      ? Math.round(((trip.capacity - trip.available) / trip.capacity) * 100)
      : 0;
  return (
    <span
      aria-hidden="true"
      className={`block w-full overflow-hidden rounded-full bg-surface ${className}`}
    >
      <span
        className={`block h-full rounded-full ${pct >= 100 ? "bg-success" : "bg-accent"}`}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}
