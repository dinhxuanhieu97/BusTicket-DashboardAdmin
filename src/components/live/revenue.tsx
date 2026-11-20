"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Banknote,
  Clock,
  Hash,
  Landmark,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { methodLabels, vnToday, vnd, type Payment } from "@/lib/live-contracts";
import { revenueReport, shares, type RevenueDays } from "@/lib/revenue";
import { shortVnd } from "@/lib/overview";
import { useResource } from "./use-resource";
import { LoadState, Notice, RefreshButton } from "./shared";
import { PageHero } from "../ui/page-hero";
import { StatCard } from "../ui/stat-card";
import { AreaChart } from "../ui/area-chart";

const methodIcons = {
  BANK_TRANSFER: Landmark,
  MANUAL_BANK: Receipt,
  CASH: Banknote,
} as const;

const dayLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

export function Revenue() {
  const [days, setDays] = useState<RevenueDays>(7);
  const { data, error, loading, reload } = useResource<{
    payments: Payment[];
    meta: { fetchedAt: string; limit: number };
  }>("payments");
  const report = data
    ? revenueReport(data.payments, vnToday(), days, data.meta.limit)
    : null;
  const total = report ? shortVnd(report.total) : null;
  const methodShare = report ? shares(report.methods) : null;

  return (
    <div className="pn-page-stack">
      <PageHero
        title="Doanh thu"
        description="Tiền đã nhận theo ngày (giờ Việt Nam), so với kỳ liền trước."
        note="Tính từ 200 khoản thu gần nhất mà API trả về."
        actions={
          <>
            <div
              className="pn-segmented"
              role="group"
              aria-label="Khoảng thời gian"
            >
              {([7, 30] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={days === value}
                  onClick={() => setDays(value)}
                >
                  {value} ngày
                </button>
              ))}
            </div>
            <RefreshButton reload={reload} loading={loading} />
          </>
        }
      />

      <LoadState loading={loading} error={error} reload={reload} />

      {report && total && methodShare && (
        <>
          {!report.completeCurrent && (
            <Notice tone="warning">
              Kỳ {days} ngày có nhiều hơn 200 khoản thu, số dưới đây chỉ tính
              phần đã tải nên có thể thấp hơn thực tế.
            </Notice>
          )}

          <div className="grid grid-cols-2 gap-3 md:gap-4 2xl:grid-cols-4">
            <StatCard
              icon={Wallet}
              label={`Tổng thu ${days} ngày`}
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
              foot={`Trong ${days} ngày gần nhất`}
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
                Đường liền: {days} ngày gần nhất · nét đứt: {days} ngày trước đó
              </p>
              <AreaChart
                caption={`Doanh thu theo ngày, ${days} ngày gần nhất và kỳ trước`}
                labels={report.current.map((p) => dayLabel(p.date))}
                format={(v) => shortVnd(v).value + " " + shortVnd(v).unit}
                series={[
                  {
                    name: "Kỳ này",
                    values: report.current.map((p) => p.amount),
                    color: "var(--accent)",
                  },
                  {
                    name: "Kỳ trước",
                    values: report.previous.map((p) => p.amount),
                    color: "var(--muted)",
                    dashed: true,
                  },
                ]}
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
        </>
      )}
    </div>
  );
}
