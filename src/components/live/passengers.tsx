"use client";
import { useEffect, useState } from "react";
import { Bus, Clock } from "lucide-react";
import { type Trip, vnDateTime, vnTime, vnToday } from "@/lib/live-contracts";
import { tripStates } from "@/lib/overview";
import { useResource } from "./use-resource";
import { LoadState, RefreshButton, StatusBadge } from "./shared";
import { TripPassengersSection } from "./trip-passengers";

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Trang "Hành khách": chọn ngày → chọn chuyến → bảng khách của chuyến (tên, SĐT, chỗ, tiền còn thu).
 * Bảng và nút xuất file dùng chung `TripPassengersSection`; quyền vẫn do API kiểm tra.
 */
export function Passengers({
  canExport,
  initialDate,
  initialTripId,
}: {
  canExport: boolean;
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

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] lg:items-start">
      <section
        aria-labelledby="passenger-trips-heading"
        className="card pn-panel-inset flex flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="passenger-trips-heading"
            className="text-base font-bold text-ink"
          >
            Chọn chuyến
          </h2>
          <RefreshButton reload={reload} loading={loading} />
        </div>
        <div>
          <label htmlFor="passenger-date" className="label mb-1.5">
            Ngày khởi hành · Giờ Việt Nam
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="passenger-date"
              type="date"
              className="field w-auto max-w-full tabular-nums"
              value={date}
              onChange={(e) => {
                if (!isDate(e.target.value)) return;
                setDate(e.target.value);
                setTripId("");
              }}
            />
            {date !== vnToday() && (
              <button
                type="button"
                className="btn px-3 text-xs"
                onClick={() => {
                  setDate(vnToday());
                  setTripId("");
                }}
              >
                Hôm nay
              </button>
            )}
          </div>
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
            className="-mx-1 flex max-h-72 flex-col gap-1.5 overflow-y-auto px-1 lg:max-h-[calc(100dvh-16rem)]"
          >
            {trips.map((t) => {
              const active = t.id === selected?.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    data-trip={t.id}
                    onClick={() => setTripId(t.id)}
                    className={`flex w-full flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${
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
                    <span className="truncate text-sm font-semibold text-ink">
                      {t.name}
                    </span>
                    <span className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted">
                      <span className="font-mono">{t.code}</span>
                      <span>
                        Còn {t.available}/{t.capacity} chỗ
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        {selected ? (
          <>
            <section
              aria-label="Chuyến đang xem"
              className="card pn-panel-inset flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-ink">
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
              <span className="font-mono text-sm font-semibold text-ink">
                Còn {selected.available}/{selected.capacity} chỗ
              </span>
            </section>
            <TripPassengersSection
              key={selected.id}
              tripId={selected.id}
              canExport={canExport}
              className="card pn-panel-inset"
            />
          </>
        ) : (
          !loading &&
          !error && (
            <section className="card pn-panel-inset text-sm text-muted">
              Chọn ngày có chuyến để xem danh sách hành khách.
            </section>
          )
        )}
      </div>
    </div>
  );
}
