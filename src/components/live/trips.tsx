"use client";
import Link from "next/link";
import { PairTripForm } from "./pair-trip-form";
import { Modal } from "../modal";
import { OverviewPanels } from "./overview-panels";
import { TripEditor, TripDetails, TripStatusDialog } from "./trip-editor";
import { tripPeriodRange, type TripPeriod } from "@/lib/trip-period";
import { useEffect, useMemo, useState } from "react";
import { Trip, vnDateOf, vnToday, vnDateTime } from "@/lib/live-contracts";
import { useResource } from "./use-resource";
import { routeChips } from "@/lib/route-chips";
import { LoadState, RefreshButton, StatusBadge, Notice } from "./shared";
import { DataTable, type Column } from "./data-table";
import { PAGE_SIZES, nextSort, sortRows, type Sort } from "@/lib/table-state";
import type { TripSort } from "@/lib/access-policy";
import {
  Eye,
  Play,
  Pause,
  ArrowRight,
  Clock,
  Users,
  LayoutGrid,
  List,
} from "lucide-react";
import { PageHero } from "../ui/page-hero";
import { FilterChips } from "../ui/filter-chips";
import { Switch } from "../ui/switch";
import { PeriodPicker } from "../ui/period-picker";

const VIEW_KEY = "pnticket_trip_view";
/** Thứ tự mặc định của API: giờ khởi hành tăng dần (phân trang con trỏ). */
const DEFAULT_SORT = { key: "depart", dir: "asc" } as const;
const isDefaultSort = (s: Sort) =>
  !s || (s.key === DEFAULT_SORT.key && s.dir === DEFAULT_SORT.dir);
type View = "table" | "cards";
function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "cards"
      ? "cards"
      : "table";
  } catch {
    return "table";
  }
}

import { tripStates } from "@/lib/overview";

