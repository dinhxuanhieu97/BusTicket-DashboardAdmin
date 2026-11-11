import Link from "next/link";
import { Armchair, Bus, FilePenLine, Ticket } from "lucide-react";
import type { Trip } from "@/lib/live-contracts";
import { EmptyState } from "./shared";
import { overviewMetrics } from "@/lib/overview";

export function OverviewPanels({ trips }: { trips: Trip[] }) {
  const metrics = overviewMetrics(trips);
  let offset = 0;
  const segments = metrics.states
    .map((state) => {
      const start = offset;
      offset += metrics.total ? (state.count / metrics.total) * 100 : 0;
      return `${state.color} ${start}% ${offset}%`;
    })
    .join(", ");
  return (
    <>
      <section className="space-y-3" aria-labelledby="overview-counts-title">
        <h2 id="overview-counts-title" className="pn-section-label">
          Tổng quan lịch chạy
        </h2>
        <div className="grid auto-rows-fr grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            {
              label: "Chuyến trong ngày",
              value: metrics.total,
              note: "Theo ngày đã chọn",
              Icon: Bus,
            },
            {
              label: "Chuyến mở bán",
              value: metrics.open,
              note: "Đang nhận đặt vé",
              Icon: Ticket,
            },
            {
              label: "Chỗ còn trống",
              value: metrics.available,
              note: "Trên chuyến mở bán",
              Icon: Armchair,
            },
            {
              label: "Chuyến nháp",
              value: metrics.drafts,
              note: "Chưa mở bán",
              Icon: FilePenLine,
            },
          ].map(({ label, value, note, Icon }) => (
            <div className="card min-w-0 pn-panel-inset" key={label}>
              <div className="flex min-h-10 items-start justify-between gap-2">
                <p className="text-sm text-muted">{label}</p>
                <span className="hidden rounded-xl bg-accent-soft p-2 text-accent sm:inline-flex">
                  <Icon size={18} aria-hidden="true" />
                </span>
              </div>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums sm:mt-2">
                {value}
              </p>
              <p className="mt-2 text-xs text-muted">{note}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-3" aria-labelledby="overview-sales-title">
        <h2 id="overview-sales-title" className="pn-section-label">
          Tình hình mở bán
        </h2>
        <div className="grid gap-3 lg:grid-cols-5">
          <section
            className="card min-w-0 pn-panel-inset lg:col-span-3"
            aria-labelledby="route-chart-title"
          >
            <h3 id="route-chart-title" className="text-base font-semibold">
              Chỗ khả dụng theo tuyến
            </h3>
            <p className="mt-1 text-xs text-muted">
              Chuyến mở bán · Ngày khởi hành đã chọn
            </p>
            {metrics.routes.length ? (
              <div className="mt-4 max-h-72 space-y-4 overflow-y-auto">
                {metrics.routes.map((route) => (
                  <div key={route.route}>
                    <div className="mb-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
                      <span className="font-medium">{route.route}</span>
                      <span className="tabular-nums text-muted">
                        {route.available} / {route.capacity} chỗ
                      </span>
                    </div>
                    <div
                      className="h-3 overflow-hidden rounded-full bg-surface"
                      role="img"
                      aria-label={`${route.route}: ${route.available} chỗ khả dụng trên ${route.capacity} chỗ`}
                    >
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{
                          width: `${route.capacity > 0 ? Math.max(0, Math.min(100, (route.available / route.capacity) * 100)) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Armchair}>
                <p className="text-sm text-muted">
                  Chưa có chuyến mở bán trong ngày này.
                </p>
                <Link
                  href="/admin/trips"
                  className="text-sm font-semibold text-accent"
                >
                  Kiểm tra lịch chuyến →
                </Link>
              </EmptyState>
            )}
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Thanh màu thể hiện chỗ khả dụng trên tổng sức chứa. Phần còn lại
              có thể là chỗ đã đặt, đang giữ hoặc bị khóa.
            </p>
          </section>
          <section
            className="card min-w-0 pn-panel-inset lg:col-span-2"
            aria-labelledby="status-chart-title"
          >
            <h3 id="status-chart-title" className="text-base font-semibold">
              Trạng thái chuyến
            </h3>
            <p className="mt-1 text-xs text-muted">
              Phân bố lịch chạy trong ngày đã chọn
            </p>
            <div
              className="mx-auto my-4 flex size-36 sm:my-5 sm:size-40 items-center justify-center rounded-full"
              aria-hidden="true"
              style={{
                background: metrics.total
                  ? `conic-gradient(${segments})`
                  : "var(--surface)",
              }}
            >
              <div className="flex size-26 flex-col sm:size-28 items-center justify-center rounded-full bg-panel">
                <strong className="text-3xl tabular-nums">
                  {metrics.total}
                </strong>
                <span className="text-xs text-muted">chuyến xe</span>
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {metrics.states.map((state) => (
                <li key={state.status} className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: state.color }}
                  />
                  <span className="text-muted">{state.label}</span>
                  <strong className="ml-auto tabular-nums">
                    {state.count}
                  </strong>
                </li>
              ))}
            </ul>
            {!metrics.total && (
              <p className="mt-4 text-center text-xs text-muted">
                Chưa có dữ liệu chuyến để phân tích.
              </p>
            )}
          </section>
        </div>
      </section>
    </>
  );
}
