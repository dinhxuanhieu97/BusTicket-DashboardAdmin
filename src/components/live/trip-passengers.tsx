"use client";
import { useMemo, useState } from "react";
import {
  BusFront,
  Download,
  FileUp,
  Flag,
  MapPin,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Modal } from "../modal";
import type { BoardingResult, CancelResult } from "@/lib/passenger-ops";
import { vnDateTime, vnd } from "@/lib/live-contracts";
import { paymentStatusLabels } from "@/lib/trip-assistants";
import {
  ERASED_LABEL,
  bookingStatusLabels,
  bookingStatusTone,
  channelLabels,
  boardedCount,
  filterBookings,
  filterPassengers,
  localPhone,
  NO_PICKUP,
  passengerSortLabels,
  passengerSortValue,
  paymentFilterLabels,
  pickupOptions,
  roundTripText,
  seatSummary,
  type PaymentFilter,
  type AdminPassengerBooking,
  type AdminTripPassengers,
  type PassengerScope,
  type PassengerSortKey,
} from "@/lib/trip-passengers";
import {
  SortHeader,
  TableFooter,
  ariaSort,
  useTableState,
  type Column,
} from "./data-table";
import { useJson } from "./assigned-trips";
import { BookingEditDialog } from "./booking-edit-dialog";
import { PassengerImport } from "./passenger-import";
import {
  LoadState,
  Notice,
  RefreshButton,
  postJson,
  StatusBadge,
  TableScroll,
  tdClass,
  thClass,
} from "./shared";

/** Chỉ dùng phần `sortValue` cho `useTableState`; dòng vẫn vẽ bằng `PassengerRow`. */
const sortColumns: Column<AdminPassengerBooking>[] = (
  Object.keys(passengerSortLabels) as PassengerSortKey[]
).map((key) => ({
  key,
  header: passengerSortLabels[key],
  render: () => null,
  sortValue: (b) => passengerSortValue(b, key),
}));

const canBoardStatus = (b: AdminPassengerBooking) =>
  b.status === "CONFIRMED" || b.status === "COMPLETED";

/**
 * Danh sách khách của chuyến cho nhân viên nhà xe (`booking.read`); xuất file khi có `booking.export`; nhập file khi có
 * `booking.create` (khách mới) hoặc `booking.board` (cập nhật lên xe); đánh dấu lên xe (`booking.board`); hủy đơn
 * (`booking.cancel`); sửa đơn (`booking.update` thông tin, `payment.record` thu tiền, `booking.board` lên xe theo chỗ).
 */
