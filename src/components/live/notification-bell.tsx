"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Bell, Clock, Undo2 } from "lucide-react";
import type { Counters } from "@/lib/live-contracts";
import { attentionItems, badgeText, type AttentionItem } from "@/lib/attention";

const icons = { review: AlertTriangle, refunds: Undo2, closing: Clock };

/** Chuông thông báo ở topbar: số việc cần chú ý, bấm mở danh sách liên kết tới trang xử lý. */
export function NotificationBell({ counters }: { counters: Counters }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const items = attentionItems(counters);
  const total = items.reduce((t, i) => t + i.count, 0);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div
      ref={wrap}
      // Điện thoại: topbar không đủ chỗ (tiêu đề bị cắt ở 320px); số việc vẫn hiện trên menu trong ngăn "Thêm".
      className="relative shrink-0 max-sm:hidden"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className="icon-btn relative"
        aria-label={
          total
            ? `Thông báo: ${total.toLocaleString("vi-VN")} việc cần chú ý`
            : "Thông báo: không có việc cần chú ý"
        }
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={17} aria-hidden="true" />
        {total > 0 && (
          <span className="pn-bell-badge" aria-hidden="true">
            {badgeText(total)}
          </span>
        )}
      </button>
      {open && (
        <div
          id={panelId}
          className="pn-account-menu"
          role="region"
          aria-label="Thông báo"
        >
          <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-[0.1em] text-faint uppercase">
            Cần chú ý
          </p>
          {items.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-muted">
              Không có việc nào cần xử lý.
            </p>
          ) : (
            <AttentionLinks items={items} onPick={() => setOpen(false)} />
          )}
        </div>
      )}
    </div>
  );
}

/** Danh sách việc cần chú ý, dùng ở chuông (topbar) và ngăn "Thêm" trên điện thoại (GB7). */
export function AttentionLinks({
  items,
  onPick,
}: {
  items: AttentionItem[];
  onPick: () => void;
}) {
  return (
    <ul>
      {items.map(({ key, count, label, href }) => {
        const Icon = icons[key];
        return (
          <li key={key}>
            <Link href={href} className="pn-account-item" onClick={onPick}>
              <Icon size={16} aria-hidden="true" />
              <span>
                <b className="tabular-nums">{count.toLocaleString("vi-VN")}</b>{" "}
                {label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
