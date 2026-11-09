"use client";
import { useEffect, useState } from "react";
import { Modal } from "../modal";
import { RefreshButton } from "./shared";
import { vnDateTime, vnd, type Trip } from "@/lib/live-contracts";
import {
  arrival,
  seatGrid,
  seatStatusLabels,
  type SeatStatus,
  type TripDetail,
} from "@/lib/trip-detail";

const statusLabels: Record<Trip["status"], string> = {
  DRAFT: "Bản nháp",
  OPEN: "Đang mở bán",
  CLOSED: "Đã đóng bán",
  CANCELLED: "Đã hủy",
};
const seatTone: Record<SeatStatus, string> = {
  AVAILABLE: "border-emerald-500/60 bg-emerald-500/10 text-emerald-600",
  HELD: "border-amber-500/70 bg-amber-500/15 text-amber-600",
  BOOKED: "border-sky-500/70 bg-sky-500/20 text-sky-600",
  BLOCKED: "border-line bg-line/40 text-muted line-through",
};

type Loaded = TripDetail & { meta: { fetchedAt: string } };

function useTripDetail(id: string) {
  const [state, setState] = useState<{
    data: Loaded | null;
    error: string;
    loading: boolean;
  }>({ data: null, error: "", loading: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setState((s) => ({ ...s, error: "", loading: true }));
    fetch("/api/trip-management/" + encodeURIComponent(id), {
      cache: "no-store",
      signal: c.signal,
    })
      .then(async (res) => {
        const body = await res.json();
        if (res.status === 401) return window.location.replace("/login");
        if (body.error?.code === "MFA_SETUP_REQUIRED")
          return window.location.replace("/mfa");
        if (!res.ok)
          throw Error(body.error?.message || "Không tải được chi tiết chuyến.");
        setState({ data: body, error: "", loading: false });
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setState((s) => ({
            ...s,
            error: e instanceof Error ? e.message : "Mất kết nối API.",
            loading: false,
          }));
      });
    return () => c.abort();
  }, [id, revision]);
  return { ...state, reload: () => setRevision((n) => n + 1) };
}

export function TripDetails({
  trip,
  onClose,
}: {
  trip: Trip;
  onClose: () => void;
}) {
  const { data, error, loading, reload } = useTripDetail(trip.id);
  return (
    <Modal title="Chi tiết chuyến xe" onClose={onClose}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold">{data?.trip.name ?? trip.name}</p>
          <p className="text-xs text-muted">
            {data
              ? `Cập nhật: ${vnDateTime(data.meta.fetchedAt)}`
              : "Đang đọc dữ liệu mới nhất từ API…"}
          </p>
        </div>
        <RefreshButton reload={reload} loading={loading} />
      </div>
      {error && (
        <div className="card mb-4 p-4">
          <p role="alert" className="text-sm text-amber-500">
            {error}
          </p>
          <button className="btn mt-3" onClick={reload}>
            Thử lại
          </button>
        </div>
      )}
      {!data && loading && (
        <p role="status" className="p-8 text-center text-muted">
          Đang tải giá vé và sơ đồ chỗ…
        </p>
      )}
      {data && <DetailBody d={data} />}
    </Modal>
  );
}

