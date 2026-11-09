"use client";
import Link from "next/link";
import { TripEditor, TripDetails, TripStatusDialog } from "./trip-editor";
import { useState } from "react";
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
const statusLabels: Record<Trip["status"], string> = {
  DRAFT: "Bản nháp",
  OPEN: "Đang mở bán",
  CLOSED: "Đã đóng bán",
  CANCELLED: "Đã hủy",
};
export function Trips({
  overview = false,
  canWrite = false,
}: {
  overview?: boolean;
  canWrite?: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Trip | null>(null);
  const [changing, setChanging] = useState<Trip | null>(null);
  const [notice, setNotice] = useState("");
  const [date, setDate] = useState(vnToday);
  const { data, error, loading, reload } = useResource<{
    trips: Trip[];
    meta: { fetchedAt: string };
  }>("trips?date=" + date);
  const rows = data?.trips || [];
  return (
    <div className="space-y-5">
      {overview && (
        <div className="card p-5">
          <h2 className="font-bold">PNTicket · Vận hành trong ngày</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Dữ liệu lấy trực tiếp từ hệ thống. Thống kê tài chính toàn kỳ sẽ
            được bổ sung khi có API tổng hợp; hiện có thể xem từng khoản trong
            sổ thu.
          </p>
          <Link
            href="/admin/payments"
            className="mt-3 inline-block text-sm text-accent"
          >
            Mở sổ thu →
          </Link>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <label htmlFor="trip-date" className="label">
            Ngày khởi hành · Giờ Việt Nam
          </label>
          <input
            id="trip-date"
            type="date"
            className="field w-auto"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </div>
        <div className="flex gap-3">
          <RefreshButton reload={reload} loading={loading} />
          {canWrite && (
            <button
              className="btn bg-accent text-white"
              onClick={() => setCreating(true)}
            >
              + Thêm chuyến
            </button>
          )}
        </div>
      </div>
      <p role="status" className="text-sm text-emerald-500">
        {notice}
      </p>
      <LoadState loading={loading} error={error} reload={reload} />
      {!loading && !error && data && (
        <>
          {overview && (
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Chuyến trong ngày", rows.length],
                [
                  "Chuyến đang mở bán",
                  rows.filter((t) => t.status === "OPEN").length,
                ],
                [
                  "Chỗ khả dụng trên chuyến mở bán",
                  rows
                    .filter((t) => t.status === "OPEN")
                    .reduce((s, t) => s + t.available, 0),
                ],
              ].map(([label, value]) => (
                <div className="card p-5" key={label}>
                  <p className="text-xs text-muted">{label}</p>
                  <p className="mt-4 font-mono text-3xl font-bold">{value}</p>
                </div>
              ))}
            </div>
          )}
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
                      text="Không có chuyến trong ngày đã chọn."
                    />
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {creating && (
        <TripEditor
          date={date}
          onClose={() => setCreating(false)}
          onSaved={(day) => {
            setCreating(false);
            setDate(day);
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
