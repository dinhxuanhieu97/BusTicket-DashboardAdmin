"use client";
import Link from "next/link";
import { PairTripForm } from "./pair-trip-form";
import { Modal } from "../modal";
import { OverviewPanels } from "./overview-panels";
import { TripEditor, TripDetails, TripStatusDialog } from "./trip-editor";
import { tripPeriodRange, type TripPeriod } from "@/lib/trip-period";
import { useEffect, useState } from "react";
import { Trip, vnToday, vnDateTime } from "@/lib/live-contracts";
import { useResource } from "./use-resource";
import {
  LoadState,
  RefreshButton,
  EmptyRow,
  tableClass,
  thClass,
  tdClass,
} from "./shared";
import { Eye, Play, Pause, ArrowRight, Clock } from "lucide-react";

const statusLabels: Record<Trip["status"], string> = {
  DRAFT: "Bản nháp",
  OPEN: "Đang mở bán",
  CLOSED: "Đã đóng bán",
  CANCELLED: "Đã hủy",
};

export function Trips({
  overview = false,
  canWrite = false,
  initialDate,
  initialPeriod = "day",
}: {
  overview?: boolean;
  canWrite?: boolean;
  initialDate?: string;
  initialPeriod?: TripPeriod;
}) {
  const [creating, setCreating] = useState<"pair" | "single" | null>(null);
  const [detail, setDetail] = useState<Trip | null>(null);
  const [changing, setChanging] = useState<Trip | null>(null);
  const [notice, setNotice] = useState("");
  const [date, setDate] = useState(initialDate ?? vnToday());
  const [period, setPeriod] = useState<TripPeriod>(initialPeriod);
  const [cursors, setCursors] = useState<string[]>([]);
  useEffect(() => {
    if (overview) return;
    const url = new URL(window.location.href);
    url.searchParams.set("date", date);
    url.searchParams.set("period", period);
    window.history.replaceState(null, "", url);
  }, [overview, date, period]);
  const range = tripPeriodRange(date, period);
  const query = new URLSearchParams({ ...range, limit: "25" });
  if (cursors.length) query.set("cursor", cursors[cursors.length - 1]);
  const { data, error, loading, reload } = useResource<{
    trips: Trip[];
    nextCursor?: string | null;
    meta: { fetchedAt: string };
  }>(overview ? "trips?date=" + date : "trips?" + query.toString());
  const rows = data?.trips || [];

  return (
    <div className="space-y-6">
      {overview && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              Lịch chạy
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              Vận hành trong ngày
            </h2>
            <p className="mt-2 text-sm text-muted">
              Theo dõi lịch chạy, tình trạng mở bán và chỗ khả dụng trên từng
              tuyến.
            </p>
          </div>
          <Link href="/admin/trips" className="btn btn-primary">
            Quản lý chuyến <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          {!overview && (
            <div
              className="flex gap-1 rounded-xl bg-surface p-1"
              aria-label="Phạm vi thời gian"
            >
              {(
                [
                  ["day", "Ngày"],
                  ["month", "Tháng"],
                  ["year", "Năm"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={period === value}
                  className={`btn ${period === value ? "btn-primary" : ""}`}
                  onClick={() => {
                    setPeriod(value);
                    setCursors([]);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div>
            <label htmlFor="trip-date" className="label">
              {period === "day"
                ? "Ngày khởi hành · Giờ Việt Nam"
                : period === "month"
                  ? "Tháng khởi hành"
                  : "Năm khởi hành"}
            </label>
            <div className="flex items-center gap-2">
              {period === "year" ? (
                <select
                  id="trip-date"
                  className="field w-auto font-mono text-sm"
                  value={date.slice(0, 4)}
                  onChange={(e) => {
                    setDate(e.target.value + "-01-01");
                    setCursors([]);
                  }}
                >
                  {[
                    ...new Set([
                      Number(date.slice(0, 4)),
                      ...Array.from({ length: 101 }, (_, i) => 2000 + i),
                    ]),
                  ]
                    .sort((a, b) => a - b)
                    .map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  id="trip-date"
                  type={period === "month" ? "month" : "date"}
                  className="field w-auto font-mono text-sm"
                  value={period === "month" ? date.slice(0, 7) : date}
                  onChange={(e) => {
                    const next =
                      period === "month"
                        ? e.target.value + "-01"
                        : e.target.value;
                    try {
                      tripPeriodRange(next, period);
                      setDate(next);
                      setCursors([]);
                    } catch {
                      /* invalid input */
                    }
                  }}
                />
              )}
              {(date !== vnToday() || period !== "day") && (
                <button
                  type="button"
                  className="btn px-3 text-xs"
                  onClick={() => {
                    setDate(vnToday());
                    setPeriod("day");
                    setCursors([]);
                  }}
                  title="Xem ngày hôm nay"
                >
                  Hôm nay
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RefreshButton reload={reload} loading={loading} />
          {canWrite && (
            <button
              className="btn btn-primary"
              onClick={() => setCreating("pair")}
            >
              + Thêm chuyến
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-500 dark:text-emerald-400">
          <p role="status">{notice}</p>
        </div>
      )}

      <LoadState loading={loading} error={error} reload={reload} />

      {!loading && !error && data && (
        <>
          {overview && <OverviewPanels trips={rows} />}

          <section className="card">
            <header className="flex flex-wrap justify-between gap-2 p-5">
              <h2 className="font-bold">Danh sách chuyến</h2>
              <p className="text-xs text-muted">
                Cập nhật: {vnDateTime(data.meta.fetchedAt)}
              </p>
            </header>
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    {[
                      "Chuyến / tuyến",
                      "Khởi hành",
                      "Xe",
                      "Chỗ khả dụng / tổng",
                      "Trạng thái",
                      "Thao tác",
                    ].map((h) => (
                      <th className={thClass} key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id}>
                      <td className={tdClass}>
                        <strong className="block">{t.name}</strong>
                        <small className="text-muted">{t.route_code}</small>
                      </td>
                      <td className={tdClass + " whitespace-nowrap"}>
                        {vnDateTime(t.depart_at)}
                      </td>
                      <td className={tdClass}>
                        {t.vehicle_name}
                        <small className="block text-muted">
                          {t.vehicle_code}
                        </small>
                      </td>
                      <td className={tdClass + " font-mono"}>
                        {t.available} / {t.capacity}
                      </td>
                      <td className={tdClass + " whitespace-nowrap"}>
                        {statusLabels[t.status]}
                      </td>
                      <td className={tdClass}>
                        <div className="flex flex-wrap gap-2">
                          <button className="btn" onClick={() => setDetail(t)}>
                            Chi tiết
                          </button>
                          {canWrite && t.status !== "CANCELLED" && (
                            <button
                              className="btn"
                              onClick={() => setChanging(t)}
                            >
                              {t.status === "OPEN" ? "Đóng bán" : "Mở bán"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <EmptyRow
                      columns={6}
                      text={
                        period === "day"
                          ? "Không có chuyến trong ngày đã chọn."
                          : "Không có chuyến trong khoảng thời gian đã chọn."
                      }
                    />
                  )}
                </tbody>
              </table>
            </div>
            {!overview && (
              <div className="flex items-center justify-between gap-3 border-t border-line p-4 text-sm">
                <span className="text-muted">
                  Trang {cursors.length + 1} · Tối đa 25 chuyến/trang
                </span>
                <div className="flex gap-2">
                  <button
                    className="btn"
                    disabled={!cursors.length}
                    onClick={() => setCursors((c) => c.slice(0, -1))}
                  >
                    Trang trước
                  </button>
                  <button
                    className="btn"
                    disabled={!data.nextCursor}
                    onClick={() =>
                      data.nextCursor &&
                      setCursors((c) => [...c, data.nextCursor!])
                    }
                  >
                    Trang sau
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {creating === "pair" && (
        <Modal wide title="Thêm chuyến xe" onClose={() => setCreating(null)}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm text-accent">Cả hai chiều</strong>
            <button
              type="button"
              className="btn"
              onClick={() => setCreating("single")}
            >
              Chỉ tạo một chiều
            </button>
          </div>
          <PairTripForm
            mode="once"
            date={period === "day" ? date : undefined}
            onSaved={(day) => {
              setCreating(null);
              setDate(day);
              setPeriod("day");
              setCursors([]);
              reload();
              setNotice("Đã lưu hai chuyến nháp.");
            }}
          />
        </Modal>
      )}
      {creating === "single" && (
        <TripEditor
          date={period === "day" ? date : vnToday()}
          onClose={() => setCreating(null)}
          onSaved={(day) => {
            setCreating(null);
            setDate(day);
            setPeriod("day");
            setCursors([]);
            reload();
            setNotice("Đã lưu chuyến thành công.");
          }}
        />
      )}

      {detail && <TripDetails trip={detail} onClose={() => setDetail(null)} />}

      {changing && (
        <TripStatusDialog
          trip={changing}
          onClose={() => {
            setChanging(null);
            reload();
          }}
          onSaved={() => {
            setChanging(null);
            reload();
            setNotice("Đã cập nhật trạng thái bán.");
          }}
        />
      )}
    </div>
  );
}
