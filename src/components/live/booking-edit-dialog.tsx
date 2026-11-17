"use client";
import { useState } from "react";
import { Modal } from "../modal";
import { vnd } from "@/lib/live-contracts";
import type {
  BoardingResult,
  BookingEditInput,
  BookingEditResult,
} from "@/lib/passenger-ops";
import { stopTime, type TripDetail } from "@/lib/trip-detail";
import {
  ERASED_LABEL,
  localPhone,
  type AdminPassengerBooking,
} from "@/lib/trip-passengers";
import { useJson } from "./assigned-trips";
import { Notice, postJson } from "./shared";

type Section = "info" | "payment" | "boarding";
const sectionLabels: Record<Section, string> = {
  info: "Thông tin",
  payment: "Thanh toán",
  boarding: "Lên xe",
};

/**
 * Sửa đơn ngay trên danh sách khách: thông tin liên hệ/đón trả/ghi chú (`booking.update`), ghi nhận tiền khách trả
 * (`payment.record`) và số người lên xe theo từng chỗ (`booking.board`). Mỗi phần lưu riêng; API kiểm tra quyền.
 */
export function BookingEditDialog({
  booking: b,
  tripId,
  canEdit,
  canPay,
  canBoard,
  onClose,
  onSaved,
}: {
  booking: AdminPassengerBooking;
  tripId: string;
  canEdit: boolean;
  canPay: boolean;
  canBoard: boolean;
  onClose: () => void;
  /** Đã lưu một phần: tải lại danh sách và báo cho người dùng. */
  onSaved: (message: string) => void;
}) {
  const boardable = b.status === "CONFIRMED" || b.status === "COMPLETED";
  const open = b.status === "HOLDING" || b.status === "CONFIRMED";
  const sections = (
    [
      canEdit && open && !b.contactErased && "info",
      canPay && open && "payment",
      canBoard && boardable && "boarding",
    ] as const
  ).filter(Boolean) as Section[];
  const [section, setSection] = useState<Section>(sections[0] ?? "info");

  return (
    <Modal title={`Sửa đơn ${b.code}`} onClose={onClose}>
      <div className="pn-page-stack">
        <p className="text-sm text-muted">
          {b.contactErased ? ERASED_LABEL : b.contactName} · chỗ{" "}
          <span className="font-mono">
            {b.seats.map((s) => s.code).join(", ")}
          </span>
        </p>
        {sections.length > 1 && (
          <div
            className="pn-segmented self-start"
            role="group"
            aria-label="Phần cần sửa"
          >
            {sections.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={section === s}
                onClick={() => setSection(s)}
              >
                {sectionLabels[s]}
              </button>
            ))}
          </div>
        )}
        {!sections.length && (
          <Notice tone="warning">
            Đơn này không còn sửa được (đã hủy, hết hạn hoặc khách đã xóa thông
            tin).
          </Notice>
        )}
        {section === "info" && sections.includes("info") && (
          <InfoForm booking={b} tripId={tripId} onSaved={onSaved} />
        )}
        {section === "payment" && sections.includes("payment") && (
          <PaymentForm booking={b} onSaved={onSaved} />
        )}
        {section === "boarding" && sections.includes("boarding") && (
          <BoardingForm booking={b} tripId={tripId} onSaved={onSaved} />
        )}
      </div>
    </Modal>
  );
}

function FormError({ id, error }: { id: string; error: string | null }) {
  if (!error) return null;
  return (
    <p id={id} className="text-sm text-danger" role="alert">
      {error}
    </p>
  );
}

