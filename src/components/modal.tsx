"use client";
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
export function Modal({
  title,
  wide = false,
  drawer = false,
  onClose,
  children,
}: {
  title: string;
  wide?: boolean;
  drawer?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const previous = document.activeElement as HTMLElement | null;
    el.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="pn-dialog"
      data-wide={wide || undefined}
      data-drawer={drawer || undefined}
      aria-labelledby={headingId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header className="pn-panel-inline flex shrink-0 items-center justify-between gap-4 border-b border-line bg-panel py-3">
        <h2 id={headingId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="icon-btn btn-ghost"
          aria-label={drawer ? "Đóng menu" : "Đóng"}
          autoFocus
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div
        className={
          drawer
            ? "flex min-h-0 flex-1 flex-col"
            : "pn-panel-inset min-h-0 overflow-y-auto"
        }
      >
        {children}
      </div>
    </dialog>
  );
}
