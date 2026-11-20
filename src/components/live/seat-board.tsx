"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bus, ShoppingCart } from "lucide-react";
import { vnDateOf, vnDateTime, vnToday, type Trip } from "@/lib/live-contracts";
import { tripStates } from "@/lib/overview";
import { seatGrid, seatStatusLabels } from "@/lib/trip-detail";
import { Modal } from "../modal";
import { PageHero } from "../ui/page-hero";
import { CounterSale } from "./counter-sale";
import {
  EmptyState,
  LoadState,
  Notice,
  RefreshButton,
  StatusBadge,
} from "./shared";
import { seatTone, useTripDetail } from "./trip-details";
import { useResource } from "./use-resource";

/** Trang "Sơ đồ chỗ": chọn ngày → chọn chuyến → bấm một chỗ để xem trạng thái và bán tại quầy. */
export function SeatBoard({
  initialDate,
  initialTripId,
  canCreateBookings = false,
  canReadPassengers = false,
}: {
  initialDate?: string;
  initialTripId?: string;
  canCreateBookings?: boolean;
  canReadPassengers?: boolean;
}) {
  const [date, setDate] = useState(initialDate ?? vnToday());
  const [tripId, setTripId] = useState(initialTripId ?? "");
  const { data, error, loading, reload } = useResource<{ trips: Trip[] }>(
    "trips?date=" + date,
  );
  const trips = data?.trips ?? [];
  const active = trips.find((t) => t.id === tripId) ?? trips[0] ?? null;

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("date", date);
    if (active) url.searchParams.set("trip", active.id);
    else url.searchParams.delete("trip");
    window.history.replaceState(null, "", url);
  }, [date, active]);

  return (
    <div className="pn-page-stack">
      <PageHero
        title="Sơ đồ chỗ"
        description="Chọn chuyến rồi bấm vào một chỗ để xem trạng thái, mã đơn và bán tại quầy."
        actions={<RefreshButton reload={reload} loading={loading} />}
      />

      <section
        className="card pn-panel-inset flex flex-wrap items-end gap-3"
        aria-label="Chọn chuyến"
      >
        <div>
          <label htmlFor="seat-date" className="label mb-1.5">
            Ngày khởi hành · Giờ Việt Nam
          </label>
          <input
            id="seat-date"
            type="date"
            className="field w-auto max-w-full tabular-nums"
            value={date}
            onChange={(e) => {
              if (!e.target.value) return;
              setDate(e.target.value);
              setTripId("");
            }}
          />
        </div>
        <div className="min-w-0 flex-1 basis-60">
          <label htmlFor="seat-trip" className="label mb-1.5">
            Chuyến
          </label>
          <select
            id="seat-trip"
            className="field"
            value={active?.id ?? ""}
            disabled={!trips.length}
            onChange={(e) => setTripId(e.target.value)}
          >
            {!trips.length && <option value="">Không có chuyến</option>}
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {vnDateTime(t.depart_at).slice(0, 5)} · {t.name} · {t.available}
                /{t.capacity} trống
              </option>
            ))}
          </select>
        </div>
      </section>

      <LoadState loading={loading} error={error} reload={reload} />

      {data && !trips.length && (
        <section className="card">
          <EmptyState icon={Bus}>
            <p>Không có chuyến trong ngày đã chọn.</p>
          </EmptyState>
        </section>
      )}

      {active && (
        <TripSeats
          key={active.id}
          trip={active}
          canCreateBookings={canCreateBookings}
          canReadPassengers={canReadPassengers}
        />
      )}
    </div>
  );
}

