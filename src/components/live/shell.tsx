"use client";
import { BrandMark } from "./brand";
import { logoUrl } from "@/lib/brand";
import { applyBrandPalette } from "@/lib/brand-palette";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { nextScrollChrome } from "@/lib/scroll-chrome";
import { topbarDateTime } from "@/lib/overview";
import {
  LayoutDashboard,
  Route,
  ReceiptText,
  Users,
  Bus,
  CalendarClock,
  History,
  ShieldCheck,
  Menu,
  ChevronLeft,
  Search,
  Plus,
  MoreHorizontal,
  Sun,
  Moon,
  Settings,
  ClipboardList,
  Contact,
  BusFront,
  LayoutGrid,
  LifeBuoy,
  TrendingUp,
} from "lucide-react";
import { roleLabels, type AppUser, type Counters } from "@/lib/live-contracts";
import {
  groupNav,
  mobileNav,
  sidebarGroups,
  visibleNav,
  type NavKey,
} from "@/lib/nav";
import { subscribeSessionEvents } from "@/lib/session-sync";
import { LogoutButton } from "./auth-forms";
import { AccountMenu } from "./account-menu";
import { Modal } from "../modal";
import { LoadState } from "./shared";
import { BookingQuickView } from "./booking-quick-view";
import { CommandPalette, type PaletteItem } from "./command-palette";
import { AttentionLinks, NotificationBell } from "./notification-bell";
import { PendingProofsDialog, type PendingProofPick } from "./pending-proofs";
import { ProofAlertToast, type ProofAlert } from "./proof-alert-toast";
import { useResource } from "./use-resource";
import {
  ATTENTION_SEEN_KEY,
  attentionItems,
  badgeText,
  markAllSeen,
  navBadges,
  newProofs,
  parseSeen,
  settleSeen,
  unreadCount,
  type AttentionSeen,
} from "@/lib/attention";

/** Chu kỳ làm mới chuông (ms). */
const COUNTERS_REFRESH_MS = 30_000;