export function TripPassengersSection({
  tripId,
  canExport,
  canCreate = false,
  canBoard = false,
  canCancel = false,
  canEdit = false,
  canPay = false,
  canManageMoney = false,
  className = "rounded-xl border border-line/60 bg-surface/20 p-4",
}: {
  tripId: string;
  canExport: boolean;
  canCreate?: boolean;
  canBoard?: boolean;
  canCancel?: boolean;
  /** `booking.update`: sửa họ tên, SĐT, điểm đón/trả, ghi chú. */
  canEdit?: boolean;
  /** `payment.record`: ghi nhận tiền khách trả trong hộp thoại Sửa. */
  canPay?: boolean;
  /** `payment.manage`: chỉnh tay tổng tiền, cọc, giảm số đã thu trong hộp thoại Sửa. */
  canManageMoney?: boolean;
  className?: string;
}) {
  const [scope, setScope] = useState<PassengerScope>("active");
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState<PaymentFilter>("all");
  const [pickup, setPickup] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "warning" | "danger";
    text: string;
  } | null>(null);
  const [editing, setEditing] = useState<AdminPassengerBooking | null>(null);
  const [cancelling, setCancelling] = useState<AdminPassengerBooking | null>(
    null,
  );
  const base = `/api/trip-management/${encodeURIComponent(tripId)}/passengers`;
  const { data, error, loading, reload } = useJson<AdminTripPassengers>(
    `${base}?status=${scope}`,
  );

  async function toggleBoarding(b: AdminPassengerBooking) {
    const boarded = boardedCount(b) < b.seats.length;
    setBusy(b.code);
    setMessage(null);
    try {
      await postJson<BoardingResult>(
        `/api/trip-management/${encodeURIComponent(tripId)}/boarding`,
        { bookingCode: b.code, boarded },
      );
      reload();
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const pickups = data ? pickupOptions(data.bookings) : [];
  const filtered = useMemo(
    () =>
      data
        ? filterBookings(
            filterPassengers(data.bookings, query),
            payment,
            pickup,
          ).filter((b) => !status || b.status === status)
        : [],
    [data, query, payment, pickup, status],
  );
  const table = useTableState(filtered, sortColumns);
  const setPage = table.resetPage;
  const statuses = data
    ? Object.keys(bookingStatusLabels).filter((s) =>
        data.bookings.some((b) => b.status === s),
      )
    : [];
  const filtering =
    Boolean(query.trim()) || payment !== "all" || !!pickup || !!status;
  const collected = data
    ? data.bookings
        .filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED")
        .reduce((n, b) => n + b.paidAmount, 0)
    : 0;
  const clearFilters = () => {
    setQuery("");
    setPayment("all");
    setPickup("");
    setStatus("");
    setPage();
  };

  return (
    <section aria-labelledby="trip-passenger-heading" className={className}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="trip-passenger-heading" className="text-base font-semibold">
            Hành khách
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {data
              ? `Cập nhật: ${vnDateTime(data.fetchedAt)}`
              : "Đang đọc dữ liệu mới nhất…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(canCreate || canBoard) && (
            <button
              type="button"
              className="btn px-3 text-xs"
              aria-expanded={importing}
              onClick={() => setImporting((v) => !v)}
            >
              <FileUp size={14} aria-hidden="true" />
              Nhập danh sách
            </button>
          )}
          {canExport && (
            <>
              <a
                className="btn px-3 text-xs"
                href={`${base}/export?format=xlsx&status=${scope}`}
                download
              >
                <Download size={14} aria-hidden="true" />
                Xuất Excel
              </a>
              <a
                className="btn px-3 text-xs"
                href={`${base}/export?format=csv&status=${scope}`}
                download
              >
                <Download size={14} aria-hidden="true" />
                CSV
              </a>
            </>
          )}
          <RefreshButton reload={reload} loading={loading} />
        </div>
      </div>

      {importing && (
        <div className="mb-4">
          <PassengerImport
            tripId={tripId}
            onImported={reload}
            onClose={() => setImporting(false)}
          />
        </div>
      )}

      {data && (
        <dl
          className={`mb-4 grid grid-cols-2 gap-2 ${data.summary.boarded !== undefined ? "md:grid-cols-5 [&>*:first-child]:max-md:col-span-2" : "md:grid-cols-4"}`}
          aria-label="Tóm tắt hành khách"
        >
          <Stat
            label="Đơn đã xác nhận"
            value={`${data.summary.bookings} đơn`}
            hint={`${data.summary.people} khách · ${data.summary.seats} chỗ${data.summary.infants ? ` · ${data.summary.infants} em bé` : ""}`}
          />
          {data.summary.boarded !== undefined && (
            <Stat
              label="Đã lên xe"
              value={`${data.summary.boarded}/${data.summary.seats} chỗ`}
              tone={
                data.summary.seats > 0 &&
                data.summary.boarded === data.summary.seats
                  ? "success"
                  : undefined
              }
            />
          )}
          <Stat
            label="Đang giữ chỗ"
            value={`${data.holding.bookings} đơn`}
            hint={`${data.holding.seats} chỗ chờ thanh toán`}
            tone={data.holding.bookings > 0 ? "warning" : undefined}
          />
          <Stat label="Đã thu" value={vnd(collected)} tone="success" />
          <Stat
            label="Còn phải thu"
            value={vnd(data.summary.dueAmount)}
            tone={data.summary.dueAmount > 0 ? "warning" : "success"}
          />
        </dl>
      )}

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-[1_1_12rem]">
          <label htmlFor="passenger-search" className="label mb-1.5 truncate">
            Tìm theo mã vé, tên, SĐT hoặc chỗ
          </label>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              id="passenger-search"
              type="search"
              className="field w-full pl-9"
              placeholder="VD: PN4ZKWWT, Lan, 0912…, A5"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage();
              }}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="min-w-0 max-w-full flex-[0_1_auto] max-sm:flex-[1_1_9rem]">
          <label htmlFor="passenger-payment" className="label mb-1.5">
            Thanh toán
          </label>
          <select
            id="passenger-payment"
            className="field w-full sm:w-auto"
            value={payment}
            onChange={(e) => {
              setPayment(e.target.value as PaymentFilter);
              setPage();
            }}
          >
            {(Object.keys(paymentFilterLabels) as PaymentFilter[]).map((k) => (
              <option key={k} value={k}>
                {paymentFilterLabels[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 max-w-full flex-[0_1_auto] max-sm:flex-[1_1_9rem]">
          <label htmlFor="passenger-pickup" className="label mb-1.5">
            Điểm đón
          </label>
          <select
            id="passenger-pickup"
            className="field w-full sm:w-auto"
            value={pickup}
            onChange={(e) => {
              setPickup(e.target.value);
              setPage();
            }}
          >
            <option value="">Tất cả điểm đón</option>
            {pickups.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value={NO_PICKUP}>Chưa chọn điểm đón</option>
          </select>
        </div>
        {statuses.length > 1 && (
          <div className="min-w-0 max-w-full flex-[0_1_auto] max-sm:flex-[1_1_9rem]">
            <label htmlFor="passenger-status" className="label mb-1.5">
              Trạng thái
            </label>
            <select
              id="passenger-status"
              className="field w-full sm:w-auto"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage();
              }}
            >
              <option value="">Mọi trạng thái</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {bookingStatusLabels[s]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="min-w-0 max-w-full flex-[0_1_auto] max-sm:flex-[1_1_9rem] md:hidden">
          <label htmlFor="passenger-sort" className="label mb-1.5">
            Sắp xếp
          </label>
          <select
            id="passenger-sort"
            className="field w-full"
            value={table.sort ? `${table.sort.key}:${table.sort.dir}` : ""}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(":");
              table.setSort(
                key ? { key, dir: dir === "desc" ? "desc" : "asc" } : null,
              );
            }}
          >
            <option value="">Mặc định</option>
            <option value="seat:asc">Theo chỗ</option>
            <option value="pickup:asc">Theo giờ đón</option>
            <option value="due:desc">Còn thu nhiều nhất</option>
            <option value="status:asc">Theo trạng thái</option>
          </select>
        </div>
        <div
          className="pn-segmented shrink-0"
          role="group"
          aria-label="Phạm vi đơn"
        >
          {(
            [
              ["active", "Đang hiệu lực"],
              ["all", "Tất cả"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => {
                setScope(value);
                setPage();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {filtering && (
          <button
            type="button"
            className="btn px-3 text-xs"
            onClick={clearFilters}
          >
            <X size={14} aria-hidden="true" />
            Xoá lọc
          </button>
        )}
      </div>

      {message && (
        <div className="mb-3" data-message>
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
      {editing && (
        <BookingEditDialog
          booking={editing}
          tripId={tripId}
          canEdit={canEdit}
          canPay={canPay}
          canBoard={canBoard}
          canManageMoney={canManageMoney}
          onClose={() => setEditing(null)}
          onSaved={(text, tone = "success") => {
            setEditing(null);
            setMessage({ tone, text });
            reload();
          }}
        />
      )}
      {cancelling && (
        <CancelDialog
          booking={cancelling}
          onClose={() => setCancelling(null)}
          onDone={(r) => {
            setCancelling(null);
            setMessage({
              tone: "success",
              text: r.alreadyCancelled
                ? `Đơn ${r.booking.code} đã được hủy trước đó.`
                : r.refund
                  ? `Đã hủy đơn ${r.booking.code}. Tạo khoản cần hoàn ${vnd(r.refund.amount)} cho kế toán.`
                  : `Đã hủy đơn ${r.booking.code}, chỗ đã được nhả.`,
            });
            reload();
          }}
        />
      )}
      {error && <LoadState error={error} reload={reload} />}
      {data &&
        (filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            <p>
              {data.bookings.length === 0
                ? scope === "active"
                  ? "Chuyến chưa có khách đặt hoặc đang giữ chỗ."
                  : "Chuyến chưa có đơn nào."
                : "Không có khách khớp bộ lọc. Thử bỏ bớt điều kiện hoặc xoá lọc."}
            </p>
            {filtering && data.bookings.length > 0 && (
              <button
                type="button"
                className="btn px-3 text-xs"
                onClick={clearFilters}
              >
                Xoá lọc
              </button>
            )}
          </div>
        ) : (
          <>
            <TableScroll label="Danh sách hành khách">
              <table className="pn-table w-full border-collapse text-left text-sm md:min-w-[760px]">
                <thead className="max-md:hidden">
                  <tr>
                    <th
                      className={thClass}
                      aria-sort={ariaSort(table.sort, "seat")}
                    >
                      <SortHeader
                        header="Chỗ · Khách"
                        dir={
                          table.sort?.key === "seat"
                            ? table.sort.dir
                            : undefined
                        }
                        onClick={() => table.onSort("seat")}
                      />
                    </th>
                    <th
                      className={thClass}
                      aria-sort={ariaSort(table.sort, "pickup")}
                    >
                      <SortHeader
                        header="Đón · Trả"
                        dir={
                          table.sort?.key === "pickup"
                            ? table.sort.dir
                            : undefined
                        }
                        onClick={() => table.onSort("pickup")}
                      />
                    </th>
                    <th
                      className={`${thClass} text-right`}
                      aria-sort={ariaSort(table.sort, "due")}
                    >
                      <SortHeader
                        header="Thanh toán"
                        dir={
                          table.sort?.key === "due" ? table.sort.dir : undefined
                        }
                        onClick={() => table.onSort("due")}
                      />
                    </th>
                    <th
                      className={thClass}
                      aria-sort={ariaSort(table.sort, "status")}
                    >
                      <SortHeader
                        header="Trạng thái"
                        dir={
                          table.sort?.key === "status"
                            ? table.sort.dir
                            : undefined
                        }
                        onClick={() => table.onSort("status")}
                      />
                    </th>
                    {(canBoard || canCancel || canEdit || canPay) && (
                      <th className={`${thClass} text-right`}>Thao tác</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {table.visible.map((b) => (
                    <PassengerRow
                      key={b.code}
                      booking={b}
                      canBoard={canBoard}
                      canCancel={canCancel}
                      canEdit={canEdit || canPay}
                      showActions={canBoard || canCancel || canEdit || canPay}
                      busy={busy === b.code}
                      onToggleBoarding={() => void toggleBoarding(b)}
                      onCancel={() => setCancelling(b)}
                      onEdit={() => setEditing(b)}
                    />
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <TableFooter
              info={table.info}
              noun="đơn"
              note={filtering ? `lọc từ ${data.bookings.length}` : undefined}
              setPage={table.setPage}
              pageSize={table.pageSize}
              setPageSize={table.setPageSize}
            />
          </>
        ))}
    </section>
  );
}

const statTone = {
  success: "text-success",
  warning: "text-warning",
} as const;

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: keyof typeof statTone;
}) {
  return (
    <div className="rounded-xl border border-line/60 bg-surface/30 px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${tone ? statTone[tone] : "text-ink"}`}
      >
        {value}
      </dd>
      {hint && <dd className="mt-0.5 text-xs text-muted">{hint}</dd>}
    </div>
  );
}

const seatBlockTone: Record<string, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  info: "bg-accent/15 text-accent",
  neutral: "bg-surface text-muted",
};

/** Một đơn = một dòng kiểu CardFlow: khối chỗ + tên đậm + dòng phụ; trên màn hẹp mỗi dòng thành một thẻ. */
function PassengerRow({
  booking: b,
  canBoard,
  canCancel,
  canEdit,
  showActions,
  busy,
  onToggleBoarding,
  onCancel,
  onEdit,
}: {
  booking: AdminPassengerBooking;
  canBoard: boolean;
  canCancel: boolean;
  showActions: boolean;
  busy: boolean;
  onToggleBoarding: () => void;
  onCancel: () => void;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const tone = bookingStatusTone[b.status] ?? "neutral";
  const people = b.seats.reduce((n, s) => n + s.occupancy, 0);
  const infants = b.seats.reduce((n, s) => n + s.infantCount, 0);
  const inactive = b.status === "CANCELLED" || b.status === "EXPIRED";
  const cell = `${tdClass} max-md:block max-md:border-0 max-md:py-1.5`;
  return (
    <tr
      data-booking={b.code}
      className={`max-md:block max-md:border-b max-md:border-line max-md:py-2 ${inactive ? "opacity-70" : ""}`}
    >
      <td className={`${cell} min-w-56`}>
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 min-w-12 shrink-0 items-center justify-center rounded-lg px-1.5 font-mono text-sm font-bold ${seatBlockTone[tone]}`}
            title={`Chỗ ${b.seats.map((s) => s.code).join(", ")}`}
          >
            {seatSummary(b)}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 font-semibold text-ink">
              {b.contactErased ? (
                <span className="font-normal italic text-muted">
                  {ERASED_LABEL}
                </span>
              ) : (
                b.contactName
              )}
              <span className="text-xs font-normal text-muted">
                {channelLabels[b.channel] ?? b.channel}
                {b.createdBy ? ` · ${b.createdBy}` : ""}
              </span>
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
              {b.contactErased || !b.contactPhone ? (
                <span>—</span>
              ) : (
                <a
                  href={`tel:${b.contactPhone}`}
                  className="font-mono text-accent underline-offset-2 hover:underline"
                >
                  {localPhone(b.contactPhone)}
                </a>
              )}
              <span aria-hidden="true">•</span>
              <span className="font-mono">{b.code}</span>
              <span aria-hidden="true">•</span>
              <span>
                {b.seats
                  .map(
                    (s) =>
                      s.code + (s.occupancy > 1 ? ` (${s.occupancy})` : ""),
                  )
                  .join(", ")}
                {" · "}
                {people} khách{infants ? ` +${infants} bé` : ""}
              </span>
            </p>
            {roundTripText(b) && (
              <p
                className="mt-1 text-xs font-medium text-info"
                data-testid="round-trip"
              >
                {roundTripText(b)}
              </p>
            )}
            {(b.note || b.cancelReason) && (
              <p className="mt-1 text-xs text-muted">
                {b.cancelReason && <>Lý do hủy: {b.cancelReason}</>}
                {b.cancelReason && b.note ? " · " : ""}
                {b.note && <span className="italic">“{b.note}”</span>}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className={`${cell} min-w-40 max-md:pl-[3.75rem]`}>
        {b.pickupStop || b.dropoffStop ? (
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="flex items-start gap-1.5">
              <MapPin
                size={13}
                className="mt-0.5 shrink-0 text-success"
                aria-hidden="true"
              />
              <span className="w-12 shrink-0 font-mono text-muted">
                {b.pickupStop?.time || "—"}
                {b.pickupStop?.day ? (
                  <sup title={`+${b.pickupStop.day} ngày`}>
                    +{b.pickupStop.day}
                  </sup>
                ) : null}
              </span>
              <span className="text-ink">
                {b.pickupStop?.name ?? "Chưa chọn"}
              </span>
            </span>
            <span className="flex items-start gap-1.5">
              <Flag
                size={13}
                className="mt-0.5 shrink-0 text-muted"
                aria-hidden="true"
              />
              <span className="w-12 shrink-0 font-mono text-muted">
                {b.dropoffStop?.time || "—"}
                {b.dropoffStop?.day ? (
                  <sup title={`+${b.dropoffStop.day} ngày`}>
                    +{b.dropoffStop.day}
                  </sup>
                ) : null}
              </span>
              <span className="text-ink">
                {b.dropoffStop?.name ?? "Chưa chọn"}
              </span>
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted">Chưa chọn điểm đón/trả</span>
        )}
      </td>
      <td
        className={`${cell} whitespace-nowrap text-right max-md:pl-[3.75rem] max-md:text-left`}
      >
        <p className="font-mono font-bold text-ink">{vnd(b.totalAmount)}</p>
        <p className="text-xs text-muted">
          {paymentStatusLabels[b.paymentStatus] ?? b.paymentStatus}
          {b.paidAmount > 0 && b.dueAmount > 0
            ? ` · đã thu ${vnd(b.paidAmount)}`
            : ""}
        </p>
        {b.dueAmount > 0 && !inactive && (
          <p className="font-mono text-xs font-semibold text-warning">
            Còn thu {vnd(b.dueAmount)}
          </p>
        )}
        {!!b.onboardCollected && (
          <p className="text-xs text-muted">
            Thu trên xe {vnd(b.onboardCollected)}
          </p>
        )}
      </td>
      <td className={`${cell} whitespace-nowrap max-md:pl-[3.75rem]`}>
        <StatusBadge
          tone={tone}
          label={bookingStatusLabels[b.status] ?? b.status}
        />
        {b.holdUntil && (
          <span className="mt-1 block text-xs text-muted">
            đến {vnDateTime(b.holdUntil)}
          </span>
        )}
        {!!b.paymentProofCount && !inactive && b.dueAmount > 0 && (
          <span className="mt-1 block text-xs font-semibold text-warning">
            Khách báo đã CK · {b.paymentProofCount} ảnh
          </span>
        )}
        {!canBoard && canBoardStatus(b) && boardedCount(b) > 0 && (
          <span className="mt-1 block text-xs text-muted">
            {boardedCount(b)}/{b.seats.length} đã lên xe
          </span>
        )}
      </td>
      {showActions && (
        <td
          className={`${cell} whitespace-nowrap text-right max-md:pl-[3.75rem] max-md:text-left`}
        >
          <div className="inline-flex items-center justify-end gap-1.5 max-md:justify-start">
            {canBoard && canBoardStatus(b) && (
              <BoardingCell
                booking={b}
                canBoard={canBoard}
                busy={busy}
                onToggle={onToggleBoarding}
              />
            )}
            {canEdit &&
              (b.status === "HOLDING" || b.status === "CONFIRMED") && (
                <button
                  type="button"
                  className="btn px-3 text-xs"
                  onClick={onEdit}
                  aria-label={`Sửa đơn ${b.code}`}
                  title="Sửa đơn"
                >
                  <Pencil size={14} aria-hidden="true" />
                  <span className="sr-only">Sửa đơn</span>
                </button>
              )}
            {canCancel &&
              (b.status === "HOLDING" || b.status === "CONFIRMED") && (
                <button
                  type="button"
                  className="btn px-3 text-xs text-danger hover:border-danger/50"
                  onClick={onCancel}
                  aria-label={`Hủy đơn ${b.code}`}
                  title="Hủy đơn"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  <span className="sr-only">Hủy đơn</span>
                </button>
              )}
          </div>
        </td>
      )}
    </tr>
  );
}

function BoardingCell({
  booking: b,
  canBoard,
  busy,
  onToggle,
}: {
  booking: AdminPassengerBooking;
  canBoard: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const done = boardedCount(b);
  const all = done === b.seats.length;
  const label = `${done}/${b.seats.length} lên xe`;
  if (!canBoard)
    return <StatusBadge tone={all ? "success" : "neutral"} label={label} />;
  return (
    <button
      type="button"
      className={`btn px-3 text-xs ${all ? "btn-primary" : ""}`}
      aria-pressed={all}
      aria-label={
        all
          ? `Bỏ đánh dấu lên xe đơn ${b.code}`
          : `Đánh dấu đơn ${b.code} đã lên xe`
      }
      disabled={busy}
      onClick={onToggle}
    >
      <BusFront size={14} aria-hidden="true" />
      {busy ? "Đang lưu…" : label}
    </button>
  );
}

function CancelDialog({
  booking: b,
  onClose,
  onDone,
}: {
  booking: AdminPassengerBooking;
  onClose: () => void;
  onDone: (r: CancelResult) => void;
}) {
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boarded = boardedCount(b) > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError("Vui lòng ghi lý do hủy (ít nhất 3 ký tự).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onDone(
        await postJson<CancelResult>(
          `/api/bookings/${encodeURIComponent(b.code)}/cancel`,
          { reason: reason.trim(), notifyCustomer: notify },
        ),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Hủy đơn ${b.code}`} onClose={onClose}>
      <form className="pn-page-stack" onSubmit={submit} noValidate>
        <p className="text-sm">
          {b.contactErased ? ERASED_LABEL : b.contactName} · chỗ{" "}
          <span className="font-mono">
            {b.seats.map((s) => s.code).join(", ")}
          </span>
          . Chỗ sẽ được nhả để bán lại.
        </p>
        {boarded && (
          <Notice tone="warning">
            Khách đã được đánh dấu lên xe. Bỏ đánh dấu lên xe trước khi hủy.
          </Notice>
        )}
        {b.paidAmount > 0 && (
          <Notice tone="warning">
            Đơn đã thu {vnd(b.paidAmount)}. Hủy sẽ tạo khoản cần hoàn{" "}
            {vnd(b.paidAmount)} để kế toán hoàn cho khách (hệ thống không tự
            chuyển tiền).
          </Notice>
        )}
        <div>
          <label htmlFor="cancel-reason" className="label mb-1.5">
            Lý do hủy
          </label>
          <textarea
            id="cancel-reason"
            className="field min-h-20 w-full"
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "cancel-error" : undefined}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
          Gửi tin báo hủy cho khách
        </label>
        {error && (
          <p id="cancel-error" className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Giữ đơn
          </button>
          <button
            type="submit"
            className="btn border-danger/50 font-semibold text-danger"
            disabled={busy || boarded}
          >
            {busy ? "Đang hủy…" : "Hủy đơn"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
