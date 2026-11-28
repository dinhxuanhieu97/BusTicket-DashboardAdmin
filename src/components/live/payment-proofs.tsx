"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { vnDateTime } from "@/lib/live-contracts";
import { Modal } from "../modal";
import { proofImageUrl, type BookingPaymentProofs } from "@/lib/payment-proofs";
import { useJson } from "./assigned-trips";
import { Notice } from "./shared";

/**
 * Ảnh lệnh chuyển khoản khách gửi từ Mini App, để nhân viên đối chiếu với sao kê trước khi ghi nhận tiền.
 * Ảnh chỉ là bằng chứng khách gửi, không tự xác nhận đơn.
 */
export function PaymentProofList({ code }: { code: string }) {
  const [shown, setShown] = useState<number | null>(null);
  const { data, error, loading } = useJson<BookingPaymentProofs>(
    `/api/bookings/${encodeURIComponent(code)}/payment-proofs`,
  );
  if (loading)
    return <p className="text-sm text-muted">Đang tải ảnh chuyển khoản…</p>;
  if (error) return <Notice tone="warning">{error}</Notice>;
  if (!data?.proofs.length) return null;
  return (
    <div
      className="flex flex-col gap-2"
      aria-label="Ảnh chuyển khoản khách gửi"
    >
      <p className="text-sm text-ink">
        Khách báo đã chuyển khoản
        {data.transferClaimedAt
          ? ` lúc ${vnDateTime(data.transferClaimedAt)}`
          : ""}
        . Đối chiếu sao kê trước khi ghi nhận tiền.
      </p>
      <ul className="flex flex-wrap gap-2">
        {data.proofs.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setShown(i)}
              className="block overflow-hidden rounded-lg border border-line/60 hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
              aria-label={`Xem ảnh chuyển khoản ${i + 1} (${vnDateTime(p.createdAt)})`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh riêng tư qua BFF, không qua tối ưu ảnh */}
              <img
                src={proofImageUrl(p.id)}
                alt={`Ảnh chuyển khoản ${i + 1}`}
                className="h-24 w-24 object-cover"
                loading="lazy"
              />
            </button>
          </li>
        ))}
      </ul>
      {shown !== null && data.proofs[shown] && (
        <ProofPreview
          proofs={data.proofs}
          index={shown}
          onIndex={setShown}
          onClose={() => setShown(null)}
        />
      )}
    </div>
  );
}

/** Xem ảnh chuyển khoản trong hộp nổi tại chỗ (không mở tab mới), chuyển ảnh trước/sau khi khách gửi nhiều ảnh. */
function ProofPreview({
  proofs,
  index,
  onIndex,
  onClose,
}: {
  proofs: BookingPaymentProofs["proofs"];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const p = proofs[index]!;
  const many = proofs.length > 1;
  return (
    <Modal
      title={`Ảnh chuyển khoản ${many ? `${index + 1}/${proofs.length}` : ""}`.trim()}
      wide
      onClose={onClose}
    >
      <div
        className="flex flex-col items-center gap-3"
        onKeyDown={(e) => {
          if (!many) return;
          if (e.key === "ArrowLeft")
            onIndex((index - 1 + proofs.length) % proofs.length);
          if (e.key === "ArrowRight") onIndex((index + 1) % proofs.length);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh riêng tư qua BFF, không qua tối ưu ảnh */}
        <img
          key={p.id}
          src={proofImageUrl(p.id)}
          alt={`Ảnh chuyển khoản ${index + 1}`}
          className="max-h-[70vh] w-auto max-w-full rounded-lg border border-line/60 object-contain"
          data-proof-preview
        />
        <p className="text-sm text-muted">
          Khách gửi lúc {vnDateTime(p.createdAt)}
        </p>
        {many && (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn"
              onClick={() =>
                onIndex((index - 1 + proofs.length) % proofs.length)
              }
            >
              <ChevronLeft size={16} aria-hidden="true" />
              Ảnh trước
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onIndex((index + 1) % proofs.length)}
            >
              Ảnh sau
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
