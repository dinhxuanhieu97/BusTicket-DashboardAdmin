"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { ArrowRight, CalendarDays, LoaderCircle } from "lucide-react";
import {
  buildChangeBody,
  type BookingChangeInput,
  type BookingChangeResult,
  type BookingSnapshot,
  type ChangeSeat,
} from "@/lib/booking-change";
import {
  tripSchema,
  vnd,
  vnDateOf,
  vnDateTime,
  type Trip,
} from "@/lib/live-contracts";
import type { TripDetail } from "@/lib/trip-detail";
import type { AdminPassengerBooking } from "@/lib/trip-passengers";
import { useJson } from "./assigned-trips";
import { SeatPicker } from "./late-reinstate";
import { Notice, postJson } from "./shared";

const tripList = z.object({ trips: z.array(tripSchema) });

/** Thay đổi đang chờ lưu: body gửi API + bản xem trước máy chủ trả (null khi đang tính hoặc lỗi). */
export interface StagedChange {
  body: BookingChangeInput;
  preview: BookingChangeResult | null;
}

/**
 * Phần "Đổi chỗ, chuyến, tiền" trong hộp sửa đơn. Không tự lưu: mỗi lần chọn khác đi thì gọi API ở chế độ
 * xem trước (`dryRun`) và báo lên hộp sửa đơn qua `onStage`; nút "Lưu thay đổi" chung mới ghi thật.
 */
