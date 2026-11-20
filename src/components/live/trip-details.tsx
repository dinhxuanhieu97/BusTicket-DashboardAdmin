"use client";
import { tripStates } from "@/lib/overview";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Modal } from "../modal";
import { TripAssistantsSection } from "./trip-assistants";
import { CounterSale } from "./counter-sale";
import {
  LoadState,
  Notice,
  RefreshButton,
  StatusBadge,
  TableScroll,
} from "./shared";
import { vnDateOf, vnDateTime, vnd, type Trip } from "@/lib/live-contracts";
import {
  arrival,
  seatGrid,
  seatStatusLabels,
  type SeatStatus,
  type TripDetail,
} from "@/lib/trip-detail";
import { Bus, Users } from "lucide-react";

export const seatTone = {
  AVAILABLE: "success",
  HELD: "warning",
  BOOKED: "info",
  BLOCKED: "neutral",
} as const satisfies Record<SeatStatus, string>;

type Loaded = TripDetail & { meta: { fetchedAt: string } };

export function useTripDetail(id: string) {
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

/**
 * Danh sách khách nằm ở trang riêng `/admin/passengers` (nút "Xem hành khách");
 * modal chỉ có thông tin chuyến và tab "Bán vé" (quyền `booking.create`).
 */
export function TripDetails({
  trip,
  onClose,
  canReadPassengers = false,
  canCreateBookings = false,
  canBoard = false,
  canCancel = false,
}: {
  trip: Trip;
  onClose: () => void;
  canReadPassengers?: boolean;
  canCreateBookings?: boolean;
  canBoard?: boolean;
  canCancel?: boolean;
}) {
  const { data, error, loading, reload } = useTripDetail(trip.id);
  const [tab, setTab] = useState<"info" | "sell">("info");

  return (
    <Modal wide title="Chi tiết chuyến xe" onClose={onClose}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-4">
        <div>
          <p className="text-base font-bold text-ink">
            {data?.trip.name ?? trip.name}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {data
              ? `Cập nhật: ${vnDateTime(data.meta.fetchedAt)}`
              : "Đang đọc dữ liệu mới nhất từ API…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateBookings && (
            <div
              className="pn-segmented"
              role="group"
              aria-label="Nội dung chi tiết chuyến"
            >
              {(
                [
                  ["info", "Thông tin chuyến"],
                  ["sell", "Bán vé"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={tab === value}
                  onClick={() => setTab(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {canReadPassengers && (
            <Link
              className="btn px-3 text-xs"
              href={`/admin/passengers?date=${vnDateOf(trip.depart_at)}&trip=${trip.id}`}
            >
              <Users size={14} aria-hidden="true" />
              Xem hành khách
            </Link>
          )}
          <RefreshButton reload={reload} loading={loading} />
        </div>
      </div>

      {error && <LoadState error={error} reload={reload} />}

      {!data && loading && (
        <div
          className="flex flex-col items-center justify-center gap-3 p-4 text-center text-muted"
          role="status"
        >
          <div className="size-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm font-medium">Đang tải giá vé và sơ đồ chỗ…</p>
        </div>
      )}

      {data &&
        (tab === "sell" ? (
          <CounterSale detail={data} onSold={reload} />
        ) : (
          <DetailBody d={data} canReadPassengers={canReadPassengers} />
        ))}
    </Modal>
  );
}

function DetailBody({
  d,
  canReadPassengers,
}: {
  d: Loaded;
  canReadPassengers: boolean;
}) {
  const arrive = arrival(d);
  const unit = d.layout.unit;

  return (
    <div className="pn-page-stack">
      {/* Từ sm: cột nhãn rộng theo nhãn dài nhất, không xuống dòng. Điện thoại giữ 9rem để chừa chỗ cho giá trị. */}
      <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] rounded-xl sm:grid-cols-[max-content_minmax(0,1fr)] border border-line/60 text-sm">
        {[
          [
            "Trạng thái",
            tripStates[d.trip.status].label +
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
          ["Mã chuyến", d.trip.code],
        ].map(([k, v], i, rows) => (
          <div key={k as string} className="contents">
            <dt
              className={`px-3 py-2 text-muted ${i < rows.length - 1 ? "border-b border-line/40" : ""}`}
            >
              {k as string}
            </dt>
            <dd
              className={`min-w-0 break-words px-3 py-2 font-medium text-ink ${k === "Mã chuyến" ? "font-mono text-xs font-normal text-muted" : ""} ${i < rows.length - 1 ? "border-b border-line/40" : ""}`}
            >
              {v as string}
            </dd>
          </div>
        ))}
      </dl>

      <TripAssistantsSection
        tripId={d.trip.id}
        cancelled={d.trip.status === "CANCELLED"}
      />

      <section
        aria-labelledby="fare-heading"
        className="rounded-xl border border-line/60 bg-surface/20 p-4"
      >
        <h3 id="fare-heading" className="text-base font-semibold">
          Giá vé
        </h3>
        {d.fares.length ? (
          <div className="mt-3">
            <TableScroll label="Bảng giá vé">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs font-semibold uppercase tracking-wider text-muted">
                    <th className="py-2.5">Tầng</th>
                    <th className="py-2.5">Số người / {unit}</th>
                    <th className="py-2.5 text-right">Giá (VND)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40">
                  {d.fares.map((f) => (
                    <tr
                      key={`${f.floor}:${f.occupancy}`}
                      className="transition-colors hover:bg-surface/40"
                    >
                      <td className="py-2.5 font-medium text-ink">
                        <span className="rounded bg-surface px-2 py-0.5 text-xs font-medium">
                          {f.floorLabel}
                        </span>
                      </td>
                      <td className="py-2.5 text-muted">{f.occupancy} người</td>
                      <td className="py-2.5 text-right font-mono text-sm font-bold text-accent">
                        {vnd(f.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Chuyến chưa có bảng giá.</p>
        )}
      </section>

      <section aria-labelledby="map-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="map-heading" className="text-base font-semibold">
              Sơ đồ {unit}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {d.layout.name} · mẫu {d.layout.code} phiên bản {d.layout.version}{" "}
              · {d.summary.capacity} {unit}
            </p>
          </div>
        </div>

        {d.vehicle.layoutChangedSinceTrip && (
          <Notice tone="warning">
            Xe đã đổi sang sơ đồ khác sau khi tạo chuyến. Chuyến này vẫn dùng sơ
            đồ lúc tạo.
          </Notice>
        )}

        <ul className="flex flex-wrap gap-2 text-xs" aria-label="Chú giải">
          {(
            [
              ["AVAILABLE", d.summary.available],
              ["HELD", d.summary.held],
              ["BOOKED", d.summary.booked],
              ["BLOCKED", d.summary.blocked],
            ] as const
          ).map(([status, count]) => (
            <li key={status}>
              <StatusBadge
                tone={seatTone[status]}
                label={`${seatStatusLabels[status]}: ${count}`}
              />
            </li>
          ))}
        </ul>

        {d.seats.length === 0 ? (
          <p className="text-sm text-muted">Chuyến chưa có sơ đồ chỗ.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {seatGrid(d).map((floor) => (
              <figure
                key={floor.code}
                className="min-w-0 rounded-xl border border-line p-4"
                aria-label={floor.label}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                  <figcaption className="text-xs font-bold uppercase tracking-wider text-ink">
                    {floor.label}
                  </figcaption>
                  <div className="flex items-center gap-1 text-[11px] text-muted">
                    <Bus size={13} className="text-accent" aria-hidden="true" />
                    <span>Cabin tài xế</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {floor.rows.map((row, ri) => (
                    <div
                      key={ri}
                      className="grid gap-2"
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
                            className="pn-tone flex min-h-12 flex-col items-center justify-center rounded-xl border border-line text-center text-xs font-semibold"
                            data-tone={seatTone[cell.seat.status]}
                          >
                            <span className="font-mono tracking-tight">
                              {cell.seat.code}
                            </span>
                            <span className="text-[10px] font-normal opacity-85">
                              {cell.seat.status === "AVAILABLE" &&
                              cell.seat.maxOccupancy > 1
                                ? `${cell.seat.maxOccupancy} người`
                                : seatStatusLabels[cell.seat.status]}
                            </span>
                          </div>
                        ) : (
                          // Tài xế, cửa, WC chỉ giữ chỗ trống để hai tầng thẳng hàng.
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

        <p className="mt-3 text-xs leading-relaxed text-muted">
          Chỗ giữ đã hết hạn được tính là còn trống. Sơ đồ chỉ hiện mã đơn để
          đối chiếu
          {canReadPassengers
            ? "; tên và số điện thoại khách xem ở trang Hành khách."
            : "; không hiển thị tên hoặc số điện thoại khách."}
        </p>
      </section>
    </div>
  );
}