function TripSeats({
  trip,
  canCreateBookings,
  canReadPassengers,
}: {
  trip: Trip;
  canCreateBookings: boolean;
  canReadPassengers: boolean;
}) {
  const { data, error, loading, reload } = useTripDetail(trip.id);
  const [code, setCode] = useState<string | null>(null);
  const [selling, setSelling] = useState<string | null>(null);

  if (error) return <LoadState error={error} reload={reload} />;
  if (!data) return <LoadState loading reload={reload} />;

  const unit = data.layout.unit;
  // Cùng quy tắc với form bán tại quầy: bán được cả khi đã đóng bán online, trừ nháp/hủy/đã chạy.
  const counterOpen =
    data.trip.status !== "DRAFT" &&
    data.trip.status !== "CANCELLED" &&
    Date.now() < Date.parse(data.trip.departAt);
  const seat = data.seats.find((s) => s.code === code) ?? null;
  const floorLabel = (floor: string) =>
    data.layout.floors.find((f) => f.code === floor)?.label ?? floor;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="card min-w-0 p-5" aria-labelledby="seat-map-title">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 id="seat-map-title" className="font-semibold wrap-anywhere">
              {data.trip.name}
            </h3>
            <p className="text-xs text-muted">
              {vnDateTime(data.trip.departAt)} · {data.route.origin} →{" "}
              {data.route.destination} · {data.vehicle.code}
            </p>
          </div>
          <StatusBadge
            tone={tripStates[data.trip.status].tone}
            label={tripStates[data.trip.status].label}
          />
        </div>
        <ul className="mb-4 flex flex-wrap gap-2 text-xs" aria-label="Chú giải">
          {(
            [
              ["AVAILABLE", data.summary.available],
              ["HELD", data.summary.held],
              ["BOOKED", data.summary.booked],
              ["BLOCKED", data.summary.blocked],
            ] as const
          ).map(([status, count]) => (
            <li key={status}>
              <StatusBadge
                tone={seatTone[status]}
                label={`${seatStatusLabels[status]}: ${count}`}
              />
            </li>
          ))}
        </ul>
        {data.seats.length === 0 ? (
          <p className="text-sm text-muted">Chuyến chưa có sơ đồ chỗ.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {seatGrid(data).map((floor) => (
              <figure
                key={floor.code}
                className="min-w-0 rounded-xl border border-line p-3"
                aria-label={floor.label}
              >
                <figcaption className="mb-3 text-xs font-bold tracking-wider text-ink uppercase">
                  {floor.label}
                </figcaption>
                <div className="space-y-2">
                  {floor.rows.map((row, ri) => (
                    <div
                      key={ri}
                      className="grid gap-2"
                      style={{
                        gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {row.map((cell, ci) =>
                        cell.kind === "seat" ? (
                          <button
                            key={ci}
                            type="button"
                            data-seat={cell.seat.code}
                            data-status={cell.seat.status}
                            aria-pressed={code === cell.seat.code}
                            aria-label={`${cell.seat.code} · ${seatStatusLabels[cell.seat.status]}`}
                            onClick={() =>
                              setCode((c) =>
                                c === cell.seat.code ? null : cell.seat.code,
                              )
                            }
                            className="pn-tone pn-seat flex min-h-12 flex-col items-center justify-center rounded-xl border border-line text-center text-xs font-semibold"
                            data-tone={seatTone[cell.seat.status]}
                          >
                            <span className="font-mono tracking-tight">
                              {cell.seat.code}
                            </span>
                            <span className="text-[10px] font-normal opacity-85">
                              {seatStatusLabels[cell.seat.status]}
                            </span>
                          </button>
                        ) : (
                          <div key={ci} aria-hidden="true" />
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </figure>
            ))}
          </div>
        )}
      </section>

      <aside
        className="card min-w-0 p-5 lg:self-start"
        aria-label="Chỗ đang chọn"
        aria-live="polite"
      >
        {!seat ? (
          <p className="text-sm text-muted">
            Bấm vào một {unit} trên sơ đồ để xem chi tiết.
          </p>
        ) : (
          <div className="space-y-3" data-testid="seat-panel">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-2xl font-semibold">{seat.code}</p>
              <StatusBadge
                tone={seatTone[seat.status]}
                label={seatStatusLabels[seat.status]}
              />
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted">Tầng</dt>
              <dd>{floorLabel(seat.floor)}</dd>
              <dt className="text-muted">Tối đa</dt>
              <dd>{seat.maxOccupancy} người</dd>
              {seat.bookingCode && (
                <>
                  <dt className="text-muted">Mã đơn</dt>
                  <dd className="font-mono font-semibold">
                    {seat.bookingCode}
                  </dd>
                </>
              )}
              {seat.status === "HELD" && seat.holdExpiresAt && (
                <>
                  <dt className="text-muted">Giữ đến</dt>
                  <dd>{vnDateTime(seat.holdExpiresAt)}</dd>
                </>
              )}
            </dl>
            {seat.status === "AVAILABLE" &&
              (canCreateBookings && counterOpen && seat.sellable ? (
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  onClick={() => setSelling(seat.code)}
                >
                  <ShoppingCart size={16} aria-hidden="true" />
                  Bán tại quầy
                </button>
              ) : (
                <Notice tone="info">
                  {!canCreateBookings
                    ? "Tài khoản không có quyền bán vé."
                    : counterOpen
                      ? "Chỗ này không mở bán."
                      : "Chuyến nháp, đã hủy hoặc đã khởi hành nên không bán tại quầy."}
                </Notice>
              ))}
            {seat.bookingCode && canReadPassengers && (
              <Link
                className="btn w-full"
                href={`/admin/passengers?date=${vnDateOf(data.trip.departAt)}&trip=${data.trip.id}`}
              >
                Xem khách của chuyến
              </Link>
            )}
            {seat.bookingCode && !canReadPassengers && (
              <p className="text-xs text-muted">
                Tên và số điện thoại khách chỉ hiện với tài khoản được xem hành
                khách.
              </p>
            )}
          </div>
        )}
        <p className="mt-4 text-xs text-muted">
          Cập nhật {vnDateTime(data.meta.fetchedAt)}
          {loading ? " · đang tải lại…" : ""}
        </p>
      </aside>

      {selling && (
        <Modal wide title="Bán tại quầy" onClose={() => setSelling(null)}>
          <CounterSale
            detail={data}
            initialSeats={[selling]}
            onSold={() => {
              reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