function InfoForm({
  booking: b,
  tripId,
  onSaved,
}: {
  booking: AdminPassengerBooking;
  tripId: string;
  onSaved: (message: string) => void;
}) {
  const { data: detail } = useJson<TripDetail>(
    `/api/trip-management/${encodeURIComponent(tripId)}`,
  );
  const initial = {
    contactName: b.contactName,
    contactPhone: localPhone(b.contactPhone),
    pickupStop: b.pickupStop?.name ?? "",
    dropoffStop: b.dropoffStop?.name ?? "",
    note: b.note ?? "",
  };
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body: BookingEditInput = {};
    for (const k of Object.keys(form) as (keyof typeof form)[])
      if (form[k].trim() !== initial[k].trim()) body[k] = form[k].trim();
    if (!Object.keys(body).length) {
      setError("Chưa có thay đổi nào.");
      return;
    }
    if (body.contactName === "") {
      setError("Họ tên không được để trống.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postJson<BookingEditResult>(
        `/api/bookings/${encodeURIComponent(b.code)}`,
        body,
        { method: "PATCH" },
      );
      onSaved(`Đã cập nhật thông tin đơn ${b.code}.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const stops = detail?.stops;
  return (
    <form className="pn-page-stack" onSubmit={submit} noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="edit-name" label="Họ tên">
          <input
            id="edit-name"
            className="field w-full"
            maxLength={120}
            value={form.contactName}
            onChange={(e) => set("contactName")(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field id="edit-phone" label="Số điện thoại">
          <input
            id="edit-phone"
            className="field w-full tabular-nums"
            inputMode="tel"
            maxLength={30}
            value={form.contactPhone}
            onChange={(e) => set("contactPhone")(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <StopField
          id="edit-pickup"
          label="Điểm đón"
          stops={stops?.pickup}
          value={form.pickupStop}
          onChange={set("pickupStop")}
        />
        <StopField
          id="edit-dropoff"
          label="Điểm trả"
          stops={stops?.dropoff}
          value={form.dropoffStop}
          onChange={set("dropoffStop")}
        />
      </div>
      <Field id="edit-note" label="Ghi chú">
        <textarea
          id="edit-note"
          className="field min-h-20 w-full"
          maxLength={500}
          value={form.note}
          onChange={(e) => set("note")(e.target.value)}
        />
      </Field>
      <FormError id="edit-info-error" error={error} />
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Đang lưu…" : "Lưu thông tin"}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="label mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function StopField({
  id,
  label,
  stops,
  value,
  onChange,
}: {
  id: string;
  label: string;
  stops: TripDetail["stops"]["pickup"] | undefined;
  value: string;
  onChange: (v: string) => void;
}) {
  const list = stops ?? [];
  // Điểm đang lưu không còn trong tuyến (tuyến đã đổi): vẫn hiện để không mất khi lưu phần khác.
  const missing = value && !list.some((s) => s.name === value);
  return (
    <Field id={id} label={label}>
      <select
        id={id}
        className="field w-full"
        value={value}
        disabled={!stops}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {!stops
            ? "Đang tải điểm…"
            : list.length
              ? "Chưa chọn"
              : "Tuyến chưa có danh sách điểm"}
        </option>
        {missing && <option value={value}>{value}</option>}
        {list.map((s) => (
          <option key={s.name} value={s.name}>
            {s.name} · {stopTime(s)}
          </option>
        ))}
      </select>
    </Field>
  );
}

function PaymentForm({
  booking: b,
  onSaved,
}: {
  booking: AdminPassengerBooking;
  onSaved: (message: string) => void;
}) {
  const [amount, setAmount] = useState(
    b.dueAmount > 0 ? String(b.dueAmount) : "",
  );
  const [method, setMethod] = useState<"CASH" | "MANUAL_BANK">("CASH");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Một khóa cho một lần nhập: bấm lại sau lỗi mạng không ghi hai khoản.
  const [key, setKey] = useState(() => crypto.randomUUID());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount.replace(/[.,\s]/g, ""));
    if (!Number.isInteger(value) || value <= 0) {
      setError("Nhập số tiền lớn hơn 0.");
      return;
    }
    if (value > b.dueAmount) {
      setError(`Số tiền lớn hơn số còn phải thu (${vnd(b.dueAmount)}).`);
      return;
    }
    if (method === "MANUAL_BANK" && reference.trim().length < 3) {
      setError("Chuyển khoản cần mã giao dịch ngân hàng.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postJson(
        `/api/bookings/${encodeURIComponent(b.code)}/payments`,
        {
          amount: value,
          method,
          ...(method === "MANUAL_BANK"
            ? { bankReference: reference.trim() }
            : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
        { headers: { "Idempotency-Key": key } },
      );
      setKey(crypto.randomUUID());
      onSaved(`Đã ghi nhận ${vnd(value)} cho đơn ${b.code}.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pn-page-stack" onSubmit={submit} noValidate>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        {(
          [
            ["Tổng tiền", b.totalAmount, "text-ink"],
            ["Đã thu", b.paidAmount, "text-success"],
            [
              "Còn phải thu",
              b.dueAmount,
              b.dueAmount ? "text-warning" : "text-success",
            ],
          ] as const
        ).map(([label, value, tone]) => (
          <div
            key={label}
            className="rounded-xl border border-line/60 bg-surface/30 px-3 py-2"
          >
            <dt className="text-xs text-muted">{label}</dt>
            <dd className={`font-mono font-bold tabular-nums ${tone}`}>
              {vnd(value)}
            </dd>
          </div>
        ))}
      </dl>
      {b.dueAmount <= 0 ? (
        <Notice tone="success">Đơn đã thu đủ tiền.</Notice>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="pay-amount" label="Số tiền thu thêm (đ)">
              <input
                id="pay-amount"
                className="field w-full tabular-nums"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? "edit-pay-error" : undefined}
              />
            </Field>
            <Field id="pay-method" label="Hình thức">
              <select
                id="pay-method"
                className="field w-full"
                value={method}
                onChange={(e) =>
                  setMethod(e.target.value as "CASH" | "MANUAL_BANK")
                }
              >
                <option value="CASH">Tiền mặt</option>
                <option value="MANUAL_BANK">Chuyển khoản (đã thấy tiền)</option>
              </select>
            </Field>
          </div>
          {method === "MANUAL_BANK" && (
            <Field id="pay-reference" label="Mã giao dịch ngân hàng">
              <input
                id="pay-reference"
                className="field w-full"
                maxLength={100}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                autoComplete="off"
              />
            </Field>
          )}
          <Field id="pay-note" label="Ghi chú (không bắt buộc)">
            <input
              id="pay-note"
              className="field w-full"
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <FormError id="edit-pay-error" error={error} />
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Đang ghi…" : "Ghi nhận thu tiền"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

function BoardingForm({
  booking: b,
  tripId,
  onSaved,
}: {
  booking: AdminPassengerBooking;
  tripId: string;
  onSaved: (message: string) => void;
}) {
  const initial = new Set(
    b.seats.filter((s) => s.boardedAt).map((s) => s.code),
  );
  const [checked, setChecked] = useState(() => new Set(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const people = (codes: Set<string>) =>
    b.seats
      .filter((s) => codes.has(s.code))
      .reduce((n, s) => n + s.occupancy, 0);
  const total = b.seats.reduce((n, s) => n + s.occupancy, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const add = [...checked].filter((c) => !initial.has(c));
    const remove = [...initial].filter((c) => !checked.has(c));
    if (!add.length && !remove.length) {
      setError("Chưa có thay đổi nào.");
      return;
    }
    setBusy(true);
    setError(null);
    const url = `/api/trip-management/${encodeURIComponent(tripId)}/boarding`;
    try {
      if (add.length)
        await postJson<BoardingResult>(url, {
          bookingCode: b.code,
          seatCodes: add,
          boarded: true,
        });
      if (remove.length)
        await postJson<BoardingResult>(url, {
          bookingCode: b.code,
          seatCodes: remove,
          boarded: false,
        });
      onSaved(`Đơn ${b.code}: ${people(checked)}/${total} người đã lên xe.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pn-page-stack" onSubmit={submit} noValidate>
      <fieldset className="pn-page-stack">
        <legend className="label mb-1.5">
          Chỗ đã lên xe ·{" "}
          <span className="font-mono">
            {people(checked)}/{total} người
          </span>
        </legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {b.seats.map((s) => (
            <li key={s.code}>
              <label className="flex items-center gap-2 rounded-xl border border-line/60 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked.has(s.code)}
                  onChange={(e) =>
                    setChecked((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(s.code);
                      else next.delete(s.code);
                      return next;
                    })
                  }
                />
                <span className="font-mono font-semibold">{s.code}</span>
                <span className="text-muted">
                  {s.occupancy} người
                  {s.infantCount ? ` + ${s.infantCount} bé` : ""}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <FormError id="edit-boarding-error" error={error} />
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Đang lưu…" : "Lưu lên xe"}
        </button>
      </div>
    </form>
  );
}