export function Trips({
  overview = false,
  canWrite = false,
  canReadPassengers = false,
  canCreateBookings = false,
  canBoard = false,
  canCancel = false,
  initialDate,
  initialPeriod = "day",
  initialCreate = false,
}: {
  overview?: boolean;
  canWrite?: boolean;
  canReadPassengers?: boolean;
  canCreateBookings?: boolean;
  canBoard?: boolean;
  canCancel?: boolean;
  initialDate?: string;
  initialPeriod?: TripPeriod;
  /** Mở sẵn form thêm chuyến (nút "Tạo chuyến" ở đầu trang dẫn tới `?create=1`). */
  initialCreate?: boolean;
}) {
  const [creating, setCreating] = useState<"pair" | "single" | null>(
    initialCreate && canWrite ? "pair" : null,
  );
  const [detail, setDetail] = useState<Trip | null>(null);
  const [changing, setChanging] = useState<Trip | null>(null);
  const [notice, setNotice] = useState("");
  const [date, setDate] = useState(initialDate ?? vnToday());
  const [period, setPeriod] = useState<TripPeriod>(initialPeriod);
  const [cursors, setCursors] = useState<string[]>([]);
  const [route, setRoute] = useState("");
  // Backend có lọc `route` (GF13); backend cũ trả 400 thì quay về lọc trong trang đã tải.
  const [serverRoute, setServerRoute] = useState(true);
  const [knownRoutes, setKnownRoutes] = useState<string[]>([]);
  // T2: sắp xếp cả khoảng ở API; API cũ trả 400 thì quay về sắp xếp trong trang đã tải.
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [serverSort, setServerSort] = useState(true);
  const [pageSize, setPageSize] = useState(25);
  const [view, setView] = useState<View>("table");
  useEffect(() => setView(readView()), []);
  const changeView = (next: View) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* storage blocked */
    }
  };
  useEffect(() => {
    if (overview) return;
    const url = new URL(window.location.href);
    url.searchParams.set("date", date);
    url.searchParams.set("period", period);
    url.searchParams.delete("create");
    window.history.replaceState(null, "", url);
  }, [overview, date, period]);
  const range = tripPeriodRange(date, period);
  const rangeKey = `${range.from}|${range.to}`;
  useEffect(() => setKnownRoutes([]), [rangeKey]);
  const query = new URLSearchParams({ ...range, limit: String(pageSize) });
  if (cursors.length) query.set("cursor", cursors[cursors.length - 1]);
  const filterOnServer = !overview && serverRoute && route !== "";
  if (filterOnServer) query.set("route", route);
  const sortOnServer = !overview && serverSort && !isDefaultSort(sort);
  if (sortOnServer && sort) {
    query.set("sort", sort.key);
    query.set("order", sort.dir);
  }
  const { data, error, loading, reload } = useResource<{
    trips: Trip[];
    nextCursor?: string | null;
    meta: { fetchedAt: string };
  }>(overview ? "trips?date=" + date : "trips?" + query.toString());
  useEffect(() => {
    if (filterOnServer && error) {
      setServerRoute(false);
      setCursors([]);
    }
  }, [filterOnServer, error]);
  useEffect(() => {
    if (sortOnServer && error) {
      setServerSort(false);
      setCursors([]);
    }
  }, [sortOnServer, error]);
  const loaded = data?.trips || [];
  // Giữ các tuyến đã thấy để chip không biến mất khi đang lọc một tuyến.
  const pageRoutes = [...new Set(loaded.map((t) => t.route_code))];
  const seenKey = pageRoutes.sort().join(",");
  useEffect(() => {
    if (!seenKey) return;
    setKnownRoutes((prev) =>
      [...new Set([...prev, ...seenKey.split(",")])].sort(),
    );
  }, [seenKey]);
  const chips = routeChips({
    known: knownRoutes,
    loaded,
    selected: overview ? "" : route,
    serverFiltered: filterOnServer,
  });
  const { routes, active: activeRoute } = chips;
  const columns = useMemo(
    () =>
      tripColumns({
        canReadPassengers,
      }),
    [canReadPassengers],
  );
  // Sắp xếp ở API thì giữ nguyên thứ tự trả về; còn lại (tổng quan, API cũ) sắp trong trang đã tải.
  const rows: Trip[] = sortOnServer
    ? chips.rows
    : [
        ...sortRows(chips.rows, sort, (t, key) =>
          columns.find((c) => c.key === key)?.sortValue?.(t),
        ),
      ];
  const onSort = (key: string) => {
    setSort((s) => nextSort(s, key) ?? DEFAULT_SORT);
    setCursors([]);
  };
  const cards = !overview && view === "cards";

  return (
    <div className="pn-page-stack">
      {!overview && (
        <PageHero
          title="Chuyến xe"
          description="Lịch chạy, tình trạng mở bán và chỗ khả dụng theo ngày, tháng hoặc năm."
          actions={
            <>
              <RefreshButton reload={reload} loading={loading} />
              {canWrite && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setCreating("pair")}
                >
                  + Thêm chuyến
                </button>
              )}
            </>
          }
        />
      )}
      {overview && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="pn-section-label">Vận hành trong ngày</h2>
            <p className="mt-2 text-sm text-muted">
              Theo dõi lịch chạy, tình trạng mở bán và chỗ khả dụng trên từng
              tuyến.
            </p>
          </div>
          <Link href="/admin/trips" className="btn btn-primary">
            Quản lý chuyến <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}

      <div className="card pn-panel-inset flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-end gap-3">
          {!overview && (
            <div
              className="pn-segmented"
              role="group"
              aria-label="Phạm vi thời gian"
            >
              {(
                [
                  ["day", "Ngày"],
                  ["month", "Tháng"],
                  ["year", "Năm"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={period === value}
                  onClick={() => {
                    setPeriod(value);
                    setCursors([]);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <PeriodPicker
                label={
                  period === "day"
                    ? "Ngày khởi hành · Giờ Việt Nam"
                    : period === "month"
                      ? "Tháng khởi hành"
                      : "Năm khởi hành"
                }
                mode={period}
                value={date}
                today={vnToday()}
                onChange={(next) => {
                  setDate(next);
                  setCursors([]);
                }}
              />
              {(date !== vnToday() || period !== "day") && (
                <button
                  type="button"
                  className="btn px-3 text-xs"
                  onClick={() => {
                    setDate(vnToday());
                    setPeriod("day");
                    setCursors([]);
                  }}
                  title="Xem ngày hôm nay"
                >
                  Hôm nay
                </button>
              )}
            </div>
          </div>
        </div>
        {overview ? (
          <RefreshButton reload={reload} loading={loading} />
        ) : (
          <div className="pn-segmented" role="group" aria-label="Kiểu hiển thị">
            <button
              type="button"
              aria-pressed={view === "table"}
              onClick={() => changeView("table")}
            >
              <List size={15} aria-hidden="true" className="inline" /> Bảng
            </button>
            <button
              type="button"
              aria-pressed={view === "cards"}
              onClick={() => changeView("cards")}
            >
              <LayoutGrid size={15} aria-hidden="true" className="inline" /> Thẻ
            </button>
          </div>
        )}
      </div>

      {!overview && chips.show && (
        <FilterChips
          label="Lọc theo tuyến"
          value={activeRoute}
          onChange={(next) => {
            setRoute(next);
            setCursors([]);
          }}
          items={[
            { value: "", label: "Tất cả tuyến" },
            ...routes.map((code) => ({ value: code, label: code })),
          ]}
        />
      )}

      {notice && <Notice tone="success">{notice}</Notice>}

      <LoadState loading={loading} error={error} reload={reload} />

      {!loading && !error && data && (
        <>
          {overview && <OverviewPanels trips={rows} />}

          <section className="card overflow-hidden">
            <header className="pn-table-header">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-base font-bold text-ink">
                  Danh sách chuyến
                </h2>
                <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted">
                  {rows.length} chuyến{!overview && " trong trang"}
                  {activeRoute && ` · tuyến ${activeRoute}`}
                </span>
              </div>
              <p className="text-xs text-muted">
                Cập nhật: {vnDateTime(data.meta.fetchedAt)}
              </p>
            </header>
            {cards ? (
              <ul
                className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3"
                aria-label="Thẻ chuyến"
              >
                {rows.map((t) => (
                  <TripCard
                    key={t.id}
                    trip={t}
                    canWrite={canWrite}
                    canReadPassengers={canReadPassengers}
                    onDetail={() => setDetail(t)}
                    onToggle={() => setChanging(t)}
                  />
                ))}
                {!rows.length && (
                  <li className="col-span-full text-center text-sm text-muted">
                    {period === "day"
                      ? "Không có chuyến trong ngày đã chọn."
                      : "Không có chuyến trong khoảng thời gian đã chọn."}
                  </li>
                )}
              </ul>
            ) : (
              <DataTable
                label="Danh sách chuyến"
                columns={columns}
                rows={rows}
                rowKey={(t) => t.id}
                sort={sort}
                onSort={onSort}
                emptyText={
                  overview || period === "day"
                    ? "Không có chuyến trong ngày đã chọn."
                    : "Không có chuyến trong khoảng thời gian đã chọn."
                }
                actions={(t) => (
                  <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end sm:gap-2">
                    <button
                      type="button"
                      className="btn py-1.5 text-xs"
                      onClick={() => setDetail(t)}
                    >
                      <Eye size={13} aria-hidden="true" />
                      Chi tiết
                    </button>
                    {canWrite && t.status !== "CANCELLED" && (
                      <button
                        className="btn py-1.5 text-xs"
                        type="button"
                        onClick={() => setChanging(t)}
                      >
                        {t.status === "OPEN" ? (
                          <>
                            <Pause size={13} aria-hidden="true" />
                            Đóng bán
                          </>
                        ) : (
                          <>
                            <Play size={13} aria-hidden="true" />
                            Mở bán
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              />
            )}
            {!overview && (
              <div className="pn-table-footer">
                <span className="text-muted">
                  Trang {cursors.length + 1} · Tối đa {pageSize} chuyến/trang
                  {!sortOnServer &&
                    !isDefaultSort(sort) &&
                    " · Sắp xếp trong trang đã tải"}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    <span>Số dòng</span>
                    <select
                      className="field h-8 w-auto py-0 pr-7 text-xs"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCursors([]);
                      }}
                    >
                      {PAGE_SIZES.map((n) => (
                        <option key={n} value={n}>
                          {n} / trang
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="btn"
                    disabled={!cursors.length}
                    onClick={() => setCursors((c) => c.slice(0, -1))}
                  >
                    Trang trước
                  </button>
                  <button
                    className="btn"
                    disabled={!data.nextCursor}
                    onClick={() =>
                      data.nextCursor &&
                      setCursors((c) => [...c, data.nextCursor!])
                    }
                  >
                    Trang sau
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {creating === "pair" && (
        <Modal wide title="Thêm chuyến xe" onClose={() => setCreating(null)}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm text-accent">Cả hai chiều</strong>
            <button
              type="button"
              className="btn"
              onClick={() => setCreating("single")}
            >
              Chỉ tạo một chiều
            </button>
          </div>
          <PairTripForm
            mode="once"
            date={period === "day" ? date : undefined}
            onSaved={(day) => {
              setCreating(null);
              setDate(day);
              setPeriod("day");
              setCursors([]);
              reload();
              setNotice("Đã lưu hai chuyến nháp.");
            }}
          />
        </Modal>
      )}
      {creating === "single" && (
        <TripEditor
          date={period === "day" ? date : vnToday()}
          onClose={() => setCreating(null)}
          onSaved={(day) => {
            setCreating(null);
            setDate(day);
            setPeriod("day");
            setCursors([]);
            reload();
            setNotice("Đã lưu chuyến thành công.");
          }}
        />
      )}

      {detail && (
        <TripDetails
          trip={detail}
          onClose={() => setDetail(null)}
          canReadPassengers={canReadPassengers}
          canCreateBookings={canCreateBookings}
          canBoard={canBoard}
          canCancel={canCancel}
        />
      )}

      {changing && (
        <TripStatusDialog
          trip={changing}
          onClose={() => {
            setChanging(null);
            reload();
          }}
          onSaved={() => {
            setChanging(null);
            reload();
            setNotice("Đã cập nhật trạng thái bán.");
          }}
        />
      )}
    </div>
  );
}

function TripCard({
  trip: t,
  canWrite,
  canReadPassengers,
  onDetail,
  onToggle,
}: {
  trip: Trip;
  canWrite: boolean;
  canReadPassengers: boolean;
  onDetail: () => void;
  onToggle: () => void;
}) {
  const sold = Math.max(0, t.capacity - t.available);
  const pct = t.capacity > 0 ? Math.round((sold / t.capacity) * 100) : 0;
  return (
    <li
      className="pn-trip-card"
      data-on={t.status === "OPEN"}
      aria-label={t.name}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-muted">
            {t.code} · {t.route_code}
          </p>
          <p className="font-semibold text-ink wrap-anywhere">{t.name}</p>
        </div>
        {canWrite && t.status !== "CANCELLED" ? (
          <Switch
            checked={t.status === "OPEN"}
            onChange={onToggle}
            label={`Mở bán ${t.name}`}
          />
        ) : (
          <StatusBadge
            tone={tripStates[t.status].tone}
            label={tripStates[t.status].label}
          />
        )}
      </div>
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <Clock size={14} aria-hidden="true" />
        {vnDateTime(t.depart_at)}
      </p>
      <p className="text-sm text-muted">
        {t.vehicle_name} · {t.vehicle_code}
      </p>
      {canWrite && t.status !== "CANCELLED" && (
        <span>
          <StatusBadge
            tone={tripStates[t.status].tone}
            label={tripStates[t.status].label}
          />
        </span>
      )}
      <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-muted">
        <span className="tabular-nums">
          {sold}/{t.capacity} chỗ đã bán
        </span>
        <span
          className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--border)]"
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-full bg-accent"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4">
        <button
          type="button"
          className="flex min-h-11 items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
          onClick={onDetail}
          aria-label={`Chi tiết ${t.name}`}
        >
          <Eye size={14} aria-hidden="true" />
          Chi tiết
        </button>
        {canReadPassengers && (
          <Link
            href={`/admin/passengers?date=${vnDateOf(t.depart_at)}&trip=${t.id}`}
            className="flex min-h-11 items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
          >
            <Users size={14} aria-hidden="true" />
            Hành khách
          </Link>
        )}
      </div>
    </li>
  );
}

/** Cột bảng chuyến; `key` trùng tên cột sắp xếp của API (`TripSort`). */
function tripColumns({
  canReadPassengers,
}: {
  canReadPassengers: boolean;
}): (Column<Trip> & { key: TripSort })[] {
  return [
    {
      key: "name",
      header: "Chuyến / tuyến",
      sortValue: (t) => t.name,
      render: (t) => (
        <>
          <strong className="block font-semibold text-ink">{t.name}</strong>
          <span className="mt-0.5 inline-block rounded bg-surface/80 px-1.5 py-0.5 font-mono text-[11px] text-muted">
            {t.code}
          </span>
          {canReadPassengers && (
            <Link
              href={`/admin/passengers?date=${vnDateOf(t.depart_at)}&trip=${t.id}`}
              className="mt-1 flex min-h-8 items-center gap-1.5 rounded-lg text-xs font-semibold text-accent hover:underline"
            >
              <Users size={14} aria-hidden="true" />
              Hành khách
            </Link>
          )}
        </>
      ),
    },
    {
      key: "depart",
      header: "Khởi hành",
      sortValue: (t) => Date.parse(t.depart_at),
      className: "whitespace-nowrap",
      render: (t) => (
        <div className="flex items-center gap-1.5 font-mono text-sm text-ink">
          <Clock size={14} className="shrink-0 text-muted" aria-hidden="true" />
          <span>{vnDateTime(t.depart_at)}</span>
        </div>
      ),
    },
    {
      key: "vehicle",
      header: "Xe",
      sortValue: (t) => t.vehicle_code,
      render: (t) => (
        <>
          <span className="font-medium text-ink">{t.vehicle_name}</span>
          <small className="block font-mono text-xs text-muted">
            {t.vehicle_code}
          </small>
        </>
      ),
    },
    {
      key: "available",
      header: "Chỗ khả dụng / tổng",
      sortValue: (t) => t.available,
      render: (t) => (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-sm font-semibold text-ink">
            {t.available} / {t.capacity}
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{
                width: `${
                  t.capacity > 0
                    ? Math.min(
                        100,
                        Math.round((t.available / t.capacity) * 100),
                      )
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      sortValue: (t) => tripStatusOrder[t.status],
      className: "whitespace-nowrap",
      render: (t) => (
        <StatusBadge
          tone={tripStates[t.status].tone}
          label={tripStates[t.status].label}
        />
      ),
    },
  ];
}

/** Cùng thứ tự vòng đời với API: nháp → mở bán → đóng bán → đã hủy. */
const tripStatusOrder: Record<Trip["status"], number> = {
  DRAFT: 0,
  OPEN: 1,
  CLOSED: 2,
  CANCELLED: 3,
};
