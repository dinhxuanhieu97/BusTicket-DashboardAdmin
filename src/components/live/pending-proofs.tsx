"use client";
import { ChevronRight, ImageIcon } from "lucide-react";
import {
  vnd,
  vnDateOf,
  vnTime,
  type PendingProofs,
} from "@/lib/live-contracts";
import { Modal } from "../modal";
import { LoadState } from "./shared";
import { useResource } from "./use-resource";

/** `HH:mm dd/MM` giờ VN: đủ để nhận ra đơn, không chiếm hai dòng trên điện thoại. */
const shortTime = (value: string) =>
  `${vnTime(value)} ${vnDateOf(value).slice(8, 10)}/${vnDateOf(value).slice(5, 7)}`;

export type PendingProofPick = { code: string; tripId: string; href: string };

/** Danh sách Hành khách đúng ngày chạy (giờ VN) và chuyến của vé. */
export const passengersHref = (tripId: string, departAt: string) =>
  `/admin/passengers?${new URLSearchParams({ date: vnDateOf(departAt), trip: tripId })}`;

/**
 * Hộp "Ảnh chuyển khoản chờ kiểm" (QS01) mở từ chuông hoặc thông báo bật lên: đơn khách đã gửi ảnh, còn giữ chỗ,
 * mới gửi trước. Chọn một đơn → chi tiết vé tại chỗ (xem ảnh, ghi nhận tiền qua "Sửa đơn").
 */
export function PendingProofsDialog({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (pick: PendingProofPick) => void;
}) {
  const { data, error, loading, reload } =
    useResource<PendingProofs>("pending-proofs");
  return (
    <Modal title="Ảnh chuyển khoản chờ kiểm" onClose={onClose}>
      {loading || error || !data ? (
        <LoadState loading={loading} error={error} reload={reload} />
      ) : data.bookings.length === 0 ? (
        <p className="text-sm text-muted">Không còn đơn nào chờ kiểm.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Khách báo đã chuyển khoản. Kiểm tra tiền về trong app ngân hàng rồi
            ghi nhận thanh toán; đơn tự rời danh sách khi đã xác nhận hoặc hết
            hạn giữ chỗ.
          </p>
          <ul
            className="divide-y divide-line/60 rounded-xl border border-line/60"
            data-pending-proofs
          >
            {data.bookings.map((b) => (
              <li key={b.code}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-surface/60"
                  onClick={() =>
                    onPick({
                      code: b.code,
                      tripId: b.trip.id,
                      href: passengersHref(b.trip.id, b.trip.departAt),
                    })
                  }
                >
                  <span
                    className="pn-tone grid size-9 shrink-0 place-items-center rounded-xl"
                    data-tone="warning"
                  >
                    <ImageIcon size={16} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block font-semibold">
                      <span className="font-mono">{b.code}</span>
                      {b.contactName ? ` · ${b.contactName}` : ""}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {b.trip.name} · {shortTime(b.trip.departAt)}
                    </span>
                    <span className="block text-xs text-muted">
                      {b.proofCount} ảnh
                      {b.lastProofAt
                        ? ` · gửi ${shortTime(b.lastProofAt)}`
                        : ""}
                      {" · giữ đến "}
                      {shortTime(b.releaseAt)}
                    </span>
                    <span className="block text-xs text-muted">
                      Đã thu{" "}
                      <span className="tabular-nums">{vnd(b.paidAmount)}</span>{" "}
                      /{" "}
                      <span className="tabular-nums">{vnd(b.totalAmount)}</span>
                    </span>
                  </span>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-muted"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
          {data.total > data.bookings.length && (
            <p className="text-xs text-muted">
              Đang hiện {data.bookings.length} / {data.total} đơn mới nhất.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
