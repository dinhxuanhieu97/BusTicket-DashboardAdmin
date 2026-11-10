import Link from "next/link";
import { Armchair, Bus, FilePenLine, Ticket } from "lucide-react";
import type { Trip } from "@/lib/live-contracts";
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
      <p className="pn-section-label">Tổng quan lịch chạy</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Chuyến trong ngày",
            value: metrics.total,
            note: "Theo ngày khởi hành đã chọn",
            Icon: Bus,
          },
          {
            label: "Chuyến đang mở bán",
            value: metrics.open,
            note: "Trạng thái mở bán của chuyến",
            Icon: Ticket,
          },
          {
            label: "Chỗ khả dụng trên chuyến mở bán",
            value: metrics.available,
            note: "Chưa bao gồm chỗ giữ hoặc khóa",
            Icon: Armchair,
          },
          {
            label: "Chuyến bản nháp",
            value: metrics.drafts,
            note: "Kiểm tra giá và sơ đồ trước khi mở bán",
            Icon: FilePenLine,
          },
        ].map(({ label, value, note, Icon }) => (
          <div className="card p-5" key={label}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-muted">{label}</p>
              <span className="rounded-xl bg-accent/10 p-2 text-accent">
                <Icon size={20} aria-hidden="true" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums">{value}</p>
            <p className="mt-2 text-xs text-muted">{note}</p>
          </div>
        ))}
      </div>
      <p className="pn-section-label">Tình hình mở bán</p>
      <div className="grid gap-5 lg:grid-cols-5">
        <section
          className="card p-6 lg:col-span-3"
          aria-labelledby="route-chart-title"
        >
          <h2 id="route-chart-title" className="font-bold">
            Chỗ khả dụng theo tuyến
          </h2>
          <p className="mt-1 text-xs text-muted">
            Chuyến mở bán · Ngày khởi hành đã chọn
          </p>
          {metrics.routes.length ? (
            <div className="mt-7 max-h-72 space-y-6 overflow-y-auto">
              {metrics.routes.map((route) => (
                <div key={route.route}>
                  <div className="mb-2 flex justify-between gap-3 text-sm">
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
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                      style={{
                        width: `${route.capacity > 0 ? Math.max(0, Math.min(100, (route.available / route.capacity) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
              <Armchair className="text-muted" size={32} aria-hidden="true" />
              <p className="text-sm text-muted">
                Chưa có chuyến mở bán trong ngày này.
              </p>
              <Link
                href="/admin/trips"
                className="text-sm font-semibold text-accent"
              >
                Kiểm tra lịch chuyến →
              </Link>
            </div>
          )}
          <p className="mt-6 text-xs leading-relaxed text-muted">
            Thanh màu thể hiện chỗ khả dụng trên tổng sức chứa. Phần còn lại có
            thể là chỗ đã đặt, đang giữ hoặc bị khóa.
          </p>
        </section>
        <section
          className="card p-6 lg:col-span-2"
          aria-labelledby="status-chart-title"
        >
          <h2 id="status-chart-title" className="font-bold">
            Trạng thái chuyến
          </h2>
          <p className="mt-1 text-xs text-muted">
            Phân bố lịch chạy trong ngày đã chọn
          </p>
          <div
            className="mx-auto my-6 flex size-40 items-center justify-center rounded-full"
            aria-hidden="true"
            style={{
              background: metrics.total
                ? `conic-gradient(${segments})`
                : "var(--surface)",
            }}
          >
            <div className="flex size-28 flex-col items-center justify-center rounded-full bg-panel">
              <strong className="text-3xl tabular-nums">{metrics.total}</strong>
              <span className="text-xs text-muted">chuyến xe</span>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-3 text-sm">
            {metrics.states.map((state) => (
              <li key={state.status} className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: state.color }}
                />
                <span className="text-muted">{state.label}</span>
                <strong className="ml-auto tabular-nums">{state.count}</strong>
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
    </>
  );
}
