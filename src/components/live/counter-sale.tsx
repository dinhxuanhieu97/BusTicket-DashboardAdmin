"use client";
import { useRef, useState } from "react";
import { Ticket, X } from "lucide-react";
import { vnDateTime, vnd } from "@/lib/live-contracts";
import { paymentStatusLabels } from "@/lib/trip-assistants";
import {
  MAX_COUNTER_SEATS,
  bookingStatusText,
  type BookingPreview,
  type BookingSummary,
  type CounterInput,
  type Issue,
} from "@/lib/staff-booking";
import { stopTime, type TripDetail } from "@/lib/trip-detail";
import { Notice } from "./shared";

type Picked = { occupancy: 1 | 2; infantCount: number };
type Failure = { message: string; issues: Issue[] };

async function post<T>(url: string, body: unknown, key?: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) window.location.replace("/login");
  if (!res.ok)
    throw {
      message: data.error?.message ?? "Không thực hiện được thao tác.",
      issues: data.error?.issues ?? [],
    } satisfies Failure;
  return data as T;
}
const asFailure = (e: unknown): Failure =>
  e && typeof e === "object" && "message" in e && "issues" in e
    ? (e as Failure)
    : { message: "Mất kết nối. Vui lòng thử lại.", issues: [] };

/** Bán vé tại quầy: chọn chỗ trống, nhập khách, xem giá (không ghi) rồi xác nhận bán. Cần `booking.create`. */
export function CounterSale({
  detail,
  onSold,
  initialSeats = [],
}: {
  detail: TripDetail;
  onSold: () => void;
  /** Chỗ chọn sẵn (vd. chỗ vừa bấm ở Sơ đồ chỗ). Chỉ nhận chỗ còn bán được. */
  initialSeats?: string[];
}) {
  const tripId = detail.trip.id;
  const unit = detail.layout.unit;
  const [picked, setPicked] = useState<Record<string, Picked>>(() => {
    const open = new Set(
      detail.seats
        .filter((s) => s.sellable && s.status === "AVAILABLE")
        .map((s) => s.code),
    );
    return Object.fromEntries(
      initialSeats
        .filter((code) => open.has(code))
        .slice(0, MAX_COUNTER_SEATS)
        .map((code) => [code, { occupancy: 1, infantCount: 0 }]),
    );
  });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"confirm" | "hold">("confirm");
  const [paid, setPaid] = useState("");
  const [notify, setNotify] = useState(true);
  const [quote, setQuote] = useState<BookingPreview | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [sold, setSold] = useState<BookingSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);

  const departed = Date.now() >= Date.parse(detail.trip.departAt);
  const blocked =
    detail.trip.status === "DRAFT" ||
    detail.trip.status === "CANCELLED" ||
    departed;
  const free = detail.seats.filter(
    (s) => s.sellable && s.status === "AVAILABLE",
  );
  const floors = detail.layout.floors
    .map((f) => ({ ...f, seats: free.filter((s) => s.floor === f.code) }))
    .filter((f) => f.seats.length);
  const codes = Object.keys(picked);
  const paidAmount = Number(paid.replace(/\D/g, "") || 0);

  /** Mọi thay đổi làm giá cũ hết hiệu lực và cần một lần bán mới. */
  const touch = () => {
    setQuote(null);
    setFailure(null);
    key.current = null;
  };
  const change =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      touch();
    };

  const toggle = (code: string) => {
    touch();
    setPicked((p) => {
      const next = { ...p };
      if (next[code]) delete next[code];
      else if (Object.keys(next).length < MAX_COUNTER_SEATS)
        next[code] = { occupancy: 1, infantCount: 0 };
      return next;
    });
  };
  const setItem = (code: string, patch: Partial<Picked>) => {
    touch();
    setPicked((p) => ({ ...p, [code]: { ...p[code]!, ...patch } }));
  };

  const body = (): CounterInput => ({
    contactName: name.trim(),
    contactPhone: phone.trim(),
    ...(note.trim() ? { note: note.trim() } : {}),
    ...(pickup ? { pickupStop: pickup } : {}),
    ...(dropoff ? { dropoffStop: dropoff } : {}),
    items: codes.map((seatCode) => ({ seatCode, ...picked[seatCode]! })),
    paidAmount,
    confirm: mode === "confirm",
    notifyCustomer: notify,
  });
  const base = `/api/trip-management/${encodeURIComponent(tripId)}/bookings`;

  async function check() {
    setBusy(true);
    setFailure(null);
    try {
      const r = await post<{
        ok: boolean;
        issues: Issue[];
        quote: BookingPreview | null;
      }>(base + "?dryRun=true", body());
      if (!r.ok || !r.quote)
        setFailure({
          message: "Chưa bán được: kiểm tra lại các mục dưới đây.",
          issues: r.issues,
        });
      else setQuote(r.quote);
    } catch (e) {
      setFailure(asFailure(e));
    } finally {
      setBusy(false);
    }
  }

  async function sell() {
    key.current ??= crypto.randomUUID();
    setBusy(true);
    setFailure(null);
    try {
      const r = await post<{ booking: BookingSummary }>(
        base,
        body(),
        key.current,
      );
      setSold(r.booking);
      onSold();
    } catch (e) {
      const f = asFailure(e);
      setFailure(f);
      // Chỗ vừa bị đặt: phải xem lại giá/chỗ trước khi bán tiếp.
      if (f.issues.length) setQuote(null);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPicked({});
    setName("");
    setPhone("");
    setPickup("");
    setDropoff("");
    setNote("");
    setMode("confirm");
    setPaid("");
    setNotify(true);
    setSold(null);
    touch();
  }

  if (sold)
    return (
      <section aria-labelledby="counter-heading" className="pn-page-stack">
        <h3 id="counter-heading" className="text-base font-semibold">
          Bán vé tại quầy
        </h3>
        <Notice tone="success">
          <p className="font-semibold">
            Đã tạo đơn <span className="font-mono">{sold.code}</span> ·{" "}
            {sold.seats.join(", ")}
          </p>
          <p className="mt-1">
            {sold.status === "HOLDING" && sold.holdUntil
              ? `Đang giữ chỗ đến ${vnDateTime(sold.holdUntil)} — khách chuyển khoản theo mã đơn.`
              : "Đã xác nhận."}{" "}
            Đã thu {vnd(sold.paidAmount)} / {vnd(sold.totalAmount)} · còn phải
            thu {vnd(sold.dueAmount)}.
          </p>
        </Notice>
        <div>
          <button type="button" className="btn btn-primary" onClick={reset}>
            Bán vé khác
          </button>
        </div>
      </section>
    );

  return (
    <section aria-labelledby="counter-heading" className="pn-page-stack">
      <div>
        <h3 id="counter-heading" className="text-base font-semibold">
          Bán vé tại quầy
        </h3>
        <p className="mt-0.5 text-xs text-muted">
          Chọn {unit} còn trống, nhập thông tin khách rồi kiểm tra giá trước khi
          bán. Đơn ghi kênh “Tại quầy” và tên người bán.
        </p>
      </div>

      {blocked ? (
        <Notice tone="warning">
          {departed
            ? "Chuyến đã khởi hành: không bán thêm vé."
            : "Chuyến đang nháp hoặc đã hủy: chưa bán vé được."}
        </Notice>
      ) : free.length === 0 ? (
        <Notice tone="info">Chuyến đã hết {unit} trống.</Notice>
      ) : (
        <form
          className="pn-page-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (quote) void sell();
            else void check();
          }}
        >
          {detail.trip.status === "CLOSED" && (
            <Notice tone="info">
              Chuyến đã đóng bán online; tại quầy vẫn bán được đến giờ khởi
              hành.
            </Notice>
          )}
          <fieldset className="rounded-xl border border-line/60 p-4">
            <legend className="px-1 text-sm font-semibold">
              {unit.charAt(0).toUpperCase() + unit.slice(1)} còn trống
            </legend>
            <div className="space-y-3">
              {floors.map((f) => (
                <div key={f.code}>
                  <p className="mb-1.5 text-xs font-medium text-muted">
                    {f.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {f.seats.map((s) => (
                      <button
                        key={s.code}
                        type="button"
                        className="btn min-w-14 px-3 font-mono text-xs"
                        data-seat-pick={s.code}
                        aria-pressed={Boolean(picked[s.code])}
                        onClick={() => toggle(s.code)}
                      >
                        {s.code}
                        {s.maxOccupancy > 1 && (
                          <span className="font-sans text-[10px] text-muted">
                            {" "}
                            ·{s.maxOccupancy}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {codes.length > 0 && (
              <ul className="mt-4 divide-y divide-line/50 border-t border-line/50">
                {codes.map((code) => {
                  const seat = free.find((s) => s.code === code)!;
                  const item = picked[code]!;
                  return (
                    <li
                      key={code}
                      className="flex flex-wrap items-center gap-3 py-2 text-sm"
                    >
                      <span className="w-12 font-mono font-semibold">
                        {code}
                      </span>
                      {seat.maxOccupancy > 1 && (
                        <label className="flex items-center gap-1.5 text-xs">
                          Số người
                          <select
                            className="field py-1"
                            value={item.occupancy}
                            onChange={(e) =>
                              setItem(code, {
                                occupancy: Number(e.target.value) as 1 | 2,
                              })
                            }
                          >
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                          </select>
                        </label>
                      )}
                      <label className="flex items-center gap-1.5 text-xs">
                        Trẻ dưới 2 tuổi
                        <select
                          className="field py-1"
                          value={item.infantCount}
                          onChange={(e) =>
                            setItem(code, {
                              infantCount: Number(e.target.value),
                            })
                          }
                        >
                          {[0, 1, 2].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="btn ml-auto px-2 text-xs"
                        aria-label={`Bỏ chọn ${code}`}
                        onClick={() => toggle(code)}
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="counter-name" className="label mb-1.5">
                Họ tên khách
              </label>
              <input
                id="counter-name"
                className="field w-full"
                value={name}
                maxLength={120}
                required
                autoComplete="off"
                onChange={(e) => change(setName)(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="counter-phone" className="label mb-1.5">
                Số điện thoại
              </label>
              <input
                id="counter-phone"
                className="field w-full"
                value={phone}
                inputMode="tel"
                maxLength={20}
                required
                autoComplete="off"
                onChange={(e) => change(setPhone)(e.target.value)}
              />
            </div>
            <StopSelect
              id="counter-pickup"
              label="Điểm đón"
              stops={detail.stops.pickup}
              value={pickup}
              onChange={change(setPickup)}
            />
            <StopSelect
              id="counter-dropoff"
              label="Điểm trả"
              stops={detail.stops.dropoff}
              value={dropoff}
              onChange={change(setDropoff)}
            />
            <div className="sm:col-span-2">
              <label htmlFor="counter-note" className="label mb-1.5">
                Ghi chú (không bắt buộc)
              </label>
              <input
                id="counter-note"
                className="field w-full"
                value={note}
                maxLength={500}
                autoComplete="off"
                onChange={(e) => change(setNote)(e.target.value)}
              />
            </div>
          </div>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="label mb-1.5">Thanh toán</legend>
            <div
              className="pn-segmented sm:col-span-2"
              role="group"
              aria-label="Cách xác nhận đơn"
            >
              {(
                [
                  ["confirm", "Xác nhận ngay"],
                  ["hold", "Giữ chỗ chờ chuyển khoản"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => change(setMode)(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="counter-paid" className="label mb-1.5">
                Tiền mặt đã thu (VND)
              </label>
              <input
                id="counter-paid"
                className="field w-full font-mono"
                inputMode="numeric"
                value={paid ? paidAmount.toLocaleString("vi-VN") : ""}
                placeholder="0"
                onChange={(e) =>
                  change(setPaid)(
                    e.target.value.replace(/\D/g, "").slice(0, 10),
                  )
                }
              />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => change(setNotify)(e.target.checked)}
              />
              Gửi tin xác nhận cho khách
            </label>
            <p className="text-xs text-muted sm:col-span-2">
              {mode === "confirm"
                ? "Đơn được xác nhận ngay; phần còn lại thu khi khách lên xe."
                : "Giữ chỗ theo hạn của nhà xe; thu đủ tiền cọc ngay thì đơn vẫn được xác nhận."}
            </p>
          </fieldset>

          {failure && (
            <Notice tone="danger">
              <p>{failure.message}</p>
              {failure.issues.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {failure.issues.map((i, n) => (
                    <li key={n}>{i.message}</li>
                  ))}
                </ul>
              )}
            </Notice>
          )}

          {quote && (
            <div
              className="rounded-xl border border-line/60 bg-surface/30 p-4 text-sm"
              aria-live="polite"
            >
              <p className="font-semibold">
                {bookingStatusText[quote.status]} · {quote.seats.length} {unit}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                <dt className="text-muted">Tổng tiền</dt>
                <dd className="font-mono font-semibold">
                  {vnd(quote.totalAmount)}
                </dd>
                <dt className="text-muted">Tiền cọc</dt>
                <dd className="font-mono">{vnd(quote.depositAmount)}</dd>
                <dt className="text-muted">Đã thu</dt>
                <dd className="font-mono">{vnd(quote.paidAmount)}</dd>
                <dt className="text-muted">Còn phải thu</dt>
                <dd className="font-mono font-semibold text-warning">
                  {vnd(quote.dueAmount)}
                </dd>
              </dl>
              <p className="mt-2 text-xs text-muted">
                Thanh toán:{" "}
                {paymentStatusLabels[quote.paymentStatus] ??
                  quote.paymentStatus}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {quote ? (
              <>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy}
                >
                  <Ticket size={15} aria-hidden="true" />
                  {busy ? "Đang bán…" : `Bán ${vnd(quote.totalAmount)}`}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={touch}
                >
                  Sửa lại
                </button>
              </>
            ) : (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  busy || !codes.length || !name.trim() || !phone.trim()
                }
              >
                {busy ? "Đang kiểm tra…" : "Kiểm tra giá"}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

function StopSelect({
  id,
  label,
  stops,
  value,
  onChange,
}: {
  id: string;
  label: string;
  stops: TripDetail["stops"]["pickup"];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="label mb-1.5">
        {label}
      </label>
      <select
        id={id}
        className="field w-full"
        value={value}
        disabled={!stops.length}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {stops.length ? "Chưa chọn" : "Tuyến chưa có danh sách điểm"}
        </option>
        {stops.map((s) => (
          <option key={s.name} value={s.name}>
            {s.name} · {stopTime(s)}
          </option>
        ))}
      </select>
    </div>
  );
}