export function BookingChangeSection({
  booking: b,
  tripId,
  canManageMoney,
  onStage,
}: {
  booking: AdminPassengerBooking;
  tripId: string;
  canManageMoney: boolean;
  onStage: (staged: StagedChange | null) => void;
}) {
  const current: ChangeSeat[] = useMemo(
    () =>
      b.seats.map((s) => ({
        seatCode: s.code,
        occupancy: s.occupancy,
        infantCount: s.infantCount,
      })),
    [b.seats],
  );
  const [open, setOpen] = useState(false);
  const [toTripId, setToTripId] = useState(tripId);
  const [seats, setSeats] = useState<ChangeSeat[]>(current);
  const [date, setDate] = useState("");
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [tripError, setTripError] = useState("");
  const [money, setMoney] = useState({ total: "", deposit: "", refund: "" });
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [preview, setPreview] = useState<BookingChangeResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const { data: currentDetail } = useJson<TripDetail>(
    open ? `/api/trip-management/${encodeURIComponent(tripId)}` : null,
  );
  const { data: targetDetail } = useJson<TripDetail>(
    open && toTripId
      ? `/api/trip-management/${encodeURIComponent(toTripId)}`
      : null,
  );
  // Ngày mặc định = ngày của chuyến hiện tại.
  useEffect(() => {
    if (currentDetail && !date) setDate(vnDateOf(currentDetail.trip.departAt));
  }, [currentDetail, date]);
  useEffect(() => {
    if (!open || !date) return;
    let live = true;
    setTrips(null);
    setTripError("");
    fetch(`/api/live/trips?date=${date}`, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok)
          throw new Error(body.error?.message || "Không tải được chuyến.");
        if (live) setTrips(tripList.parse(body).trips);
      })
      .catch((e) => live && setTripError((e as Error).message));
    return () => {
      live = false;
    };
  }, [open, date]);

  const staged = useMemo(() => {
    if (!open) return { body: null, error: "" };
    try {
      return {
        body: buildChangeBody({
          fromTripId: tripId,
          currentSeats: current,
          toTripId,
          seats,
          totalAmount: money.total,
          depositAmount: money.deposit,
          refundAmount: money.refund,
          reason,
          notifyCustomer: notify,
        }),
        error: "",
      };
    } catch (e) {
      return { body: null, error: (e as Error).message };
    }
  }, [open, tripId, current, toTripId, seats, money, reason, notify]);

  // Xem trước trên máy chủ (giá, cọc, còn thu, khoản cần hoàn); chờ người dùng ngừng gõ 400 ms.
  // Lý do và "báo khách" không đổi kết quả xem trước → không tính lại khi chỉ gõ lý do.
  const bodyKey = staged.body
    ? JSON.stringify({
        ...staged.body,
        reason: undefined,
        notifyCustomer: undefined,
      })
    : "null";
  const previewRef = useRef<BookingChangeResult | null>(null);
  previewRef.current = preview;
  const bodyRef = useRef(staged.body);
  bodyRef.current = staged.body;
  useEffect(() => {
    if (staged.body && previewRef.current)
      onStage({ body: staged.body, preview: previewRef.current });
    // Chỉ đồng bộ body mới (lý do / báo khách) lên hộp sửa đơn, giữ bản xem trước.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staged.body]);
  useEffect(() => {
    const body = staged.body;
    setPreview(null);
    setError(staged.error);
    if (!body) {
      onStage(null);
      return;
    }
    onStage({ body, preview: null });
    let live = true;
    setChecking(true);
    const t = setTimeout(() => {
      postJson<BookingChangeResult>(
        `/api/bookings/${encodeURIComponent(b.code)}/change?dryRun=true`,
        body,
      )
        .then((r) => {
          if (!live) return;
          setPreview(r);
          onStage({ body: bodyRef.current ?? body, preview: r });
        })
        .catch((e) => live && setError((e as Error).message))
        .finally(() => live && setChecking(false));
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
      setChecking(false);
    };
    // bodyKey gom mọi thay đổi của body; onStage ổn định theo hộp sửa đơn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyKey, staged.error, b.code]);

  const reset = () => {
    setToTripId(tripId);
    setSeats(current);
    setMoney({ total: "", deposit: "", refund: "" });
    setReason("");
    setDate(currentDetail ? vnDateOf(currentDetail.trip.departAt) : "");
  };
  const tripName = (id: string) =>
    id === tripId && currentDetail
      ? `${currentDetail.trip.name} · ${vnDateTime(currentDetail.trip.departAt)}`
      : id === toTripId && targetDetail
        ? `${targetDetail.trip.name} · ${vnDateTime(targetDetail.trip.departAt)}`
        : "Chuyến khác";
  const now = Date.now();
  const moneyStaged =
    !!money.total.trim() || !!money.deposit.trim() || !!money.refund.trim();
  const needsReason = moneyStaged || (preview?.refundAmount ?? 0) > 0;

  if (!open)
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-line px-3 py-2.5">
        <p className="text-sm text-muted">
          Đổi giường/phòng, đổi ngày hoặc chuyến
          {canManageMoney ? ", chỉnh tổng tiền, cọc, đã thu" : ""}.
        </p>
        <button
          type="button"
          className="btn text-xs"
          onClick={() => setOpen(true)}
        >
          <CalendarDays size={14} aria-hidden="true" />
          Đổi chỗ / chuyến
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          className="field w-auto"
          aria-label="Ngày đi"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
        <select
          className="field min-w-0 basis-full sm:basis-auto sm:flex-1"
          aria-label="Chọn chuyến"
          value={toTripId}
          disabled={!trips}
          onChange={(e) => {
            setToTripId(e.target.value);
            // Đổi chuyến: mặc định giữ đúng các chỗ hiện tại (đổi ngày, giữ giường).
            setSeats(current);
          }}
        >
          {!trips?.some((t) => t.id === toTripId) && (
            <option value={toTripId}>
              {toTripId === tripId ? "Chuyến hiện tại" : "Chuyến đã chọn"}
            </option>
          )}
          {trips
            ?.filter(
              (t) =>
                t.id === tripId ||
                (t.status !== "DRAFT" &&
                  t.status !== "CANCELLED" &&
                  Date.parse(t.depart_at) > now),
            )
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.id === tripId ? "(hiện tại) " : ""}
                {t.name} · {vnDateTime(t.depart_at)} · còn {t.available}/
                {t.capacity}
              </option>
            ))}
        </select>
        {tripError && <span className="text-xs text-danger">{tripError}</span>}
        <button type="button" className="btn text-xs" onClick={reset}>
          Bỏ thay đổi
        </button>
      </div>

      {!targetDetail ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
          Đang tải sơ đồ chỗ…
        </p>
      ) : (
        <SeatPicker
          detail={targetDetail}
          bookingCode={b.code}
          choice={{ tripId: toTripId, seats }}
          previous={toTripId === tripId ? current : []}
          onChange={(c) => setSeats(c.seats)}
          disabled={
            targetDetail.trip.status === "CANCELLED" ||
            Date.parse(targetDetail.trip.departAt) <= now
          }
        />
      )}

      {canManageMoney && (
        <div className="grid gap-3 sm:grid-cols-3">
          <MoneyField
            id="change-total"
            label="Tổng tiền chỉnh tay"
            hint={
              preview
                ? `Theo bảng giá: ${vnd(preview.booking.totalAmount)}`
                : undefined
            }
            value={money.total}
            onChange={(v) => setMoney((m) => ({ ...m, total: v }))}
          />
          <MoneyField
            id="change-deposit"
            label="Tiền cọc chỉnh tay"
            value={money.deposit}
            onChange={(v) => setMoney((m) => ({ ...m, deposit: v }))}
          />
          <MoneyField
            id="change-refund"
            label="Giảm số đã thu (hoàn khách)"
            value={money.refund}
            onChange={(v) => setMoney((m) => ({ ...m, refund: v }))}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <label htmlFor="change-reason" className="label mb-1.5">
            Lý do{needsReason ? " (bắt buộc)" : ""}
          </label>
          <input
            id="change-reason"
            className="field w-full"
            maxLength={300}
            placeholder="Ví dụ: Khách xin đổi sang ngày 30/11"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
          Báo khách
        </label>
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : checking ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
          Đang tính lại giá…
        </p>
      ) : preview ? (
        <Preview result={preview} tripName={tripName} />
      ) : !staged.body ? (
        <p className="text-xs text-muted">
          Chọn chỗ khác, chuyến khác hoặc nhập số tiền để xem trước.
        </p>
      ) : null}
    </div>
  );
}

