"use client";
import { vnDateTime } from "@/lib/live-contracts";
import { proofImageUrl, type BookingPaymentProofs } from "@/lib/payment-proofs";
import { useJson } from "./assigned-trips";
import { Notice } from "./shared";

/**
 * Ảnh lệnh chuyển khoản khách gửi từ Mini App, để nhân viên đối chiếu với sao kê trước khi ghi nhận tiền.
 * Ảnh chỉ là bằng chứng khách gửi, không tự xác nhận đơn.
 */
export function PaymentProofList({ code }: { code: string }) {
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
            <a
              href={proofImageUrl(p.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg border border-line/60 hover:border-primary"
              title={`Mở ảnh ${i + 1} (${vnDateTime(p.createdAt)})`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh riêng tư qua BFF, không qua tối ưu ảnh */}
              <img
                src={proofImageUrl(p.id)}
                alt={`Ảnh chuyển khoản ${i + 1}`}
                className="h-24 w-24 object-cover"
                loading="lazy"
              />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
