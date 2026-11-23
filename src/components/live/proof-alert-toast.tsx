"use client";
import { ImageIcon, X } from "lucide-react";
import { useEffect, type CSSProperties } from "react";

const durationMs = 15000;

export type ProofAlert = { id: number; count: number };

/**
 * Thông báo bật lên khi có ảnh chuyển khoản mới (QS01). Đọc to qua vùng `status`; nút "Xem" mở danh sách chờ kiểm.
 * Tự ẩn sau 15 giây; việc vẫn còn trên chuông.
 */
export function ProofAlertToast({
  alert,
  dismiss,
  onOpen,
}: {
  alert: ProofAlert | null;
  dismiss: (id: number) => void;
  onOpen: () => void;
}) {
  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => dismiss(alert.id), durationMs);
    return () => window.clearTimeout(timer);
  }, [alert, dismiss]);

  const text = alert
    ? alert.count > 1
      ? `${alert.count} ảnh chuyển khoản mới chờ kiểm`
      : "Khách vừa gửi ảnh chuyển khoản"
    : "";
  return (
    <>
      <div role="status" aria-atomic="true" className="sr-only">
        {alert && <span key={alert.id}>{text}</span>}
      </div>
      {alert && (
        <div
          key={alert.id}
          className="pn-success-toast"
          role="group"
          aria-label="Thông báo ảnh chuyển khoản mới"
          data-proof-alert
          style={{ "--toast-duration": `${durationMs}ms` } as CSSProperties}
        >
          <div className="flex items-center gap-3 p-3">
            <span
              className="pn-tone grid size-9 shrink-0 place-items-center rounded-xl"
              data-tone="warning"
            >
              <ImageIcon size={18} aria-hidden="true" />
            </span>
            <p
              className="min-w-0 flex-1 wrap-anywhere text-sm font-medium"
              aria-hidden="true"
            >
              {text}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                dismiss(alert.id);
                onOpen();
              }}
            >
              Xem
            </button>
            <button
              type="button"
              aria-label="Đóng thông báo"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink"
              onClick={() => dismiss(alert.id)}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="pn-success-toast-progress" aria-hidden="true" />
        </div>
      )}
    </>
  );
}
