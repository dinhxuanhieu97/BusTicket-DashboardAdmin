"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCheck,
  Clock,
  ImageIcon,
  Undo2,
} from "lucide-react";
import {
  attentionPlace,
  badgeText,
  unreadOf,
  type AttentionItem,
  type AttentionSeen,
} from "@/lib/attention";

const icons = {
  proofs: ImageIcon,
  review: AlertTriangle,
  refunds: Undo2,
  closing: Clock,
};

/**
 * Chuông thông báo ở topbar: huy hiệu là số việc mới (chưa đánh dấu đã đọc), bấm mở danh sách liên kết
 * tới trang xử lý. Danh sách luôn đủ mọi việc còn tồn, kể cả đã đọc: tab "Tất cả" chia hai nhóm Mới / Đã xem,
 * tab "Chưa đọc" chỉ giữ việc mới.
 */
export function NotificationBell({
  items,
  seen,
  unread,
  onMarkRead,
  onOpenProofs,
  onOpenPanel,
}: {
  items: AttentionItem[];
  /** Mốc đã đọc của từng loại việc (để tách nhóm Mới / Đã xem). */
  seen: AttentionSeen;
  unread: number;
  onMarkRead: () => void;
  /** Mở danh sách: ẩn thông báo bật lên đang che phía trên. */
  onOpenPanel?: () => void;
  /** Mục "ảnh chuyển khoản chờ kiểm" mở hộp danh sách tại chỗ. */
  onOpenProofs?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();
  const total = items.reduce((t, i) => t + i.count, 0);
  const fresh = items.filter((i) => unreadOf(i, seen) > 0);
  const read = items.filter((i) => unreadOf(i, seen) === 0);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const pick = () => setOpen(false);
  const group = (title: string, list: AttentionItem[]) =>
    list.length > 0 && (
      <div className="pn-notif-group" role="group" aria-label={title}>
        <h3 aria-hidden="true">{title}</h3>
        <ul>
          {list.map((item) => (
            <li key={item.key}>
              <NotificationItem
                item={item}
                fresh={unreadOf(item, seen)}
                onPick={pick}
                onOpenProofs={onOpenProofs}
              />
            </li>
          ))}
        </ul>
      </div>
    );

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
          unread
            ? `Thông báo: ${unread.toLocaleString("vi-VN")} việc mới cần chú ý`
            : total
              ? `Thông báo: đã đọc, còn ${total.toLocaleString("vi-VN")} việc cần chú ý`
              : "Thông báo: không có việc cần chú ý"
        }
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          if (!open) onOpenPanel?.();
          setOpen(!open);
        }}
      >
        <Bell size={17} aria-hidden="true" />
        {unread > 0 && (
          <span className="pn-bell-badge" aria-hidden="true">
            {badgeText(unread)}
          </span>
        )}
      </button>
      {open && (
        <div
          id={panelId}
          className="pn-account-menu pn-notif-panel"
          role="region"
          aria-labelledby={titleId}
        >
          <div className="pn-notif-head">
            <h2 id={titleId}>Thông báo</h2>
            {unread > 0 && (
              <button
                type="button"
                className="pn-notif-mark"
                aria-label="Đánh dấu đã đọc tất cả"
                onClick={() => {
                  onMarkRead();
                  button.current?.focus();
                }}
              >
                <CheckCheck size={15} aria-hidden="true" />
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          <div
            className="pn-notif-tabs"
            role="group"
            aria-label="Lọc thông báo"
          >
            <button
              type="button"
              aria-pressed={!onlyUnread}
              onClick={() => setOnlyUnread(false)}
            >
              Tất cả
            </button>
            <button
              type="button"
              aria-pressed={onlyUnread}
              onClick={() => setOnlyUnread(true)}
            >
              Chưa đọc
              {unread > 0 && (
                <span className="tabular-nums">{badgeText(unread)}</span>
              )}
            </button>
          </div>
          <div className="pn-notif-body scrollbar-clean">
            {items.length === 0 ? (
              <p className="pn-notif-empty">
                <BellOff size={20} aria-hidden="true" />
                Không có việc nào cần xử lý.
              </p>
            ) : onlyUnread && fresh.length === 0 ? (
              <p className="pn-notif-empty">
                <CheckCheck size={20} aria-hidden="true" />
                Bạn đã xem hết thông báo mới.
              </p>
            ) : (
              <>
                {group("Mới", fresh)}
                {!onlyUnread && group("Đã xem", read)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Một dòng thông báo: biểu tượng tròn, nội dung, nơi sẽ mở và chấm chưa đọc. */
function NotificationItem({
  item,
  fresh,
  onPick,
  onOpenProofs,
}: {
  item: AttentionItem;
  fresh: number;
  onPick: () => void;
  onOpenProofs?: () => void;
}) {
  const Icon = icons[item.key];
  const body = (
    <>
      <span className="pn-notif-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="pn-notif-text">
          <b className="tabular-nums">{item.count.toLocaleString("vi-VN")}</b>{" "}
          {item.label}
        </span>
        <span className="pn-notif-meta">
          {fresh > 0 ? (
            <>
              <em className="tabular-nums">
                {fresh.toLocaleString("vi-VN")} mới
              </em>{" "}
              · {attentionPlace(item)}
            </>
          ) : (
            <>Đã xem · {attentionPlace(item)}</>
          )}
        </span>
      </span>
      {fresh > 0 && <span className="pn-notif-dot" aria-hidden="true" />}
    </>
  );
  return item.opens === "proofs" && onOpenProofs ? (
    <button
      type="button"
      className="pn-notif-item"
      data-unread={fresh > 0 || undefined}
      onClick={() => {
        onPick();
        onOpenProofs();
      }}
    >
      {body}
    </button>
  ) : (
    <Link
      href={item.href}
      className="pn-notif-item"
      data-unread={fresh > 0 || undefined}
      onClick={onPick}
    >
      {body}
    </Link>
  );
}

/** Danh sách việc cần chú ý, dùng ở chuông (topbar) và ngăn "Thêm" trên điện thoại (GB7). */
export function AttentionLinks({
  items,
  onPick,
  onOpenProofs,
}: {
  items: AttentionItem[];
  onPick: () => void;
  onOpenProofs?: () => void;
}) {
  return (
    <ul>
      {items.map(({ key, count, label, href, opens }) => {
        const Icon = icons[key];
        const body = (
          <>
            <Icon size={16} aria-hidden="true" />
            <span>
              <b className="tabular-nums">{count.toLocaleString("vi-VN")}</b>{" "}
              {label}
            </span>
          </>
        );
        return (
          <li key={key}>
            {opens === "proofs" && onOpenProofs ? (
              <button
                type="button"
                className="pn-account-item w-full text-left"
                onClick={() => {
                  onPick();
                  onOpenProofs();
                }}
              >
                {body}
              </button>
            ) : (
              <Link href={href} className="pn-account-item" onClick={onPick}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