const icons: Record<NavKey, typeof LayoutDashboard> = {
  assigned: ClipboardList,
  schedules: CalendarClock,
  overview: LayoutDashboard,
  payments: ReceiptText,
  users: Users,
  fleet: BusFront,
  routes: Route,
  trips: Bus,
  passengers: Contact,
  audit: History,
  settings: Settings,
  revenue: TrendingUp,
  seats: LayoutGrid,
  help: LifeBuoy,
};

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
  const canReadTrips = granted?.includes("trip.read") ?? true;
  // Chuông + số trên menu (GF2). Backend cũ chưa có `counters` thì lỗi → ẩn chuông, không báo lỗi.
  const counters = useResource<Counters>(canReadTrips ? "counters" : null);
  const firstPath = useRef(true);
  const reloadCounters = counters.reload;
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    reloadCounters();
    // Tải lại khi đổi trang (vd. vừa xử lý xong khoản thu); `reload` đổi mỗi lần render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  // Làm mới định kỳ để chuông và thông báo ảnh chuyển khoản "cập nhật ngay" (QS01); chỉ khi tab đang hiện.
  useEffect(() => {
    if (!canReadTrips) return;
    const tick = () => {
      if (document.visibilityState === "visible") reloadCounters();
    };
    const timer = window.setInterval(tick, COUNTERS_REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
    // `reload` đổi mỗi lần render; hẹn giờ chỉ cần đặt một lần.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReadTrips]);
  // Lúc đang tải lại vẫn giữ số cũ, để chuông không chớp tắt mỗi lần làm mới.
  const [lastCounters, setLastCounters] = useState<Counters | null>(null);
  const [proofAlert, setProofAlert] = useState<ProofAlert | null>(null);
  const [proofsOpen, setProofsOpen] = useState(false);
  const knownProofs = useRef<number | null>(null);
  useEffect(() => {
    if (!counters.data) return;
    setLastCounters(counters.data);
    const fresh = newProofs(knownProofs.current, counters.data.proofsPending);
    if (fresh) setProofAlert({ id: Date.now(), count: fresh });
    knownProofs.current = counters.data.proofsPending ?? null;
  }, [counters.data]);
  const dismissProofAlert = useCallback(
    (id: number) => setProofAlert((a) => (a?.id === id ? null : a)),
    [],
  );
  const shownCounters = counters.data ?? lastCounters;
  const badges = navBadges(shownCounters);
  // Điện thoại không có chuông (GB7): việc cần chú ý nằm đầu ngăn "Thêm", tổng số hiện trên nút "Thêm".
  const attention = shownCounters ? attentionItems(shownCounters) : [];
  // "Đánh dấu đã đọc tất cả": huy hiệu chỉ đếm việc mới; mốc lưu trên máy người xem.
  const [seen, setSeen] = useState<AttentionSeen>({});
  useEffect(() => {
    try {
      setSeen(parseSeen(localStorage.getItem(ATTENTION_SEEN_KEY)));
    } catch {
      /* Không đọc được bộ nhớ trình duyệt: coi như chưa đọc. */
    }
  }, []);
  const saveSeen = (next: AttentionSeen) => {
    setSeen(next);
    try {
      localStorage.setItem(ATTENTION_SEEN_KEY, JSON.stringify(next));
    } catch {
      /* Chỉ mất mốc đã đọc khi tải lại trang. */
    }
  };
  const attentionKey = JSON.stringify(attention);
  useEffect(() => {
    if (!shownCounters) return;
    const next = settleSeen(attention, seen);
    if (next !== seen) saveSeen(next);
    // Chỉ chạy khi số việc đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attentionKey, seen]);
  const attentionCount = unreadCount(attention, seen);
  const markAttentionRead = () => saveSeen(markAllSeen(attention));
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
          // Màu giao diện theo nhà xe đang đăng nhập (API cũ không có trường → giữ màu đang hiện).
          if (p && "brandColors" in p) applyBrandPalette(p.brandColors);
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener("operator-profile-updated", load);
    return () => window.removeEventListener("operator-profile-updated", load);
  }, [canReadProfile]);
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const [quickBooking, setQuickBooking] = useState<PendingProofPick | null>(
    null,
  );
  const can = (permission: string) => granted?.includes(permission) ?? true;
  const [now, setNow] = useState("");
  const [dark, setDark] = useState(true);
  // Cuộn xuống thì ẩn thanh trên cùng và thanh điều hướng dưới để có thêm chỗ xem; cuộn lên thì hiện lại.
  const [chromeHidden, setChromeHidden] = useState(false);
  useEffect(() => {
    let state = { hidden: false, anchor: window.scrollY };
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const atBottom =
          y + window.innerHeight >= document.documentElement.scrollHeight - 2;
        state = nextScrollChrome(state, y, undefined, undefined, atBottom);
        setChromeHidden(state.hidden);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  // Đổi trang thì hiện lại; đang dùng bàn phím trong thanh thì không ẩn.
  useEffect(() => setChromeHidden(false), [path]);
  const showChrome = () => setChromeHidden(false);
  // Sidebar desktop thu gọn (chỉ icon). Trạng thái ban đầu do script trong layout đặt lên <html> để không nháy.
  const [collapsed, setCollapsed] = useState(false);
  // Nhãn nổi khi thanh bên thu gọn. Render qua portal: menu có thanh cuộn (cắt mất nhãn) và
  // `backdrop-filter` của thanh bên làm `position: fixed` bên trong bị lệch (GF5).
  const [tip, setTip] = useState<{
    label: string;
    top: number;
    left: number;
  } | null>(null);
  const showTip = (e: SyntheticEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(
      ".pn-nav-link, .btn-ghost, [data-tip]",
    );
    const label = el?.dataset.tip ?? el?.getAttribute("aria-label");
    // Nút thu gọn luôn có nhãn; các mục khác chỉ cần khi chữ đang bị ẩn.
    const always = el?.classList.contains("pn-sidebar-collapse");
    if (
      !el ||
      !label ||
      (!always && document.documentElement.dataset.sidebar !== "collapsed") ||
      !window.matchMedia("(min-width: 64rem)").matches
    )
      return setTip(null);
    const r = el.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2, left: r.right + 12 });
  };
  const hideTip = () => setTip(null);
  useEffect(() => {
    if (!tip) return;
    // WCAG 1.4.13: đóng được bằng Esc mà không phải dời chuột/focus.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setTip(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hideTip, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hideTip, true);
    };
  }, [tip]);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    setDark(document.documentElement.dataset.theme !== "light");
    setCollapsed(document.documentElement.dataset.sidebar === "collapsed");
    const desktop = window.matchMedia("(min-width: 64rem)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenu(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  function setSidebarCollapsed(next: boolean) {
    if (next) document.documentElement.dataset.sidebar = "collapsed";
    else delete document.documentElement.dataset.sidebar;
    setTip(null);
    setCollapsed(next);
    try {
      localStorage.setItem("pnticket_sidebar_collapsed", next ? "1" : "0");
    } catch {}
  }

  // Phím "[" thu gọn/mở rộng sidebar trên desktop, trừ khi đang gõ trong ô nhập.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))
      )
        return;
      if (!window.matchMedia("(min-width: 64rem)").matches) return;
      e.preventDefault();
      setSidebarCollapsed(
        document.documentElement.dataset.sidebar !== "collapsed",
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ngày giờ ở đầu trang theo giờ Việt Nam; chỉ tính ở trình duyệt để không lệch khi hydrate.
  useEffect(() => {
    const tick = () => setNow(topbarDateTime(new Date()));
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, []);

  // ⌘K / Ctrl+K mở hộp tìm nhanh; bỏ qua khi giữ phím hoặc đang có hộp thoại khác.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      if (e.repeat || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      setPalette(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  const groups = groupNav(items);
  const quick = mobileNav(items);
  const paletteItems = groups.flatMap((g) =>
    g.items.map((i) => ({
      href: i.href,
      label: i.label,
      group: g.title,
      icon: i.icon,
    })),
  );
  const currentItem = items.find((item) => item.href === path);
  const pageTitle = currentItem?.label ?? "Quản trị";
  const accountName = user.fullName?.trim() || user.phone;

  const navigation = (
    <>
      <Link
        href="/admin"
        className="pn-sidebar-brand flex min-h-18 min-w-0 shrink-0 items-center gap-3 px-5 pt-5 pb-3"
        onClick={() => setMenu(false)}
        title={operatorName}
      >
        <BrandMark name={operatorName} logoUrl={operatorLogo} />
        <span className="pn-sidebar-text min-w-0">
          <strong className="block wrap-anywhere text-base font-semibold leading-tight text-ink">
            {operatorName}
          </strong>
          <span className="mt-1 block text-xs text-muted">Quản trị nhà xe</span>
        </span>
      </Link>
      <nav
        aria-label="Điều hướng quản trị"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-2"
      >
        {sidebarGroups(groups).map(({ id, title, items: group }) => (
          <div key={id} className="space-y-1">
            <p className="pn-nav-group">{title}</p>
            {group.map(({ key, href, label, icon: Icon }) => {
              const badge = badges[key] ?? 0;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenu(false)}
                  aria-current={path === href ? "page" : undefined}
                  aria-label={label}
                  aria-description={
                    badge
                      ? `${badge} ${key === "trips" ? "chuyến đóng bán trong 2 giờ" : "khoản cần đối soát"}`
                      : undefined
                  }
                  data-badge={badge || undefined}
                  className="pn-nav-link"
                >
                  <Icon size={18} className="shrink-0" aria-hidden="true" />
                  <span className="pn-sidebar-text">{label}</span>
                  {badge > 0 && (
                    <span className="pn-nav-badge" aria-hidden="true">
                      {badgeText(badge)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div
        className={`pn-sidebar-status mx-3 mt-2 flex shrink-0 items-center gap-3 rounded-2xl border border-line bg-surface/60 p-3 ${sessionError ? "text-warning" : ""}`}
        data-tip={sessionError || "Phiên được bảo vệ · Giờ Việt Nam (UTC+7)"}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-[0.6875rem] bg-accent-soft text-accent">
          <ShieldCheck size={18} aria-hidden="true" />
        </span>
        <span className="pn-sidebar-text min-w-0 text-xs leading-snug">
          <b className="block text-sm font-medium text-ink">
            {sessionError ? "Cần xác minh lại phiên" : "Phiên được bảo vệ"}
          </b>
          <span className="text-muted">Giờ Việt Nam (UTC+7)</span>
        </span>
      </div>
      <div className="pn-sidebar-account shrink-0 space-y-3 px-5 pt-3 pb-5">
        <div
          className="pn-sidebar-who flex min-w-0 items-center gap-3"
          data-tip={`${accountName} · ${roleLabels[user.role]}`}
        >
          <span
            className="pn-avatar size-9 shrink-0 text-sm"
            aria-hidden="true"
          >
            {accountName.charAt(0).toUpperCase()}
          </span>
          <div className="pn-sidebar-text min-w-0">
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
    <div className="pn-shell">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-panel focus:p-3"
      >
        Đến nội dung chính
      </a>
      <aside
        className="pn-sidebar pn-glass hidden flex-col lg:flex"
        onMouseOver={showTip}
        onFocus={showTip}
        onMouseLeave={hideTip}
        onBlur={hideTip}
      >
        <button
          type="button"
          className="pn-sidebar-collapse"
          aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
          aria-expanded={!collapsed}
          aria-keyshortcuts="["
          data-tip={collapsed ? "Mở rộng menu  [" : "Thu gọn menu  ["}
          onClick={() => setSidebarCollapsed(!collapsed)}
        >
          {/* Một mũi tên, xoay 180° theo trạng thái (CSS dựa vào aria-expanded). */}
          <ChevronLeft size={15} strokeWidth={2.5} aria-hidden="true" />
        </button>
        {navigation}
      </aside>
      {tip &&
        createPortal(
          <div
            role="tooltip"
            className="pn-nav-tip"
            style={{ top: tip.top, left: tip.left }}
          >
            {tip.label}
          </div>,
          document.body,
        )}
      {menu && (
        <Modal drawer title="Điều hướng" onClose={() => setMenu(false)}>
          {attention.length > 0 && (
            <section
              aria-label="Cần chú ý"
              className="pn-drawer-attention mx-3 mt-3 rounded-2xl border border-line sm:hidden"
            >
              <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-[0.1em] text-faint uppercase">
                Cần chú ý
              </p>
              <AttentionLinks
                items={attention}
                onPick={() => setMenu(false)}
                onOpenProofs={() => setProofsOpen(true)}
              />
              {attentionCount > 0 && (
                <button
                  type="button"
                  className="pn-mark-read"
                  onClick={markAttentionRead}
                >
                  Đánh dấu đã đọc tất cả
                </button>
              )}
            </section>
          )}
          {navigation}
        </Modal>
      )}
      {palette && (
        <CommandPalette
          items={paletteItems}
          searchData={granted?.includes("trip.read") ?? true}
          onClose={() => setPalette(false)}
          onBooking={(item: PaletteItem) =>
            item.booking &&
            setQuickBooking({ ...item.booking, href: item.href })
          }
        />
      )}
      {proofsOpen && (
        <PendingProofsDialog
          onClose={() => setProofsOpen(false)}
          onPick={(pick) => {
            setProofsOpen(false);
            setQuickBooking(pick);
          }}
        />
      )}
      <ProofAlertToast
        alert={proofAlert}
        dismiss={dismissProofAlert}
        onOpen={() => setProofsOpen(true)}
      />
      {quickBooking && (
        <BookingQuickView
          key={quickBooking.code}
          code={quickBooking.code}
          tripId={quickBooking.tripId}
          listHref={quickBooking.href}
          canEdit={can("booking.update")}
          canPay={can("payment.record")}
          canBoard={can("booking.board")}
          canReadPayments={can("payment.read")}
          onClose={() => {
            setQuickBooking(null);
            // Vừa ghi nhận tiền thì số chờ kiểm đổi ngay.
            reloadCounters();
          }}
        />
      )}
      <header
        className="pn-topbar pn-glass flex min-h-16 items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 lg:pl-6"
        data-hidden={chromeHidden && !menu && !palette ? "true" : undefined}
        onFocus={showChrome}
      >
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
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {pageTitle}
          </h1>
          <p className="hidden truncate text-xs text-muted sm:block">
            {now || "\u00a0"}
          </p>
        </div>
        <button
          type="button"
          className="hidden min-h-11 w-60 items-center gap-2.5 rounded-[0.8125rem] border border-line bg-surface px-3 text-sm text-muted transition-colors hover:text-ink md:flex xl:w-72"
          aria-label="Tìm nhanh"
          aria-keyshortcuts="Meta+K Control+K"
          aria-haspopup="dialog"
          onClick={() => setPalette(true)}
        >
          <Search size={17} aria-hidden="true" />
          <span className="flex-1 text-left">
            {(granted?.includes("trip.read") ?? true)
              ? "Tìm trang, vé, chuyến…"
              : "Tìm trang…"}
          </span>
          <kbd className="pn-kbd font-sans">⌘K</kbd>
        </button>
        <button
          type="button"
          className="icon-btn md:hidden"
          aria-label="Tìm nhanh"
          aria-haspopup="dialog"
          onClick={() => setPalette(true)}
        >
          <Search size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          // Điện thoại: đổi giao diện trong menu tài khoản để topbar đủ chỗ cho tiêu đề (GF20).
          className="icon-btn max-sm:hidden"
          aria-label="Đổi giao diện"
          aria-pressed={!dark}
          onClick={toggleTheme}
          title={
            dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"
          }
        >
          {dark ? (
            <Sun size={17} aria-hidden="true" />
          ) : (
            <Moon size={17} aria-hidden="true" />
          )}
        </button>
        {/* Trang Chuyến xe đã có nút "+ Thêm chuyến" ở đầu trang (GF6). */}
        {tripWrite && path !== "/admin/trips" && (
          <Link
            href="/admin/trips?create=1"
            className="btn btn-primary max-sm:w-[var(--control-height)] max-sm:px-0"
            aria-label="Tạo chuyến"
          >
            <Plus size={17} aria-hidden="true" />
            <span className="hidden sm:inline">Tạo chuyến</span>
          </Link>
        )}
        {shownCounters && (
          <NotificationBell
            items={attention}
            unread={attentionCount}
            onMarkRead={markAttentionRead}
            onOpenProofs={() => setProofsOpen(true)}
            onOpenPanel={() => setProofAlert(null)}
          />
        )}
        <AccountMenu
          name={accountName}
          role={roleLabels[user.role]}
          phone={user.phone}
          dark={dark}
          toggleTheme={toggleTheme}
        />
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto mt-4 max-w-[96rem] outline-none sm:mt-6"
      >
        {sessionError ? (
          <LoadState
            error={sessionError}
            reload={() => window.location.reload()}
            retryLabel="Xác minh lại"
          />
        ) : (
          children
        )}
        <footer className="mt-6 border-t border-line pt-4 text-xs text-muted sm:mt-8">
          {operatorName} · Giờ Việt Nam (UTC+7)
        </footer>
      </main>
      {!menu && quick.length > 0 && (
        <nav
          aria-label="Điều hướng nhanh"
          className="pn-bottom-nav pn-glass"
          data-hidden={chromeHidden && !menu ? "true" : undefined}
          onFocus={showChrome}
        >
          {quick.map(({ href, label, short, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={short ? label : undefined}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{short ?? label}</span>
            </Link>
          ))}
          {items.length > quick.length && (
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={
                attentionCount
                  ? `Thêm, ${attentionCount.toLocaleString("vi-VN")} việc mới cần chú ý`
                  : undefined
              }
              className="relative"
              onClick={() => setMenu(true)}
            >
              <MoreHorizontal size={19} aria-hidden="true" />
              {attentionCount > 0 && (
                <b className="pn-bell-badge pn-more-badge" aria-hidden="true">
                  {badgeText(attentionCount)}
                </b>
              )}
              <span>Thêm</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}