function MoneyField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="label mb-1.5">
        {label}
      </label>
      <input
        id={id}
        className="field w-full tabular-nums"
        inputMode="numeric"
        placeholder="Để trống = tự tính"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const seatsOf = (s: BookingSnapshot) =>
  s.seats
    .map(
      (x) =>
        `${x.seatCode}${x.occupancy > 1 ? ` (${x.occupancy} người)` : ""}${x.infantCount ? ` +${x.infantCount} bé` : ""}`,
    )
    .join(", ");

/** Bảng trước → sau do máy chủ tính (giá chính thức khi lưu vẫn do máy chủ tính lại trong transaction). */
function Preview({
  result: r,
  tripName,
}: {
  result: BookingChangeResult;
  tripName: (id: string) => string;
}) {
  const a = r.before;
  const z = r.booking;
  const rows: [string, string, string][] = [
    ["Chuyến", tripName(a.tripId), tripName(z.tripId)],
    ["Chỗ", seatsOf(a), seatsOf(z)],
    ["Tổng tiền", vnd(a.totalAmount), vnd(z.totalAmount)],
    ["Tiền cọc", vnd(a.depositAmount), vnd(z.depositAmount)],
    ["Đã thu", vnd(a.paidAmount), vnd(z.paidAmount)],
    ["Còn phải thu", vnd(a.dueAmount), vnd(z.dueAmount)],
  ];
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line/60 p-3">
      <table className="w-full text-sm">
        <caption className="sr-only">Xem trước thay đổi</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="pb-1 font-medium" />
            <th scope="col" className="pb-1 font-medium">
              Hiện tại
            </th>
            <th scope="col" className="pb-1 font-medium" aria-hidden="true" />
            <th scope="col" className="pb-1 font-medium">
              Sau khi lưu
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, before, after]) => (
            <tr key={label} className="align-top">
              <th
                scope="row"
                className="py-0.5 pr-3 text-left font-medium text-muted"
              >
                {label}
              </th>
              <td className="py-0.5 tabular-nums">{before}</td>
              <td className="px-2 py-0.5 text-muted" aria-hidden="true">
                <ArrowRight size={12} />
              </td>
              <td
                className={
                  "py-0.5 tabular-nums " +
                  (before !== after ? "font-semibold text-ink" : "text-muted")
                }
              >
                {after}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {r.refundAmount > 0 && (
        <Notice tone="warning">
          Khách trả dư {vnd(r.refundAmount)}: sẽ ghi một khoản cần hoàn để kế
          toán hoàn cho khách.
        </Notice>
      )}
      {z.status !== a.status && z.status === "CONFIRMED" && (
        <Notice tone="success">Đơn sẽ được xác nhận vì đã đủ cọc.</Notice>
      )}
      {r.warnings.map((w) => (
        <Notice key={w} tone="warning">
          {w}
        </Notice>
      ))}
    </div>
  );
}
