"use client";
import Link from "next/link";
import { useState } from "react";
import { ListChecks, PencilLine } from "lucide-react";
import { Modal } from "../modal";
import { vnd, vnDateTime } from "@/lib/live-contracts";
import { paymentStatusLabels } from "@/lib/trip-assistants";
import {
  bookingStatusLabels,
  bookingStatusTone,
  ERASED_LABEL,
  type AdminTripPassengers,
} from "@/lib/trip-passengers";
import { useJson } from "./assigned-trips";
import { BookingEditDialog } from "./booking-edit-dialog";
import { PaymentProofList } from "./payment-proofs";
import { LoadState, Notice, StatusBadge } from "./shared";

/** Đơn còn sửa được ít nhất một phần (thông tin, thu tiền hoặc lên xe). */
const editableStatus = (status: string) =>
  ["HOLDING", "CONFIRMED", "COMPLETED"].includes(status);

/**
 * Chi tiết một vé mở ngay từ hộp tìm nhanh (GF1): không rời trang đang xem. Muốn xem cả chuyến thì theo link
 * "Xem cả danh sách chuyến" sang Hành khách đúng ngày và chuyến. Sửa đơn dùng lại `BookingEditDialog`.
 */
export function BookingQuickView({
  code,
  tripId,
  listHref,
  canEdit,
  canPay,
  canBoard,
  canReadPayments,
  canManageMoney = false,
  onClose,
}: {
  code: string;
  tripId: string;
  /** Hành khách đúng ngày chạy và chuyến của vé. */
  listHref: string;
  canEdit: boolean;
  canPay: boolean;
  canBoard: boolean;
  /** `payment.read`: xem ảnh lệnh chuyển khoản khách gửi. */
  canReadPayments: boolean;
  /** `payment.manage`: chỉnh tay tổng tiền, cọc, giảm số đã thu khi sửa đơn. */
  canManageMoney?: boolean;
  onClose: () => void;
}) {
  const { data, error, loading, reload } = useJson<AdminTripPassengers>(
    `/api/trip-management/${encodeURIComponent(tripId)}/passengers?status=all`,
  );
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState("");
  const b = data?.bookings.find((x) => x.code === code);

  if (editing && b)
    return (
      <BookingEditDialog
        booking={b}
        tripId={tripId}
        canEdit={canEdit}
        canPay={canPay}
        canBoard={canBoard}
        canManageMoney={canManageMoney}
        onClose={() => setEditing(false)}
        onSaved={(text) => {
          setEditing(false);
          setSaved(text);
          reload();
        }}
      />
    );

  const listLink = (
    <Link href={listHref} className="btn max-sm:w-full" onClick={onClose}>
      <ListChecks size={16} aria-hidden="true" /> Xem cả danh sách chuyến
    </Link>
  );

  return (
    <Modal title={`Vé ${code}`} onClose={onClose}>
      {loading || error ? (
        <LoadState loading={loading} error={error} reload={reload} />
      ) : !b ? (
        <div className="space-y-4">
          <Notice tone="warning">
            Không thấy vé {code} trong danh sách chuyến. Vé có thể vừa đổi
            chuyến hoặc đã bị xóa.
          </Notice>
          <div className="flex justify-end">{listLink}</div>
        </div>
      ) : (
        <div className="space-y-4" data-booking-quick-view>
          {saved && <Notice tone="success">{saved}</Notice>}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              tone={bookingStatusTone[b.status] ?? "neutral"}
              label={bookingStatusLabels[b.status] ?? b.status}
            />
            {b.holdUntil && b.status === "HOLDING" && (
              <span className="text-xs text-muted">
                giữ đến {vnDateTime(b.holdUntil)}
              </span>
            )}
          </div>
          <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[8rem_1fr]">
            <Row label="Khách">
              {b.contactErased ? ERASED_LABEL : b.contactName}
            </Row>
            {!b.contactErased && (
              <Row label="Số điện thoại">
                <span className="tabular-nums">{b.contactPhone}</span>
              </Row>
            )}
            {data && (
              <Row label="Chuyến">
                {data.trip.name}
                <span className="block text-xs text-muted">
                  Khởi hành {vnDateTime(data.trip.departAt)}
                </span>
              </Row>
            )}
            <Row label="Chỗ">
              <span className="font-mono">
                {b.seats.map((s) => s.code).join(", ")}
              </span>
            </Row>
            {(b.pickupStop || b.dropoffStop) && (
              <Row label="Đón / trả">
                {b.pickupStop?.name ?? "—"} → {b.dropoffStop?.name ?? "—"}
              </Row>
            )}
            <Row label="Thanh toán">
              <span className="font-mono font-semibold">
                {vnd(b.paidAmount)}
              </span>{" "}
              / {vnd(b.totalAmount)}
              <span className="block text-xs text-muted">
                {paymentStatusLabels[b.paymentStatus] ?? b.paymentStatus}
              </span>
            </Row>
            {b.note && <Row label="Ghi chú">{b.note}</Row>}
          </dl>
          {!!b.paymentProofCount && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-warning">
                Khách báo đã chuyển khoản · {b.paymentProofCount} ảnh
              </p>
              {canReadPayments && <PaymentProofList code={b.code} />}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t border-line/60 pt-4">
            {listLink}
            {(canEdit || canPay || canBoard) && editableStatus(b.status) && (
              <button
                type="button"
                className="btn btn-primary max-sm:w-full"
                onClick={() => setEditing(true)}
              >
                <PencilLine size={16} aria-hidden="true" /> Sửa đơn
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    // Điện thoại: nhãn nằm sát trên giá trị của nó; từ sm thành hai cột của lưới `dl`.
    <div className="grid gap-0.5 sm:contents">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
