"use client";
import { useState } from "react";
import { Download, Users } from "lucide-react";
import { vnDateTime, vnd } from "@/lib/live-contracts";
import { paymentStatusLabels } from "@/lib/trip-assistants";
import {
  ERASED_LABEL,
  bookingStatusLabels,
  channelLabels,
  filterPassengers,
  localPhone,
  type AdminTripPassengers,
  type PassengerScope,
} from "@/lib/trip-passengers";
import { useJson } from "./assigned-trips";
import {
  LoadState,
  RefreshButton,
  StatusBadge,
  TableScroll,
  tableClass,
  tdClass,
  thClass,
} from "./shared";

const statusTone: Record<string, "success" | "warning" | "neutral" | "info"> = {
  CONFIRMED: "success",
  COMPLETED: "info",
  HOLDING: "warning",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
};

/** Danh sách khách của chuyến cho nhân viên nhà xe (`booking.read`); nút xuất file khi có `booking.export`. */
export function TripPassengersSection({
  tripId,
  canExport,
}: {
  tripId: string;
  canExport: boolean;
}) {
  const [scope, setScope] = useState<PassengerScope>("active");
  const [query, setQuery] = useState("");
  const base = `/api/trip-management/${encodeURIComponent(tripId)}/passengers`;
  const { data, error, loading, reload } = useJson<AdminTripPassengers>(
    `${base}?status=${scope}`,
  );
  const rows = data ? filterPassengers(data.bookings, query) : [];

  return (
    <section
      aria-labelledby="trip-passenger-heading"
      className="rounded-xl border border-line/60 bg-surface/20 p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="trip-passenger-heading" className="text-base font-semibold">
            Hành khách
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {data
              ? `Cập nhật: ${vnDateTime(data.fetchedAt)}`
              : "Đang đọc dữ liệu mới nhất…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <>
              <a
                className="btn px-3 text-xs"
                href={`${base}/export?format=xlsx&status=${scope}`}
                download
              >
                <Download size={14} aria-hidden="true" />
                Xuất Excel
              </a>
              <a
                className="btn px-3 text-xs"
                href={`${base}/export?format=csv&status=${scope}`}
                download
              >
                <Download size={14} aria-hidden="true" />
                CSV
              </a>
            </>
          )}
          <RefreshButton reload={reload} loading={loading} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="pn-segmented" role="group" aria-label="Phạm vi đơn">
          {(
            [
              ["active", "Đang hiệu lực"],
              ["all", "Tất cả"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => setScope(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor="passenger-search" className="label mb-1.5">
            Tìm theo mã vé, tên, SĐT hoặc chỗ
          </label>
          <input
            id="passenger-search"
            type="search"
            className="field w-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      {error && <LoadState error={error} reload={reload} />}
      {data && (
        <>
          <ul
            className="mb-3 flex flex-wrap gap-2 text-xs"
            aria-label="Tóm tắt hành khách"
          >
            <li>
              <StatusBadge
                tone="info"
                icon={Users}
                label={`${data.summary.bookings} đơn đã xác nhận · ${data.summary.people} khách · ${data.summary.seats} chỗ`}
              />
            </li>
            {data.summary.infants > 0 && (
              <li>
                <StatusBadge
                  tone="neutral"
                  label={`${data.summary.infants} em bé`}
                />
              </li>
            )}
            {data.holding.bookings > 0 && (
              <li>
                <StatusBadge
                  tone="warning"
                  label={`${data.holding.bookings} đơn đang giữ · ${data.holding.seats} chỗ`}
                />
              </li>
            )}
            <li>
              <StatusBadge
                tone={data.summary.dueAmount > 0 ? "warning" : "success"}
                label={`Còn phải thu: ${vnd(data.summary.dueAmount)}`}
              />
            </li>
          </ul>
          {rows.length === 0 ? (
            <p className="text-sm text-muted">
              {data.bookings.length === 0
                ? scope === "active"
                  ? "Chuyến chưa có khách đặt hoặc đang giữ chỗ."
                  : "Chuyến chưa có đơn nào."
                : "Không có khách khớp từ khóa tìm kiếm."}
            </p>
          ) : (
            <TableScroll label="Danh sách hành khách">
              <table
                className={tableClass.replace("min-w-[650px]", "min-w-[980px]")}
              >
                <thead>
                  <tr>
                    <th className={thClass}>Chỗ</th>
                    <th className={thClass}>Khách</th>
                    <th className={thClass}>Điện thoại</th>
                    <th className={thClass}>Mã vé</th>
                    <th className={thClass}>Trạng thái</th>
                    <th className={thClass}>Thanh toán</th>
                    <th className={`${thClass} text-right`}>Còn thu</th>
                    <th className={thClass}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.code} data-booking={b.code}>
                      <td className={`${tdClass} whitespace-nowrap font-mono`}>
                        {b.seats
                          .map(
                            (s) =>
                              s.code +
                              (s.occupancy > 1 ? ` (${s.occupancy})` : "") +
                              (s.infantCount ? ` +${s.infantCount} bé` : ""),
                          )
                          .join(", ")}
                      </td>
                      <td
                        className={`${tdClass} min-w-40 font-medium text-ink`}
                      >
                        {b.contactErased ? (
                          <span className="font-normal italic text-muted">
                            {ERASED_LABEL}
                          </span>
                        ) : (
                          b.contactName
                        )}
                        <span className="block text-xs font-normal text-muted">
                          {channelLabels[b.channel] ?? b.channel}
                        </span>
                      </td>
                      <td className={`${tdClass} whitespace-nowrap`}>
                        {b.contactErased || !b.contactPhone ? (
                          "—"
                        ) : (
                          <a
                            href={`tel:${b.contactPhone}`}
                            className="text-accent underline-offset-2 hover:underline"
                          >
                            {localPhone(b.contactPhone)}
                          </a>
                        )}
                      </td>
                      <td className={`${tdClass} font-mono text-xs`}>
                        {b.code}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap`}>
                        <StatusBadge
                          tone={statusTone[b.status] ?? "neutral"}
                          label={bookingStatusLabels[b.status] ?? b.status}
                        />
                        {b.holdUntil && (
                          <span className="mt-1 block text-xs text-muted">
                            đến {vnDateTime(b.holdUntil)}
                          </span>
                        )}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap`}>
                        {paymentStatusLabels[b.paymentStatus] ??
                          b.paymentStatus}
                        <span className="block text-xs text-muted">
                          {vnd(b.paidAmount)} / {vnd(b.totalAmount)}
                        </span>
                      </td>
                      <td
                        className={`${tdClass} text-right font-mono ${b.dueAmount > 0 ? "font-bold text-warning" : "text-muted"}`}
                      >
                        {vnd(b.dueAmount)}
                      </td>
                      <td className={`${tdClass} max-w-64 break-words`}>
                        {b.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </>
      )}
    </section>
  );
}
