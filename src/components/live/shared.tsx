import {
  AlertCircle,
  Check,
  Inbox,
  LoaderCircle,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export function Notice({
  tone = "info",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  const Icon = tone === "success" ? Check : AlertCircle;
  return (
    <div
      className="pn-tone pn-notice"
      data-tone={tone}
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
    >
      <Icon size={17} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="min-w-0 wrap-anywhere">{children}</div>
    </div>
  );
}

export function LoadState({
  loading = false,
  error,
  reload,
  retryLabel = "Thử lại",
}: {
  loading?: boolean;
  error?: string;
  reload: () => void;
  retryLabel?: string;
}) {
  if (loading) {
    return (
      <div
        className="card pn-panel-inset flex min-h-44 items-center justify-center gap-3 text-sm text-muted"
        role="status"
      >
        <LoaderCircle
          size={20}
          className="animate-spin text-accent"
          aria-hidden="true"
        />
        Đang tải dữ liệu…
      </div>
    );
  }
  if (!error) return null;
  return (
    <section className="card pn-panel-inset">
      <Notice tone="danger">
        <p className="font-semibold">{error}</p>
        <p className="mt-1 text-sm">
          Vui lòng kiểm tra kết nối mạng hoặc thử lại sau giây lát.
        </p>
      </Notice>
      <button type="button" className="btn mt-4" onClick={reload}>
        {retryLabel}
      </button>
    </section>
  );
}

export function RefreshButton({
  reload,
  loading,
}: {
  reload: () => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      className="btn"
      disabled={loading}
      onClick={reload}
      aria-label="Làm mới dữ liệu"
    >
      <RefreshCw
        size={15}
        aria-hidden="true"
        className={loading ? "animate-spin" : ""}
      />
      Làm mới
    </button>
  );
}

export function EmptyState({
  children,
  icon: Icon = Inbox,
}: {
  children: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-3 p-4 text-center text-sm text-muted">
      <span
        className="grid size-10 place-items-center rounded-xl bg-surface"
        aria-hidden="true"
      >
        <Icon size={19} />
      </span>
      {children}
    </div>
  );
}

export function EmptyRow({
  columns,
  text = "Chưa có dữ liệu.",
}: {
  columns: number;
  text?: string;
}) {
  return (
    <tr>
      <td colSpan={columns}>
        <div className="pn-empty-row">
          <EmptyState>
            <p>{text}</p>
          </EmptyState>
        </div>
      </td>
    </tr>
  );
}

export function StatusBadge({
  tone = "neutral",
  label,
  icon: Icon,
}: {
  tone?: Tone;
  label: string;
  icon?: LucideIcon;
}) {
  return (
    <span className="pn-tone pn-badge" data-tone={tone}>
      {Icon ? (
        <Icon size={13} aria-hidden="true" />
      ) : (
        <span
          className="size-1.5 shrink-0 rounded-full bg-current"
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
}

export function TableScroll({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div
      className="pn-table-scroll"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

export const tableClass =
  "pn-table w-full min-w-[650px] border-collapse text-left text-sm";
export const thClass =
  "pn-panel-inline border-b border-line bg-surface py-3 text-xs font-semibold text-muted whitespace-nowrap";
export const tdClass =
  "pn-panel-inline border-b border-line py-3 align-middle text-sm";
