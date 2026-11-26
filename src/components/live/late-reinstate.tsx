"use client";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Armchair, CalendarDays, LoaderCircle } from "lucide-react";
import {
  balance,
  estimateLeg,
  initialChoices,
  reinstateContextSchema,
  reinstateResultSchema,
  requestBody,
  selectable,
  toggleSeat,
  type LegChoice,
  type PickedSeat,
  type ReinstateContext,
  type ReinstateResult,
} from "@/lib/late-reinstate";
import {
  tripSchema,
  vnd,
  vnDateOf,
  vnDateTime,
  type Trip,
} from "@/lib/live-contracts";
import { seatGrid, tripDetailSchema, type TripDetail } from "@/lib/trip-detail";
import { Modal } from "../modal";
import { Notice } from "./shared";
import { operation } from "./operations-client";

async function getJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok)
    throw new Error(body.error?.message || "Không tải được dữ liệu.");
  return schema.parse(body);
}

const tripList = z.object({ trips: z.array(tripSchema) });

/**
 * Hộp thoại cấp lại chỗ cho khoản tiền về muộn: mặc định chỗ cũ còn trống; đổi được chỗ hoặc chuyến.
 * Giá chính thức do máy chủ tính lại khi xác nhận.
 */
export function LateReinstateDialog({
  paymentId,
  onClose,
  onDone,
}: {
  paymentId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [ctx, setCtx] = useState<ReinstateContext | null>(null);
  const [error, setError] = useState("");
  const [choices, setChoices] = useState<LegChoice[]>([]);
  const [details, setDetails] = useState<Record<string, TripDetail>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReinstateResult | null>(null);

  useEffect(() => {
    operation<unknown>(`payments/${paymentId}/reinstate`)
      .then((raw) => {
        const c = reinstateContextSchema.parse(raw);
        setCtx(c);
        setChoices(initialChoices(c));
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Không tải được đơn."),
      );
  }, [paymentId]);

  const tripIds = choices.map((c) => c.tripId).join(",");
  useEffect(() => {
    for (const id of tripIds.split(",").filter(Boolean)) {
      if (details[id]) continue;
      getJson(`/api/trip-management/${id}`, tripDetailSchema)
        .then((d) => setDetails((all) => ({ ...all, [id]: d })))
        .catch((e) =>
          setError(
            e instanceof Error ? e.message : "Không tải được sơ đồ chỗ.",
          ),
        );
    }
  }, [tripIds, details]);

  const estimate = useMemo(() => {
    let total = 0;
    for (const c of choices) {
      const d = details[c.tripId];
      const leg = d ? estimateLeg(d, c.seats) : null;
      if (leg === null) return null;
      total += leg;
    }
    return total;
  }, [choices, details]);

  if (result) {
    const b = result.booking;
    return (
      <Modal title="Đã cấp lại chỗ" onClose={onDone}>
        <div className="space-y-4">
          <Notice tone="success">
            Đơn <b className="font-mono">{b.code}</b>{" "}
            {b.status === "CONFIRMED"
              ? "đã xác nhận vé."
              : `đang giữ chỗ đến ${b.holdExpiresAt ? vnDateTime(b.holdExpiresAt) : "—"}; khách cần chuyển thêm ${vnd(b.depositAmount - b.paidAmount)} để xác nhận vé.`}
          </Notice>
          <p className="text-sm text-muted">
            Tổng mới {vnd(b.totalAmount)} · đã nhận {vnd(b.paidAmount)}. Tiền dư
            (nếu có) vẫn ở hàng chờ “Cần kiểm tra” để hoàn.
          </p>
          <div className="flex justify-end">
            <button className="btn btn-primary" onClick={onDone}>
              Xong
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const ready =
    ctx?.eligible &&
    choices.length > 0 &&
    choices.every((c) => c.seats.length > 0) &&
    !busy;

  const submit = async () => {
    if (!ctx || !ready) return;
    setBusy(true);
    setError("");
    try {
      const raw = await operation<unknown>(
        `payments/${paymentId}/reinstate`,
        "POST",
        requestBody(choices, note),
      );
      setResult(reinstateResultSchema.parse(raw));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không cấp lại được chỗ.");
      // Chỗ có thể vừa bị người khác giữ: tải lại sơ đồ.
      setDetails({});
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Cấp lại chỗ cho tiền về muộn" wide onClose={onClose}>
      <div className="space-y-5">
        {!ctx && !error && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <LoaderCircle
              size={16}
              className="animate-spin"
              aria-hidden="true"
            />
            Đang tải đơn…
          </p>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
        {ctx && (
          <>
            <dl className="grid gap-3 rounded-xl border border-line/60 bg-surface/20 p-4 text-sm sm:grid-cols-4">
              {[
                ["Đơn", ctx.booking.code],
                ["Tổng cũ", vnd(ctx.booking.previousTotal)],
                ["Đã nhận trước đó", vnd(ctx.booking.paidAmount)],
                ["Tiền về muộn", vnd(ctx.unallocatedAmount)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="font-mono font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            {!ctx.eligible && (
              <Notice tone="warning">
                Khoản thu không còn ở trạng thái tiền về muộn chờ xử lý (đã cấp
                lại, đã xử lý hoặc đơn chưa hết hạn).
              </Notice>
            )}

            {ctx.legs.map((leg, i) => (
              <LegPicker
                key={i}
                label={
                  ctx.legs.length > 1
                    ? i === 0
                      ? "Chuyến đi"
                      : "Chuyến về"
                    : "Chuyến"
                }
                ctx={ctx}
                leg={leg}
                choice={choices[i]!}
                detail={details[choices[i]!.tripId]}
                onChange={(c) =>
                  setChoices((all) => all.map((x, j) => (j === i ? c : x)))
                }
              />
            ))}

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted">
                Ghi chú (đã thỏa thuận với khách…)
              </span>
              <textarea
                className="field min-h-16"
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            <MoneyPreview ctx={ctx} estimate={estimate} />

            <div className="flex flex-wrap justify-end gap-2 border-t border-line/60 pt-3">
              <button className="btn" onClick={onClose} disabled={busy}>
                Hủy
              </button>
              <button
                className="btn btn-primary"
                onClick={submit}
                disabled={!ready}
              >
                {busy ? "Đang cấp lại…" : "Xác nhận cấp lại chỗ"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function MoneyPreview({
  ctx,
  estimate,
}: {
  ctx: ReinstateContext;
  estimate: number | null;
}) {
  if (estimate === null)
    return (
      <p className="text-xs text-muted">
        Chọn chỗ để xem tạm tính. Giá chính thức do hệ thống tính khi xác nhận.
      </p>
    );
  const diff = balance(ctx, estimate);
  return (
    <Notice tone={diff >= 0 ? "info" : "warning"}>
      Tạm tính {vnd(estimate)} (chưa gồm phụ thu trẻ em nếu có).{" "}
      {diff > 0
        ? `Dư ${vnd(diff)}: khoản thu sẽ ở lại hàng chờ để hoàn phần dư.`
        : diff < 0
          ? `Thiếu ${vnd(-diff)}: nếu chưa đủ cọc, đơn được giữ chỗ chờ khách chuyển thêm.`
          : "Vừa đủ."}
    </Notice>
  );
}

function LegPicker({
  label,
  ctx,
  leg,
  choice,
  detail,
  onChange,
}: {
  label: string;
  ctx: ReinstateContext;
  leg: ReinstateContext["legs"][number];
  choice: LegChoice;
  detail: TripDetail | undefined;
  onChange: (c: LegChoice) => void;
}) {
  const [changing, setChanging] = useState(leg.departed || leg.cancelled);
  const [date, setDate] = useState(vnDateOf(leg.departAt));
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [tripError, setTripError] = useState("");
  const previous = choice.tripId === leg.tripId ? leg.seats : [];

  useEffect(() => {
    if (!changing) return;
    setTrips(null);
    setTripError("");
    getJson(`/api/live/trips?date=${date}`, tripList)
      .then((r) => setTrips(r.trips))
      .catch((e) =>
        setTripError(e instanceof Error ? e.message : "Không tải được chuyến."),
      );
  }, [changing, date]);

  const now = Date.now();
  return (
    <section className="space-y-3 rounded-xl border border-line/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-ink">{label}</h3>
          <p className="text-xs text-muted">
            Gốc: {leg.tripName} · {vnDateTime(leg.departAt)} · chỗ{" "}
            {leg.seats.map((s) => s.seatCode).join(", ")}
            {leg.departed
              ? " · đã khởi hành"
              : leg.cancelled
                ? " · đã hủy"
                : ""}
          </p>
        </div>
        <button className="btn text-xs" onClick={() => setChanging((v) => !v)}>
          <CalendarDays size={14} aria-hidden="true" />
          {changing ? "Ẩn danh sách chuyến" : "Đổi chuyến"}
        </button>
      </div>

      {changing && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="field w-auto"
            aria-label={`Ngày chuyến (${label})`}
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          {tripError && (
            <span className="text-xs text-danger">{tripError}</span>
          )}
          <select
            className="field min-w-0 basis-full sm:basis-auto sm:flex-1"
            aria-label={`Chọn chuyến (${label})`}
            value={
              trips?.some((t) => t.id === choice.tripId) ? choice.tripId : ""
            }
            onChange={(e) => onChange({ tripId: e.target.value, seats: [] })}
            disabled={!trips}
          >
            <option value="">
              {trips
                ? trips.length
                  ? "Chọn chuyến…"
                  : "Không có chuyến trong ngày"
                : "Đang tải…"}
            </option>
            {trips
              ?.filter(
                (t) =>
                  t.status !== "DRAFT" &&
                  t.status !== "CANCELLED" &&
                  Date.parse(t.depart_at) > now,
              )
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {vnDateTime(t.depart_at)} · còn {t.available}/
                  {t.capacity}
                </option>
              ))}
          </select>
        </div>
      )}

      {!detail ? (
        <p className="text-xs text-muted">
          {(choice.tripId && !(leg.departed || leg.cancelled)) ||
          choice.tripId !== leg.tripId
            ? "Đang tải sơ đồ chỗ…"
            : "Chọn chuyến để xem sơ đồ."}
        </p>
      ) : (
        <SeatPicker
          detail={detail}
          bookingCode={ctx.booking.code}
          choice={choice}
          previous={previous}
          onChange={onChange}
          disabled={
            detail.trip.status === "CANCELLED" ||
            Date.parse(detail.trip.departAt) <= now
          }
        />
      )}
    </section>
  );
}

/** Sơ đồ chọn chỗ của một chặng (dùng chung với hộp sửa đơn khi đổi chỗ/chuyến). */
export function SeatPicker({
  detail,
  bookingCode,
  choice,
  previous,
  onChange,
  disabled,
}: {
  detail: TripDetail;
  bookingCode: string;
  choice: LegChoice;
  previous: PickedSeat[];
  onChange: (c: LegChoice) => void;
  disabled: boolean;
}) {
  const picked = new Set(choice.seats.map((s) => s.seatCode));
  const oldCodes = new Set(previous.map((s) => s.seatCode));
  if (disabled)
    return (
      <Notice tone="warning">
        Chuyến này đã khởi hành hoặc đã hủy. Chọn chuyến khác.
      </Notice>
    );
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {seatGrid(detail).map((floor) => (
          <figure
            key={floor.code}
            className="min-w-0 rounded-lg border border-line p-3"
            aria-label={floor.label}
          >
            <figcaption className="mb-2 text-xs font-bold uppercase tracking-wider text-ink">
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
                  {row.map((cell, ci) => {
                    if (cell.kind !== "seat")
                      return <div key={ci} aria-hidden="true" />;
                    const seat = cell.seat;
                    const can = selectable(seat, bookingCode);
                    const on = picked.has(seat.code);
                    return (
                      <button
                        key={ci}
                        type="button"
                        data-seat={seat.code}
                        aria-pressed={on}
                        disabled={!can}
                        title={`${seat.code}${oldCodes.has(seat.code) ? " · chỗ cũ" : ""}${can ? "" : " · không chọn được"}`}
                        onClick={() =>
                          onChange({
                            ...choice,
                            seats: toggleSeat(
                              choice.seats,
                              seat.code,
                              previous,
                            ),
                          })
                        }
                        className={
                          "min-h-10 rounded-lg border font-mono text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
                          (on
                            ? "border-accent bg-accent/15 text-accent ring-2 ring-accent"
                            : "border-line bg-panel text-ink hover:border-accent") +
                          (oldCodes.has(seat.code) && !on
                            ? " border-dashed border-warning"
                            : "")
                        }
                      >
                        {seat.code}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </figure>
        ))}
      </div>
      {choice.seats.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs">
          {choice.seats.map((s) => {
            const seat = detail.seats.find((x) => x.code === s.seatCode);
            return (
              <li
                key={s.seatCode}
                className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1"
              >
                <Armchair size={13} aria-hidden="true" />
                <span className="font-mono font-semibold">{s.seatCode}</span>
                {seat && seat.maxOccupancy > 1 && (
                  <select
                    className="field w-auto py-0.5 text-xs"
                    aria-label={`Số người chỗ ${s.seatCode}`}
                    value={s.occupancy}
                    onChange={(e) =>
                      onChange({
                        ...choice,
                        seats: choice.seats.map((x) =>
                          x.seatCode === s.seatCode
                            ? {
                                ...x,
                                occupancy: Number(e.target.value),
                                infantCount: 0,
                              }
                            : x,
                        ),
                      })
                    }
                  >
                    <option value={1}>1 người</option>
                    <option value={2}>2 người</option>
                  </select>
                )}
                {s.infantCount > 0 && (
                  <span className="text-muted">+{s.infantCount} trẻ</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
