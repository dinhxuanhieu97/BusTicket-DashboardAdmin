"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Armchair,
  BusFront,
  CalendarClock,
  Coins,
  Contact,
  Plus,
  ReceiptText,
  Route,
  Activity,
  Ticket,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  vnTime,
  vnToday,
  type BookingsReport,
  type Counters,
  type Payment,
  type RevenueReport,
  type Trip,
} from "@/lib/live-contracts";
import {
  addDays,
  greeting,
  nextDeparture,
  paymentStats,
  salesStats,
  reportMoney,
  salesChangeText,
  cancelPercent,
  CANCEL_WARN,
  seatFill,
  shortVnd,
} from "@/lib/overview";
import { useAllTrips, useResource } from "./use-resource";
import { LoadState } from "./shared";
import { Gauge } from "../ui/gauge";
import { LiveDot, StatCard } from "../ui/stat-card";

type TripsPage = { trips: Trip[]; nextCursor?: string | null };
type Range = "today" | "tomorrow" | "week";

export type OverviewAccess = {
  payments: boolean;
  tripWrite: boolean;
  passengers: boolean;
  fleet: boolean;
  routes: boolean;
};

const tripsPath = (from: string, days: number) =>
  `trips?from=${from}&to=${addDays(from, days)}&limit=100`;

function vnHour() {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date()),
  );
}

