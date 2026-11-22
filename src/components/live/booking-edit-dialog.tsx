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
import { PaymentProofList } from "./payment-proofs";
import { Notice, postJson } from "./shared";

/**
 * Sửa đơn ngay trên danh sách khách, gộp trong một màn: thông tin liên hệ/đón trả/ghi chú (`booking.update`),
 * thu thêm tiền (`payment.record`) và số người lên xe theo từng chỗ (`booking.board`). Một nút lưu chỉ gửi phần
 * đã đổi, theo thứ tự thông tin → lên xe → thu tiền; API vẫn kiểm tra quyền.
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
  /** Đã lưu xong: tải lại danh sách và báo cho người dùng. */
  onSaved: (message: string) => void;
}) {
  const boardable = b.status === "CONFIRMED" || b.status === "COMPLETED";
  const open = b.status === "HOLDING" || b.status === "CONFIRMED";
  const showInfo = canEdit && open && !b.contactErased;
  const showPay = canPay && open;
  const showBoard = canBoard && boardable;

  const { data: detail } = useJson<TripDetail>(
    showInfo ? `/api/trip-management/${encodeURIComponent(tripId)}` : null,
  );
  const [infoBase, setInfoBase] = useState(() => ({
    contactName: b.contactName,
    contactPhone: localPhone(b.contactPhone),
    pickupStop: b.pickupStop?.name ?? "",
    dropoffStop: b.dropoffStop?.name ?? "",
    note: b.note ?? "",
  }));
  const [info, setInfo] = useState(infoBase);
  const setField = (k: keyof typeof info) => (v: string) =>
    setInfo((f) => ({ ...f, [k]: v }));

  const [boardBase, setBoardBase] = useState(
    () => new Set(b.seats.filter((s) => s.boardedAt).map((s) => s.code)),
  );
  const [checked, setChecked] = useState(() => new Set(boardBase));
  const people = (codes: Set<string>) =>
    b.seats
      .filter((s) => codes.has(s.code))
      .reduce((n, s) => n + s.occupancy, 0);
  const total = b.seats.reduce((n, s) => n + s.occupancy, 0);

  // Không điền sẵn số tiền: một nút lưu chung không được tự ghi thu khi người dùng chỉ sửa tên.
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"CASH" | "MANUAL_BANK">("CASH");
  const [reference, setReference] = useState("");
  const [payNote, setPayNote] = useState("");
  // Một khóa cho một lần nhập: bấm lại sau lỗi mạng không ghi hai khoản.
  const [payKey, setPayKey] = useState(() => crypto.randomUUID());
  const [paid, setPaid] = useState(0);
  const due = Math.max(0, b.dueAmount - paid);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const infoBody: BookingEditInput = {};
    if (showInfo)
      for (const k of Object.keys(info) as (keyof typeof info)[])
        if (info[k].trim() !== infoBase[k].trim()) infoBody[k] = info[k].trim();
    const add = showBoard ? [...checked].filter((c) => !boardBase.has(c)) : [];
    const remove = showBoard
      ? [...boardBase].filter((c) => !checked.has(c))
      : [];
    const payValue = Number(amount.replace(/[.,\s]/g, ""));
    const wantsPay = showPay && amount.trim() !== "";

    if (infoBody.contactName === "")
      return setError("Họ tên không được để trống.");
    if (wantsPay) {
      if (!Number.isInteger(payValue) || payValue <= 0)
        return setError("Nhập số tiền thu thêm lớn hơn 0.");
      if (payValue > due)
        return setError(`Số tiền lớn hơn số còn phải thu (${vnd(due)}).`);
      if (method === "MANUAL_BANK" && reference.trim().length < 3)
        return setError("Chuyển khoản cần mã giao dịch ngân hàng.");
    }
    if (
      !Object.keys(infoBody).length &&
      !add.length &&
      !remove.length &&
      !wantsPay
    )
      return setError("Chưa có thay đổi nào.");

    setBusy(true);
    setError(null);
    const done: string[] = [];
    try {
      if (Object.keys(infoBody).length) {
        await postJson<BookingEditResult>(
          `/api/bookings/${encodeURIComponent(b.code)}`,
          infoBody,
          { method: "PATCH" },
        );
        setInfoBase(info);
        done.push("thông tin");
      }
      if (add.length || remove.length) {
        const url = `/api/trip-management/${encodeURIComponent(tripId)}/boarding`;
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
        setBoardBase(new Set(checked));
        done.push(`${people(checked)}/${total} người lên xe`);
      }
      if (wantsPay) {
        await postJson(
          `/api/bookings/${encodeURIComponent(b.code)}/payments`,
          {
            amount: payValue,
            method,
            ...(method === "MANUAL_BANK"
              ? { bankReference: reference.trim() }
              : {}),
            ...(payNote.trim() ? { note: payNote.trim() } : {}),
          },
          { headers: { "Idempotency-Key": payKey } },
        );
        setPayKey(crypto.randomUUID());
        setPaid((p) => p + payValue);
        setAmount("");
        done.push(`thu ${vnd(payValue)}`);
      }
      onSaved(`Đã lưu đơn ${b.code}: ${done.join(", ")}.`);
    } catch (err) {
      const msg = (err as Error).message;
      setError(
        done.length
          ? `Đã lưu ${done.join(", ")}; phần còn lại lỗi: ${msg}`
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  const stops = detail?.stops;
  const nothing = !showInfo && !showPay && !showBoard;
  return (
    <Modal title={`Sửa đơn ${b.code}`} onClose={onClose}>
      <form className="pn-page-stack" onSubmit={submit} noValidate>
        <p className="text-sm text-muted">
          {b.contactErased ? ERASED_LABEL : b.contactName} · chỗ{" "}
          <span className="font-mono">
            {b.seats.map((s) => s.code).join(", ")}
          </span>
        </p>
        {nothing && (
          <Notice tone="warning">
            Đơn này không còn sửa được (đã hủy, hết hạn hoặc khách đã xóa thông
            tin).
          </Notice>
        )}

        {showInfo && (
          <Part title="Thông tin khách">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="edit-name" label="Họ tên">
                <input
                  id="edit-name"
                  className="field w-full"
                  maxLength={120}
                  value={info.contactName}
                  onChange={(e) => setField("contactName")(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field id="edit-phone" label="Số điện thoại">
                <input
                  id="edit-phone"
                  className="field w-full tabular-nums"
                  inputMode="tel"
                  maxLength={30}
                  value={info.contactPhone}
                  onChange={(e) => setField("contactPhone")(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <StopField
                id="edit-pickup"
                label="Điểm đón"
                stops={stops?.pickup}
                value={info.pickupStop}
                onChange={setField("pickupStop")}
              />
              <StopField
                id="edit-dropoff"
                label="Điểm trả"
                stops={stops?.dropoff}
                value={info.dropoffStop}
                onChange={setField("dropoffStop")}
              />
            </div>
            <Field id="edit-note" label="Ghi chú">
              <textarea
                id="edit-note"
                className="field min-h-16 w-full"
                maxLength={500}
                value={info.note}
                onChange={(e) => setField("note")(e.target.value)}
              />
            </Field>
          </Part>
        )}

        {showBoard && (
          <Part
            title="Lên xe"
            aside={
              <span className="font-mono text-sm text-muted">
                {people(checked)}/{total} người
              </span>
            }
          >
            <ul
              aria-label="Chỗ đã lên xe"
              className="grid gap-2 sm:grid-cols-2"
            >
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
          </Part>
        )}

        {showPay && (
          <Part
            title="Thanh toán"
            aside={
              <span className="text-sm text-muted">
                Đã thu{" "}
                <span className="font-mono font-semibold text-success">
                  {vnd(b.paidAmount + paid)}
                </span>{" "}
                / {vnd(b.totalAmount)}
              </span>
            }
          >
            {!!b.paymentProofCount && <PaymentProofList code={b.code} />}
            {due <= 0 ? (
              <Notice tone="success">Đơn đã thu đủ tiền.</Notice>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="pay-amount" label="Số tiền thu thêm (đ)">
                    <div className="flex gap-2">
                      <input
                        id="pay-amount"
                        className="field min-w-0 flex-1 tabular-nums"
                        inputMode="numeric"
                        placeholder={`Còn thu ${vnd(due)}`}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn shrink-0 px-3 text-xs"
                        onClick={() => setAmount(String(due))}
                      >
                        Thu đủ
                      </button>
                    </div>
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
                      <option value="MANUAL_BANK">
                        Chuyển khoản (đã thấy tiền)
                      </option>
                    </select>
                  </Field>
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
                  <Field id="pay-note" label="Ghi chú thu tiền">
                    <input
                      id="pay-note"
                      className="field w-full"
                      maxLength={500}
                      value={payNote}
                      onChange={(e) => setPayNote(e.target.value)}
                    />
                  </Field>
                </div>
              </>
            )}
          </Part>
        )}

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          {!nothing && (
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function Part({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-line/60 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
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
