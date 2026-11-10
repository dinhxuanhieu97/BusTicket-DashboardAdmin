"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export function Modal({
  title,
  wide = false,
  onClose,
  children,
}: {
  title: string;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
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
      className={
        wide ? "max-sm:h-dvh max-sm:max-h-dvh max-sm:rounded-none" : undefined
      }
      style={wide ? { width: "min(100vw, 820px)" } : undefined}
      aria-labelledby="modal-heading"
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
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-panel p-5">
        <h2 id="modal-heading" className="text-lg font-bold">
          {title}
        </h2>
        <button onClick={onClose} className="icon-btn" aria-label="Đóng">
          <X size={18} />
        </button>
      </header>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