/** Phần đầu trang Tổng quan: lời chào + tình hình hôm nay, thao tác nhanh, lấp đầy, thẻ số liệu. */
export function OverviewHero({
  name,
  access,
}: {
  name: string;
  access: OverviewAccess;
}) {
  const today = vnToday();
  // Lời chào và ngày phụ thuộc đồng hồ máy khách: tính sau khi gắn để không lệch khi hydrate.
  const [hello, setHello] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setHello(greeting(vnHour()));
    setNow(new Date());
  }, []);
  const [range, setRange] = useState<Range>("today");

  const todayTrips = useAllTrips<TripsPage>(tripsPath(today, 1));
  const rangeTrips = useAllTrips<TripsPage>(
    range === "today"
      ? tripsPath(today, 1)
      : range === "tomorrow"
        ? tripsPath(addDays(today, 1), 1)
        : tripsPath(today, 7),
  );
  const week = `from=${addDays(today, -6)}&to=${addDays(today, 1)}`;
  // Số tiền và số đếm từ API báo cáo; backend cũ chưa có thì tính tạm từ 200 khoản thu gần nhất.
  const revenue = useResource<RevenueReport>(
    access.payments ? `revenue-report?${week}` : null,
  );
  const counters = useResource<Counters>(access.payments ? "counters" : null);
  const fallback = Boolean(revenue.error || counters.error);
  const payments = useResource<{ payments: Payment[] }>(
    access.payments && fallback ? "payments" : null,
  );
  const bookings = useResource<BookingsReport>(
    access.passengers ? `bookings-report?${week}` : null,
  );
  const sales = bookings.data ? salesStats(bookings.data, today) : null;

  const trips = todayTrips.data?.trips ?? [];
  const partialTrips = Boolean(todayTrips.data?.nextCursor);
  const fill = seatFill(trips);
  const next = now ? nextDeparture(trips, now) : null;
  const money =
    revenue.data && counters.data?.payments
      ? reportMoney(revenue.data, counters.data.payments.NEEDS_REVIEW)
      : payments.data
        ? { ...paymentStats(payments.data.payments, today), net: false }
        : null;
  const rangeFill = rangeTrips.data ? seatFill(rangeTrips.data.trips) : null;
  const atLeast = (partial: boolean) => (partial ? "ít nhất " : "");

  const actions: {
    href: string;
    label: string;
    note: string;
    icon: LucideIcon;
  }[] = [
    access.tripWrite && {
      href: "/admin/trips?create=1",
      label: "Tạo chuyến",
      note: "Chọn tuyến, xe, giờ chạy, giá vé",
      icon: Plus,
    },
    access.passengers && {
      href: "/admin/passengers",
      label: "Hành khách",
      note: "Danh sách khách, bán vé tại quầy",
      icon: Contact,
    },
    access.payments && {
      href: "/admin/payments",
      label: "Đối soát thanh toán",
      note: "Khớp chuyển khoản với đơn",
      icon: ReceiptText,
    },
    access.tripWrite && {
      href: "/admin/schedules",
      label: "Lịch tự động",
      note: "Chuyến lặp lại theo ngày",
      icon: CalendarClock,
    },
    access.fleet && {
      href: "/admin/vehicles",
      label: "Đội xe",
      note: "Xe, sơ đồ chỗ, bảo dưỡng",
      icon: BusFront,
    },
    access.routes && {
      href: "/admin/routes",
      label: "Tuyến đường",
      note: "Điểm đón, điểm trả",
      icon: Route,
    },
  ].filter((a) => a !== false);

  return (
    <div className="pn-page-stack">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <section className="card min-w-0 p-5 sm:p-7" aria-labelledby="hello">
          <p className="text-sm text-muted">
            {now
              ? now.toLocaleDateString("vi-VN", {
                  weekday: "long",
                  day: "numeric",
                  month: "numeric",
                  timeZone: "Asia/Ho_Chi_Minh",
                })
              : " "}
          </p>
          <h2
            id="hello"
            className="mt-1 text-[clamp(1.625rem,2.6vw,2.5rem)] leading-tight font-medium tracking-tight"
          >
            {hello || "Xin chào"}, {name}
          </h2>
          <ul
            className="mt-4 flex flex-wrap gap-2 text-[13px]"
            aria-label="Tình hình hôm nay"
          >
            {todayTrips.data && (
              <>
                <li className="pn-chip">
                  <BusFront size={15} aria-hidden="true" />
                  {atLeast(partialTrips)}
                  {trips.length} chuyến hôm nay
                </li>
                {fill.capacity > 0 && (
                  <li className="pn-chip">
                    <Armchair size={15} aria-hidden="true" />
                    {fill.sold}/{fill.capacity} chỗ đã bán
                  </li>
                )}
              </>
            )}
            {money && (
              <li className="pn-chip">
                <Coins size={15} aria-hidden="true" />
                {money.net ? "Thu thuần hôm nay" : "Thu hôm nay"}{" "}
                {money.today.toLocaleString("vi-VN")} ₫
              </li>
            )}
            {money && money.needsReview > 0 && (
              <li className="pn-chip" data-tone="warning">
                <AlertTriangle size={15} aria-hidden="true" />
                {money.needsReview} khoản cần đối soát
              </li>
            )}
          </ul>
          {todayTrips.error ? (
            <div className="mt-4">
              <LoadState error={todayTrips.error} reload={todayTrips.reload} />
            </div>
          ) : (
            todayTrips.data && (
              <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-ink/85">
                {next
                  ? `Chuyến kế tiếp: ${vnTime(next.depart_at)} · ${next.name} (${next.route_code}), còn ${next.available}/${next.capacity} chỗ.`
                  : trips.length
                    ? "Không còn chuyến mở bán nào sắp khởi hành hôm nay."
                    : "Hôm nay chưa có chuyến nào."}
              </p>
            )
          )}
          {actions.length > 0 && (
            <>
              <h3 className="mt-6 mb-2.5 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
                Thao tác nhanh
              </h3>
              {/* Điện thoại: một hàng cuộn ngang thay vì 6 dòng dài. */}
              <ul className="grid gap-2.5 max-sm:-mx-5 max-sm:snap-x max-sm:auto-cols-[78%] max-sm:grid-flow-col max-sm:overflow-x-auto max-sm:scroll-px-5 max-sm:px-5 max-sm:pb-1 sm:grid-cols-2 xl:grid-cols-3">
                {actions.map(({ href, label, note, icon: Icon }) => (
                  <li key={href} className="snap-start">
                    <Link href={href} className="pn-action">
                      <span
                        className="pn-tone grid size-11 shrink-0 place-items-center rounded-[0.8125rem]"
                        data-tone="info"
                      >
                        <Icon size={19} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <b className="block font-medium">{label}</b>
                        <span className="block truncate text-[13px] text-muted">
                          {note}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section
          className="card flex min-w-0 flex-col p-5"
          aria-labelledby="fill-title"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="fill-title" className="font-medium">
                Lấp đầy
              </h2>
              <p className="text-[13px] text-muted">
                Chuyến đang và đã bán, không tính nháp/hủy
              </p>
            </div>
            <Link href="/admin/trips" className="btn min-h-9 px-3 text-xs">
              Chi tiết
            </Link>
          </div>
          <div className="my-3 flex-1">
            {rangeTrips.error ? (
              <LoadState error={rangeTrips.error} reload={rangeTrips.reload} />
            ) : (
              <Gauge value={rangeFill?.pct ?? null}>
                <p className="flex items-center justify-center gap-1 text-xs font-semibold tracking-[0.1em] text-accent">
                  <Activity size={14} aria-hidden="true" />
                  {range === "today"
                    ? "HÔM NAY"
                    : range === "tomorrow"
                      ? "NGÀY MAI"
                      : "7 NGÀY"}
                </p>
                <p
                  className="text-5xl leading-tight font-medium tracking-tight tabular-nums"
                  aria-live="polite"
                  data-testid="fill-percent"
                >
                  {rangeTrips.loading || !rangeFill
                    ? "…"
                    : rangeFill.pct === null
                      ? "—"
                      : Math.round(rangeFill.pct * 100)}
                  {rangeFill?.pct != null && !rangeTrips.loading && (
                    <sup className="text-lg">%</sup>
                  )}
                </p>
                <p className="text-[13px] text-muted">
                  {rangeFill && !rangeTrips.loading
                    ? rangeFill.capacity
                      ? `${atLeast(Boolean(rangeTrips.data?.nextCursor))}${rangeFill.free} chỗ còn trống`
                      : "Chưa có chuyến bán"
                    : "Đang tải…"}
                </p>
              </Gauge>
            )}
          </div>
          <div
            className="pn-segmented w-full"
            role="group"
            aria-label="Khoảng lấp đầy"
          >
            {(
              [
                ["today", "Hôm nay"],
                ["tomorrow", "Ngày mai"],
                ["week", "7 ngày"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="flex-1"
                aria-pressed={range === key}
                onClick={() => setRange(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div
        className={`grid grid-cols-2 gap-3 md:gap-4 ${sales && money ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}
      >
        {money && (
          <StatCard
            icon={Coins}
            label={money.net ? "Thu thuần hôm nay" : "Thu hôm nay"}
            value={shortVnd(money.today).value}
            unit={shortVnd(money.today).unit}
            foot={
              <>
                <LiveDot />
                {money.net
                  ? "đã trừ tiền hoàn"
                  : money.complete
                    ? "theo sổ thu"
                    : "200 khoản gần nhất"}
              </>
            }
            spark={money.series.map((p) => p.amount)}
            sparkColor="var(--accent)"
          />
        )}
        {todayTrips.data && (
          <StatCard
            icon={Armchair}
            label="Chỗ đã bán"
            value={fill.sold}
            unit={fill.capacity ? `/ ${fill.capacity}` : undefined}
            foot={
              fill.pct === null
                ? "Chưa có chuyến bán"
                : `Hôm nay · ${Math.round(fill.pct * 100)}% sức chứa${partialTrips ? " · 100 chuyến đầu" : ""}`
            }
          />
        )}
        {money && (
          <StatCard
            icon={AlertTriangle}
            label="Cần đối soát"
            value={money.needsReview}
            unit="khoản"
            tone={money.needsReview ? "warning" : undefined}
            foot={
              money.needsReview ? (
                <Link href="/admin/payments" className="text-accent">
                  Mở sổ thu
                </Link>
              ) : (
                "Mọi khoản đã khớp"
              )
            }
          />
        )}
        {money && (
          <StatCard
            icon={Activity}
            label={money.net ? "Thu thuần 7 ngày" : "Thu 7 ngày"}
            value={
              shortVnd(money.series.reduce((sum, p) => sum + p.amount, 0)).value
            }
            unit={
              shortVnd(money.series.reduce((sum, p) => sum + p.amount, 0)).unit
            }
            foot={
              money.net
                ? "Thu thuần, đã trừ tiền hoàn"
                : money.complete
                  ? "Từ sổ thu"
                  : "Ít nhất (200 khoản gần nhất)"
            }
            spark={money.series.map((p) => p.amount)}
            sparkColor="var(--accent)"
            fillSpark={false}
          />
        )}
        {sales && (
          <StatCard
            icon={Ticket}
            label="Vé bán hôm nay"
            value={sales.seatsToday}
            unit="vé"
            foot={
              <span data-testid="sales-vs-yesterday">
                {salesChangeText(sales)}
              </span>
            }
            spark={sales.series}
            sparkColor="var(--accent)"
          />
        )}
        {sales && (
          <StatCard
            icon={XCircle}
            label="Tỷ lệ hủy 7 ngày"
            value={cancelPercent(sales.cancelRate) ?? "—"}
            unit={sales.cancelRate === null ? undefined : "%"}
            tone={
              (sales.cancelRate ?? 0) >= CANCEL_WARN ? "warning" : undefined
            }
            foot={`${sales.cancelled}/${sales.bookings} đơn tạo trong 7 ngày bị hủy`}
          />
        )}
      </div>
      {payments.error && (
        <LoadState error={payments.error} reload={payments.reload} />
      )}
    </div>
  );
}
