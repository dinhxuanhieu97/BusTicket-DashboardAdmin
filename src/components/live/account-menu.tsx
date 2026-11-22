"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { KeyRound, LifeBuoy, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { useLogout } from "./auth-forms";

type Props = {
  name: string;
  role: string;
  phone: string;
  dark: boolean;
  toggleTheme: () => void;
};

// Menu tài khoản ở topbar theo mẫu WAI-ARIA "menu button":
// Enter/Space/↓ mở và focus mục đầu, ↑ mở và focus mục cuối, ↑↓ Home End di chuyển,
// Esc/Tab đóng; Esc trả focus về nút avatar.
export function AccountMenu({ name, role, phone, dark, toggleTheme }: Props) {
  const [open, setOpen] = useState(false);
  const { busy, error, logout } = useLogout();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const focusAt = useRef<"first" | "last">("first");

  const items = () =>
    Array.from(
      wrap.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [],
    );

  useEffect(() => {
    if (!open) return;
    const list = items();
    (focusAt.current === "last" ? list.at(-1) : list[0])?.focus();
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function openMenu(at: "first" | "last") {
    focusAt.current = at;
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) button.current?.focus();
  }

  function onMenuKey(e: KeyboardEvent) {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      list[(n + list.length) % list.length]?.focus();
    };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(list.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") close(false);
  }

  const initial = name.charAt(0).toUpperCase();

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        ref={button}
        type="button"
        className="pn-avatar-btn"
        aria-label={`Tài khoản: ${name} · ${role}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : openMenu("first"))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openMenu(e.key === "ArrowUp" ? "last" : "first");
          }
        }}
      >
        <span className="pn-avatar-round" aria-hidden="true">
          {initial}
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Tài khoản"
          className="pn-account-menu"
          onKeyDown={onMenuKey}
        >
          <div className="pn-account-head">
            <span className="pn-avatar-round" aria-hidden="true">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{name}</span>
              <span className="block truncate text-xs text-muted">
                {role} · {phone}
              </span>
            </span>
          </div>
          <div role="none" className="pn-account-sep" />
          <Link
            role="menuitem"
            tabIndex={-1}
            href="/admin/settings"
            className="pn-account-item"
            onClick={() => setOpen(false)}
          >
            <UserRound size={16} aria-hidden="true" />
            Thông tin tài khoản
          </Link>
          <Link
            role="menuitem"
            tabIndex={-1}
            href="/admin/settings#change-password"
            className="pn-account-item"
            onClick={() => setOpen(false)}
          >
            <KeyRound size={16} aria-hidden="true" />
            Đổi mật khẩu
          </Link>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={dark}
            tabIndex={-1}
            className="pn-account-item"
            onClick={toggleTheme}
          >
            {dark ? (
              <Moon size={16} aria-hidden="true" />
            ) : (
              <Sun size={16} aria-hidden="true" />
            )}
            Giao diện tối
            <span className="pn-mini-switch" aria-hidden="true" />
          </button>
          <Link
            role="menuitem"
            tabIndex={-1}
            href="/admin/help"
            className="pn-account-item"
            onClick={() => setOpen(false)}
          >
            <LifeBuoy size={16} aria-hidden="true" />
            Trợ giúp & phím tắt
          </Link>
          <div role="none" className="pn-account-sep" />
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="pn-account-item pn-account-danger"
            disabled={busy}
            onClick={logout}
          >
            <LogOut size={16} aria-hidden="true" />
            {busy ? "Đang đăng xuất…" : "Đăng xuất"}
          </button>
          {error && (
            <p role="alert" className="px-3 pb-2 text-xs text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