function DetailBody({ d }: { d: Loaded }) {
  const arrive = arrival(d);
  const unit = d.layout.unit;
  return (
    <div className="space-y-6">
      <dl className="grid gap-x-6 sm:grid-cols-2">
        {[
          [
            "Trạng thái",
            statusLabels[d.trip.status] +
              (d.trip.onSale ? " · đang nhận đặt" : ""),
          ],
          [
            "Tuyến",
            `${d.route.code} · ${d.route.origin} → ${d.route.destination}`,
          ],
          ["Xuất bến (giờ Việt Nam)", vnDateTime(d.trip.departAt)],
          [
            "Dự kiến tới nơi",
            vnDateTime(arrive.at) +
              (arrive.source === "default"
                ? " (giờ mặc định PN; lễ tết có thể khác)"
                : " (theo điểm trả cuối của tuyến)"),
          ],
          ["Mở bán từ", vnDateTime(d.trip.salesOpenAt)],
          ["Đóng bán lúc", vnDateTime(d.trip.salesCloseAt)],
          [
            "Xe",
            `${d.vehicle.code} · ${d.vehicle.name}${d.vehicle.plateNumber ? " · " + d.vehicle.plateNumber : ""}`,
          ],
          ["Liên hệ", d.trip.contactPhone || "Chưa có"],
          ["Mã chuyến", d.trip.id],
        ].map(([k, v]) => (
          <div key={k} className="border-b border-line py-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="mt-1 break-words text-sm">{v}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="fare-heading">
        <h3 id="fare-heading" className="mb-2 font-bold">
          Giá vé
        </h3>
        {d.fares.length ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="border-b border-line py-2">Tầng</th>
                <th className="border-b border-line py-2">Số người / {unit}</th>
                <th className="border-b border-line py-2 text-right">
                  Giá (VND)
                </th>
              </tr>
            </thead>
            <tbody>
              {d.fares.map((f) => (
                <tr key={`${f.floor}:${f.occupancy}`}>
                  <td className="border-b border-line py-2">{f.floorLabel}</td>
                  <td className="border-b border-line py-2">
                    {f.occupancy} người
                  </td>
                  <td className="border-b border-line py-2 text-right font-mono">
                    {vnd(f.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">Chuyến chưa có bảng giá.</p>
        )}
      </section>

      <section aria-labelledby="map-heading">
        <h3 id="map-heading" className="font-bold">
          Sơ đồ {unit}
        </h3>
        <p className="mt-1 text-xs text-muted">
          {d.layout.name} · mẫu {d.layout.code} phiên bản {d.layout.version} ·{" "}
          {d.summary.capacity} {unit}
        </p>
        {d.vehicle.layoutChangedSinceTrip && (
          <p className="mt-2 text-xs text-amber-500">
            Xe đã đổi sang sơ đồ khác sau khi tạo chuyến. Chuyến này vẫn dùng sơ
            đồ đã chụp lúc tạo.
          </p>
        )}
        <ul className="mt-3 flex flex-wrap gap-2 text-xs" aria-label="Chú giải">
          {(Object.keys(seatStatusLabels) as SeatStatus[]).map((st) => (
            <li
              key={st}
              className={`rounded-md border px-2 py-1 no-underline ${seatTone[st].replace(" line-through", "")}`}
            >
              {seatStatusLabels[st]}:{" "}
              <strong>
                {
                  {
                    AVAILABLE: d.summary.available,
                    HELD: d.summary.held,
                    BOOKED: d.summary.booked,
                    BLOCKED: d.summary.blocked,
                  }[st]
                }
              </strong>
            </li>
          ))}
        </ul>
        {d.seats.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Chuyến chưa có sơ đồ chỗ.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {seatGrid(d).map((floor) => (
              <figure
                key={floor.code}
                className="rounded-lg border border-line p-3"
                aria-label={floor.label}
              >
                <figcaption className="mb-2 text-xs font-semibold text-muted">
                  {floor.label}
                </figcaption>
                <div className="space-y-1.5">
                  {floor.rows.map((row, ri) => (
                    <div
                      key={ri}
                      className="grid gap-1.5"
                      style={{
                        gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {row.map((cell, ci) =>
                        cell.kind === "seat" ? (
                          <div
                            key={ci}
                            data-seat={cell.seat.code}
                            data-status={cell.seat.status}
                            title={[
                              `${cell.seat.code} · ${seatStatusLabels[cell.seat.status]}`,
                              `tối đa ${cell.seat.maxOccupancy} người`,
                              cell.seat.bookingCode
                                ? `đơn ${cell.seat.bookingCode}`
                                : "",
                              cell.seat.holdExpiresAt
                                ? `giữ đến ${vnDateTime(cell.seat.holdExpiresAt)}`
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            className={`flex min-h-11 flex-col items-center justify-center rounded-md border text-xs font-semibold ${seatTone[cell.seat.status]}`}
                          >
                            <span>{cell.seat.code}</span>
                            <span className="text-[10px] font-normal opacity-80">
                              {cell.seat.status === "AVAILABLE" &&
                              cell.seat.maxOccupancy > 1
                                ? `${cell.seat.maxOccupancy} người`
                                : seatStatusLabels[cell.seat.status]}
                            </span>
                          </div>
                        ) : cell.kind === "marker" ? (
                          <div
                            key={ci}
                            className="flex min-h-11 items-center justify-center rounded-md bg-line/30 text-[10px] text-muted"
                          >
                            {cell.label}
                          </div>
                        ) : (
                          <div key={ci} aria-hidden="true" />
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </figure>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          Chỗ giữ đã hết hạn được tính là còn trống. Không hiển thị tên hoặc số
          điện thoại khách; mã đơn dùng để đối chiếu.
        </p>
      </section>
    </div>
  );
}
