"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ReceiptText,
  Users,
  Bus,
  History,
  ShieldCheck,
  Menu,
  Sun,
  Moon,
  Settings,
} from "lucide-react";
import type { AppUser } from "@/lib/live-contracts";
import { visibleNav, type NavKey } from "@/lib/nav";
import { subscribeSessionEvents } from "@/lib/session-sync";
import { LogoutButton } from "./auth-forms";
const icons: Record<NavKey, typeof LayoutDashboard> = {
  schedules: Bus,
  overview: LayoutDashboard,
  payments: ReceiptText,
  users: Users,
  trips: Bus,
  audit: History,
  settings: Settings,
};
export function LiveShell({
  children,
  user,
  permissions,
}: {
  children: React.ReactNode;
  user: AppUser;
  permissions?: string[];
}) {
  const path = usePathname();
  const items = visibleNav(permissions).map((i) => ({
    ...i,
    icon: icons[i.key],
  }));
  const [operatorName, setOperatorName] = useState("Nhà xe");
  useEffect(() => {
    const load = () => {
      void fetch("/api/operations/profile", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((p) => {
          if (p?.name) setOperatorName(p.name);
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener("operator-profile-updated", load);
    return () => window.removeEventListener("operator-profile-updated", load);
  }, []);
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(true);
  const [sessionError, setSessionError] = useState("");
  useEffect(() => {
    try {
      setDark(localStorage.getItem("pnticket_live_theme") !== "light");
    } catch {}
    document.documentElement.style.removeProperty("--accent");
    document.documentElement.removeAttribute("data-animations");
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("pnticket_live_theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let checking = false;
    // Tin từ tab khác tới lúc đang kiểm tra (yêu cầu cũ có thể còn mang cookie cũ) → kiểm tra lại ngay sau đó.
    let recheck = false;
    // force = tab khác vừa đổi phiên: kiểm tra ngay cả khi tab này đang ẩn.
    const check = async (force = false) => {
      if (checking) {
        if (force) recheck = true;
        return;
      }
      if (document.hidden && !force) return;
      checking = true;
      try {
        const res = await fetch("/api/auth/session", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json();
        if (!active) return;
        if (res.status === 401 || data.error?.code === "OWNER_REQUIRED") {
          window.location.replace("/login");
          return;
        }
        if (res.ok && data.scope !== "full") {
          window.location.replace("/mfa");
          return;
        }
        // Tab khác đã đăng nhập tài khoản khác: tải lại để không hiện dữ liệu/quyền của người cũ.
        if (res.ok && data.user.id !== user.id) {
          window.location.reload();
          return;
        }
        setSessionError(
          res.ok
            ? ""
            : "Chưa xác minh lại được phiên. Dữ liệu cũ đã tạm ẩn; vui lòng thử lại.",
        );
      } catch {
        if (active) setSessionError("Mất kết nối xác thực. Dữ liệu đã tạm ẩn.");
      } finally {
        checking = false;
        if (recheck && active) {
          recheck = false;
          void check(true);
        }
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    const onFocus = () => void check();
    const interval = setInterval(onFocus, 60000);
    const unsubscribe = subscribeSessionEvents(() => void check(true));
    window.addEventListener("focus", onFocus);
    window.addEventListener("keydown", key);
    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
      unsubscribe();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("keydown", key);
    };
  }, [user.id]);
  return (
    <div className="pn-workspace min-h-screen lg:pl-60">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-panel focus:p-3"
      >
        Đến nội dung chính
      </a>
      {menu && (
        <button
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          aria-label="Đóng menu"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        className={`pn-sidebar fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-panel ${menu ? "visible translate-x-0" : "invisible -translate-x-full lg:visible lg:translate-x-0"}`}
      >
        <Link href="/admin" className="flex h-24 items-center gap-3 px-6">
          <span className="grid size-10 place-content-center rounded-xl bg-gradient-to-br from-accent to-cyan-400 text-xl font-bold text-white">
            P
          </span>
          <strong className="text-xl">{operatorName}</strong>
        </Link>
        <nav aria-label="Điều hướng quản trị" className="space-y-1 px-4">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenu(false)}
              aria-current={path === href ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${path === href ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface hover:text-ink"}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-4 p-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-relaxed">
            <strong className="mb-1 block text-emerald-500">
              Dữ liệu thật
            </strong>
            <span className="text-muted">Quyền OWNER · 2FA đã bật</span>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <main
        id="main"
        className="mx-auto max-w-[1680px] px-4 py-6 sm:px-7 lg:px-9 lg:py-8"
      >
        <header className="mb-7 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              className="icon-btn lg:hidden"
              aria-label="Mở menu"
              onClick={() => setMenu(true)}
            >
              <Menu size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold">
                {items.find((i) => i.href === path)?.label || "Quản trị"}
              </h1>
              <p className="mt-1 text-xs text-muted">
                PNTicket · Khu quản trị OWNER
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1 text-xs text-emerald-500 sm:flex">
              <ShieldCheck size={16} />
              {path === "/admin/trips" ? "Quản lý chuyến" : "Chỉ đọc"}
            </span>
            <button
              className="icon-btn"
              aria-label="Đổi giao diện"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>
        {sessionError ? (
          <div className="card p-8">
            <p role="alert" className="text-amber-400">
              {sessionError}
            </p>
            <button
              className="btn mt-5"
              onClick={() => window.location.reload()}
            >
              Xác minh lại
            </button>
          </div>
        ) : (
          children
        )}
        <footer className="mt-8 border-t border-line pt-5 text-xs text-muted">
          {operatorName} · Giờ Việt Nam (UTC+7).
        </footer>
      </main>
    </div>
  );
}
