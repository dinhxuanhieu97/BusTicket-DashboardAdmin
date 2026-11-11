"use client";
import { BrandMark } from "./brand";
import { logoUrl } from "@/lib/brand";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ReceiptText,
  Users,
  Bus,
  CalendarClock,
  History,
  ShieldCheck,
  Menu,
  Sun,
  Moon,
  Settings,
  ClipboardList,
} from "lucide-react";
import { roleLabels, type AppUser } from "@/lib/live-contracts";
import { visibleNav, type NavKey } from "@/lib/nav";
import { subscribeSessionEvents } from "@/lib/session-sync";
import { LogoutButton } from "./auth-forms";
import { Modal } from "../modal";
import { LoadState, StatusBadge } from "./shared";

const icons: Record<NavKey, typeof LayoutDashboard> = {
  assigned: ClipboardList,
  schedules: CalendarClock,
  overview: LayoutDashboard,
  payments: ReceiptText,
  users: Users,
  trips: Bus,
  audit: History,
  settings: Settings,
};

const navGroups: { title: string; keys: NavKey[] }[] = [
  { title: "Vận hành", keys: ["assigned", "overview", "trips", "schedules"] },
  { title: "Quản lý", keys: ["payments", "users", "audit", "settings"] },
];

export function LiveShell({
  children,
  user,
  permissions,
  tripWrite,
}: {
  children: React.ReactNode;
  user: AppUser;
  permissions?: string[];
  tripWrite: boolean;
}) {
  const path = usePathname();
  const granted = permissions ?? (user.role === "OWNER" ? undefined : []);
  const items = visibleNav(granted)
    .filter((item) => item.key !== "schedules" || tripWrite)
    .map((i) => ({
      ...i,
      icon: icons[i.key],
    }));
  const canReadProfile = granted?.includes("policy.read") ?? true;
  const permissionKey = JSON.stringify(permissions ?? null);
  const [operatorName, setOperatorName] = useState("Nhà xe");
  const [operatorLogo, setOperatorLogo] = useState<string | null>(null);
  useEffect(() => {
    if (!canReadProfile) return;
    const load = () => {
      void fetch("/api/operations/profile", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((p) => {
          if (p?.name) setOperatorName(p.name);
          if (p) setOperatorLogo(logoUrl(p.code, p.logoVersion ?? null));
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener("operator-profile-updated", load);
    return () => window.removeEventListener("operator-profile-updated", load);
  }, [canReadProfile]);
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(true);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    setDark(document.documentElement.dataset.theme !== "light");
    const desktop = window.matchMedia("(min-width: 64rem)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenu(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  function toggleTheme() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setDark(!dark);
    try {
      localStorage.setItem("pnticket_live_theme", next);
    } catch {}
  }

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
        if (res.status === 401 || data.error?.code === "OPERATOR_REQUIRED") {
          window.location.replace("/login");
          return;
        }
        if (res.ok && data.scope !== "full") {
          window.location.replace("/mfa");
          return;
        }
        // Tab khác đã đăng nhập tài khoản khác: tải lại để không hiện dữ liệu/quyền của người cũ.
        if (
          res.ok &&
          (data.user.id !== user.id ||
            data.user.operatorId !== user.operatorId ||
            data.user.role !== user.role ||
            data.user.mfaEnabled !== user.mfaEnabled ||
            JSON.stringify(data.permissions ?? null) !== permissionKey)
        ) {
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
    const onFocus = () => void check();
    const interval = setInterval(onFocus, 60000);
    const unsubscribe = subscribeSessionEvents(() => void check(true));
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [user.id, user.operatorId, user.role, user.mfaEnabled, permissionKey]);

  const currentItem = items.find((item) => item.href === path);
  const pageTitle = currentItem?.label ?? "Quản trị";
  const accountName = user.fullName?.trim() || user.phone;

  const navigation = (
    <>
      <Link
        href="/admin"
        className="pn-panel-inline flex min-h-18 min-w-0 shrink-0 items-center gap-3 border-b border-line py-4"
        onClick={() => setMenu(false)}
      >
        <BrandMark name={operatorName} logoUrl={operatorLogo} />
        <span className="min-w-0">
          <strong className="block wrap-anywhere text-base font-semibold leading-tight text-ink">
            {operatorName}
          </strong>
          <span className="mt-1 block text-xs text-muted">Quản trị nhà xe</span>
        </span>
      </Link>
      <nav
        aria-label="Điều hướng quản trị"
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4"
      >
        {navGroups.map(({ title, keys }) => {
          const group = keys.flatMap((key) =>
            items.filter((item) => item.key === key),
          );
          if (!group.length) return null;
          return (
            <div key={title} className="space-y-1">
              <p className="px-3 pb-1 text-xs font-semibold text-muted">
                {title}
              </p>
              {group.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenu(false)}
                  aria-current={path === href ? "page" : undefined}
                  className="pn-nav-link"
                >
                  <Icon size={17} className="shrink-0" aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="pn-panel-inset shrink-0 space-y-3 border-t border-line">
        <div className="flex min-w-0 items-center gap-3">
          <span className="pn-avatar size-9 text-sm" aria-hidden="true">
            {accountName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" title={accountName}>
              {accountName}
            </p>
            <p className="text-xs text-muted">{roleLabels[user.role]}</p>
          </div>
        </div>
        <LogoutButton />
      </div>
    </>
  );

  return (
    <div className="min-h-dvh lg:pl-60">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-panel focus:p-3"
      >
        Đến nội dung chính
      </a>
      <aside className="pn-sidebar fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line lg:flex">
        {navigation}
      </aside>
      {menu && (
        <Modal drawer title="Điều hướng" onClose={() => setMenu(false)}>
          {navigation}
        </Modal>
      )}
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex min-h-16 max-w-[96rem] items-center justify-between gap-3 pn-page-inline">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="icon-btn lg:hidden"
              aria-label="Mở menu"
              aria-expanded={menu}
              aria-haspopup="dialog"
              onClick={() => setMenu(true)}
            >
              <Menu size={18} aria-hidden="true" />
            </button>
            <p className="min-w-0 truncate text-sm text-muted">
              {operatorName}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {!sessionError && (
              <span className="hidden sm:inline-flex">
                <StatusBadge
                  tone="success"
                  label="Phiên được bảo vệ"
                  icon={ShieldCheck}
                />
              </span>
            )}
            <button
              type="button"
              className="icon-btn"
              aria-label="Đổi giao diện"
              aria-pressed={!dark}
              onClick={toggleTheme}
              title={
                dark
                  ? "Chuyển sang giao diện sáng"
                  : "Chuyển sang giao diện tối"
              }
            >
              {dark ? (
                <Sun size={17} aria-hidden="true" />
              ) : (
                <Moon size={17} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-[96rem] pn-page-inline py-4 sm:py-6"
      >
        <h1 className="mb-4 text-xl font-semibold tracking-tight sm:mb-6">
          {pageTitle}
        </h1>
        {sessionError ? (
          <LoadState
            error={sessionError}
            reload={() => window.location.reload()}
            retryLabel="Xác minh lại"
          />
        ) : (
          children
        )}
        <footer className="mt-6 border-t border-line pt-4 sm:mt-8 text-xs text-muted">
          {operatorName} · Giờ Việt Nam (UTC+7)
        </footer>
      </main>
    </div>
  );
}
