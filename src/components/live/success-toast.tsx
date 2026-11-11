import { Check, X } from "lucide-react";
import { useEffect, type CSSProperties } from "react";

const durationMs = 5000;

export type SuccessMessage = { id: number; text: string };

export function SuccessToast({
  message,
  dismiss,
}: {
  message: SuccessMessage | null;
  dismiss: (id: number) => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => dismiss(message.id), durationMs);
    return () => window.clearTimeout(timer);
  }, [message, dismiss]);

  return (
    <>
      <div role="status" aria-atomic="true" className="sr-only">
        {message && <span key={message.id}>{message.text}</span>}
      </div>
      {message && (
        <div
          key={message.id}
          className="pn-success-toast"
          role="group"
          aria-label="Thông báo lưu thành công"
          style={{ "--toast-duration": `${durationMs}ms` } as CSSProperties}
        >
          <div className="flex items-center gap-3 p-3">
            <span
              className="pn-tone grid size-9 shrink-0 place-items-center rounded-xl"
              data-tone="success"
            >
              <Check size={18} aria-hidden="true" />
            </span>
            <p
              className="min-w-0 flex-1 wrap-anywhere text-sm font-medium"
              aria-hidden="true"
            >
              {message.text}
            </p>
            <button
              type="button"
              aria-label="Đóng thông báo"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink"
              onClick={() => dismiss(message.id)}
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
