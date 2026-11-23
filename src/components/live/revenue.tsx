"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Banknote,
  Clock,
  Hash,
  Landmark,
  MapPin,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  methodLabels,
  vnToday,
  vnd,
  type Payment,
  type RevenueReport,
} from "@/lib/live-contracts";
import {
  MAX_REVENUE_DAYS,
  REVENUE_PRESETS,
  revenueFromReports,
  revenuePeriods,
  revenueRange,
  revenueReport,
  routeNote,
  shares,
  type RevenuePreset,
} from "@/lib/revenue";
import { addDays, shortVnd } from "@/lib/overview";
import { DateRangePicker, type DateRangePreset } from "../ui/date-range-picker";
import { useResource } from "./use-resource";
import { LoadState, Notice, RefreshButton } from "./shared";
import { PageHero } from "../ui/page-hero";
import { StatCard } from "../ui/stat-card";
import { BarTrendChart } from "../ui/bar-trend-chart";

const methodIcons = {
  BANK_TRANSFER: Landmark,
  MANUAL_BANK: Receipt,
  CASH: Banknote,
} as const;

const dayLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

export function Revenue() {
  const today = vnToday();
  const [preset, setPreset] = useState<RevenuePreset>("7");
  // Khoảng tự chọn trên lịch (dùng khi `preset === "custom"`).
  const [custom, setCustom] = useState(() => ({
    from: addDays(today, -6),
    to: today,
  }));
  const picked = revenueRange(today, preset, custom);
  const rangeError = "error" in picked ? picked.error : "";
  const period = "error" in picked ? null : picked;
  const days = period?.days ?? 0;
  const label = period?.label ?? "";
  const periods = period ? revenuePeriods(period.last, period.days) : null;
  const pickerPresets: DateRangePreset[] = REVENUE_PRESETS.map((p) => {
    const r = revenueRange(today, p.id) as { first: string; last: string };
    return { id: p.id, label: p.label, range: { from: r.first, to: r.last } };
  });
  const range = (p: { from: string; to: string } | undefined) =>
    p ? `revenue-report?from=${p.from}&to=${p.to}` : null;
  const cur = useResource<RevenueReport>(range(periods?.current));
  const prev = useResource<RevenueReport>(range(periods?.previous));
  // API báo cáo chưa có (backend cũ) → tính tạm từ 200 khoản thu gần nhất như trước.
  const fallback = Boolean(cur.error || prev.error);
  const legacy = useResource<{
    payments: Payment[];
    meta: { fetchedAt: string; limit: number };
  }>(fallback ? "payments" : null);
  const report = !period
    ? null
    : cur.data && prev.data
      ? revenueFromReports(cur.data, prev.data)
      : fallback && legacy.data
        ? revenueReport(
            legacy.data.payments,
            period.last,
            period.days,
            legacy.data.meta.limit,
          )
        : null;
  const loading = cur.loading || prev.loading || legacy.loading;
  const error = fallback ? legacy.error : "";
  const reload = () => {
    cur.reload();
    prev.reload();
    legacy.reload();
  };
  const total = report ? shortVnd(report.total) : null;
  const methodShare = report ? shares(report.methods) : null;

  return (
    <div className="pn-page-stack">
      <PageHero
        title="Doanh thu"
        description={
          report?.net
            ? "Thu thuần theo ngày (đã nhận trừ đã hoàn, giờ Việt Nam), so với kỳ liền trước."
            : "Tiền đã nhận theo ngày (giờ Việt Nam), so với kỳ liền trước."
        }
        note={
          report && !report.net
            ? "Tính từ 200 khoản thu gần nhất mà API trả về."
            : undefined
        }
        actions={
          <>
            <DateRangePicker
              label="Khoảng thời gian"
              value={period ? { from: period.first, to: period.last } : null}
              presetId={preset === "custom" ? null : preset}
              presets={pickerPresets}
              max={today}
              maxDays={MAX_REVENUE_DAYS}
              onChange={(value, id) => {
                if (id) setPreset(id as RevenuePreset);
                else if (value) {
                  setCustom(value);
                  setPreset("custom");
                }
              }}
            />
            <RefreshButton reload={reload} loading={loading} />
          </>
        }
      />

      {rangeError && <Notice tone="warning">{rangeError}</Notice>}

      <LoadState loading={loading} error={error} reload={reload} />

      {report && total && methodShare && (
        <>
          {!report.completeCurrent && (
            <Notice tone="warning">
              Kỳ {label} có nhiều hơn 200 khoản thu, số dưới đây chỉ tính phần
              đã tải nên có thể thấp hơn thực tế.
            </Notice>
          )}

          <div className="grid grid-cols-2 gap-3 md:gap-4 2xl:grid-cols-4">
            <StatCard
              icon={Wallet}
              label={report.net ? `Thu thuần ${label}` : `Tổng thu ${label}`}
              value={total.value}
              unit={total.unit}
              foot={
                report.change === null ? (
                  report.completePrevious ? (
                    "Kỳ trước chưa có khoản thu"
                  ) : (
                    "Chưa đủ dữ liệu kỳ trước"
                  )
                ) : (
                  <span data-testid="revenue-change">
                    <strong
                      className={
                        report.change >= 0 ? "text-success" : "text-danger"
                      }
                    >
                      {report.change >= 0 ? "↑" : "↓"}{" "}
                      {Math.abs(report.change).toLocaleString("vi-VN")}%
                    </strong>{" "}
                    so với kỳ trước
                  </span>
                )
              }
              spark={report.current.map((p) => p.amount)}
            />
            <StatCard
              icon={Hash}
              label="Số khoản thu"
              value={report.count.toLocaleString("vi-VN")}
              unit="khoản"
              foot={
                report.net ? (
                  <span data-testid="revenue-refunded">
                    Đã nhận {vnd(report.net.received)} · đã hoàn{" "}
                    {vnd(report.net.refunded)}
                  </span>
                ) : (
                  `Trong kỳ ${label}`
                )
              }
            />
            <StatCard
              icon={TrendingUp}
              label="Trung bình mỗi khoản"
              value={shortVnd(report.average).value}
              unit={shortVnd(report.average).unit}
              foot={vnd(report.average)}
            />
            <StatCard
              icon={Clock}
              label="Giờ thu nhiều nhất"
              value={
                report.peakHour === null
                  ? "—"
                  : `${String(report.peakHour).padStart(2, "0")}:00`
              }
              foot={
                report.peakHour === null
                  ? "Chưa có khoản thu"
                  : `Khung ${report.peakHour}–${report.peakHour + 1} giờ`
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="card min-w-0 p-5" aria-labelledby="rev-chart">
              <h3 id="rev-chart" className="font-semibold">
                Theo ngày
              </h3>
              <p className="mb-4 text-sm text-muted">
                Cột: {label} · nét đứt: {days} ngày liền trước
              </p>
              <BarTrendChart
                caption={`Doanh thu theo ngày, ${label} và kỳ trước`}
                labels={report.current.map((p) => dayLabel(p.date))}
                current={report.current.map((p) => p.amount)}
                previous={report.previous.map((p) => p.amount)}
                format={(v) => shortVnd(v).value + " " + shortVnd(v).unit}
              />
            </section>

            <section className="card min-w-0 p-5" aria-labelledby="rev-methods">
              <h3 id="rev-methods" className="font-semibold">
                Theo phương thức
              </h3>
              <p className="mb-2 text-sm text-muted">
                Tỉ lệ trên tổng thu kỳ này
              </p>
              <ul aria-label="Doanh thu theo phương thức">
                {(
                  Object.keys(report.methods) as (keyof typeof methodIcons)[]
                ).map((method) => {
                  const Icon = methodIcons[method];
                  return (
                    <li key={method} className="pn-list-row">
                      <span className="pn-list-icon" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">
                          {methodLabels[method]}
                        </p>
                        <p className="text-xs text-muted tabular-nums">
                          {vnd(report.methods[method])}
                        </p>
                        <span
                          className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[var(--border)]"
                          aria-hidden="true"
                        >
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${methodShare[method]}%` }}
                          />
                        </span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {methodShare[method]}%
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Link
                href="/admin/payments"
                className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
              >
                Mở sổ thu <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </section>
          </div>

          {report.net && (
            <section className="card min-w-0 p-5" aria-labelledby="rev-routes">
              <h3 id="rev-routes" className="font-semibold">
                Theo tuyến
              </h3>
              <p className="mb-2 text-sm text-muted">
                Tiền đã gắn vào đơn, chia theo chặng; đơn khứ hồi chia theo giá
                từng chặng.
              </p>
              {report.net.routes.length === 0 ? (
                <p className="text-sm text-muted">
                  Chưa có khoản thu gắn với đơn trong kỳ.
                </p>
              ) : (
                <ul aria-label="Doanh thu theo tuyến">
                  {report.net.routes.map((r) => (
                    <li key={r.code} className="pn-list-row">
                      <span className="pn-list-icon" aria-hidden="true">
                        <MapPin size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">
                          {r.origin} → {r.destination}
                        </p>
                        <p className="text-xs text-muted tabular-nums">
                          {r.code} · {routeNote(r, vnd)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {vnd(r.net)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {report.net.unallocated !== 0 && (
                <p
                  className="mt-2 text-sm text-muted"
                  data-testid="revenue-unallocated"
                >
                  Chưa gắn đơn: {vnd(report.net.unallocated)} — xử lý ở Sổ thu.
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
