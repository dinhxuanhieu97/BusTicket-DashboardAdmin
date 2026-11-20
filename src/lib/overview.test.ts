import { test } from "node:test";
import assert from "node:assert/strict";
import {
  salesStats,
  salesChangeText,
  cancelPercent,
  CANCEL_WARN,
  addDays,
  greeting,
  nextDeparture,
  overviewMetrics,
  paymentStats,
  seatFill,
  shortVnd,
} from "./overview";
import type { Payment, Trip } from "./live-contracts";
const trip = (
  status: Trip["status"],
  available: number,
  capacity: number,
  route_code = "PN",
) => ({ status, available, capacity, route_code }) as Trip;
test("only open trips contribute to available seats and route capacity", () => {
  const result = overviewMetrics([
    trip("OPEN", 3, 10),
    trip("OPEN", 2, 10),
    trip("DRAFT", 20, 20),
    trip("CANCELLED", 5, 5),
    trip("CLOSED", 4, 5),
  ]);
  assert.equal(result.total, 5);
  assert.equal(result.open, 2);
  assert.equal(result.available, 5);
  assert.equal(result.drafts, 1);
  assert.deepEqual(result.routes, [
    { route: "PN", available: 5, capacity: 20 },
  ]);
  assert.deepEqual(
    result.states.map((s) => s.count),
    [2, 1, 1, 1],
  );
});
test("empty day has no invented series or percentages", () => {
  const result = overviewMetrics([]);
  assert.equal(result.total, 0);
  assert.equal(result.available, 0);
  assert.deepEqual(result.routes, []);
  assert.ok(result.states.every((s) => s.count === 0));
});

test("addDays crosses months and years on the calendar", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2027-01-01", -1), "2026-12-31");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
});

test("greeting follows Vietnam hours", () => {
  assert.deepEqual([0, 10, 11, 13, 14, 17, 18, 23].map(greeting), [
    "Chào buổi sáng",
    "Chào buổi sáng",
    "Chào buổi trưa",
    "Chào buổi trưa",
    "Chào buổi chiều",
    "Chào buổi chiều",
    "Chào buổi tối",
    "Chào buổi tối",
  ]);
});

test("seat fill counts selling trips only and never invents a percentage", () => {
  const fill = seatFill([
    trip("OPEN", 8, 24),
    trip("CLOSED", 0, 10),
    trip("DRAFT", 20, 20),
    trip("CANCELLED", 1, 5),
  ]);
  assert.deepEqual(fill, {
    trips: 2,
    capacity: 34,
    sold: 26,
    free: 8,
    pct: 26 / 34,
  });
  assert.equal(seatFill([]).pct, null);
  assert.equal(seatFill([trip("DRAFT", 5, 5)]).pct, null);
  // Dữ liệu lệch (còn trống > sức chứa) không ra số âm.
  assert.equal(seatFill([trip("OPEN", 30, 24)]).sold, 0);
});

test("next departure is the earliest open trip still ahead", () => {
  const at = (status: Trip["status"], depart_at: string) =>
    ({ ...trip(status, 1, 1), depart_at }) as Trip;
  const now = new Date("2026-11-20T10:00:00Z");
  const next = nextDeparture(
    [
      at("OPEN", "2026-11-20T09:00:00Z"),
      at("OPEN", "2026-11-20T13:00:00Z"),
      at("CLOSED", "2026-11-20T11:00:00Z"),
      at("OPEN", "2026-11-20T12:00:00Z"),
    ],
    now,
  );
  assert.equal(next?.depart_at, "2026-11-20T12:00:00Z");
  assert.equal(nextDeparture([], now), null);
});

const pay = (
  receivedAt: string,
  amount: number,
  review: Payment["review"]["status"] = "NONE",
) => ({ receivedAt, amount, review: { status: review } }) as unknown as Payment;

test("payment stats group by Vietnam day and count items to review", () => {
  const stats = paymentStats(
    [
      // 23:30 UTC ngày 19 = 06:30 ngày 20 giờ VN.
      pay("2026-11-19T23:30:00Z", 300_000, "NEEDS_REVIEW"),
      pay("2026-11-20T03:00:00Z", 200_000),
      pay("2026-11-19T10:00:00Z", 100_000, "RESOLVED"),
      pay("2026-11-01T10:00:00Z", 999_000),
    ],
    "2026-11-20",
    7,
  );
  assert.equal(stats.today, 500_000);
  assert.deepEqual(
    stats.series.map((p) => [p.date, p.amount]),
    [
      ["2026-11-14", 0],
      ["2026-11-15", 0],
      ["2026-11-16", 0],
      ["2026-11-17", 0],
      ["2026-11-18", 0],
      ["2026-11-19", 100_000],
      ["2026-11-20", 500_000],
    ],
  );
  assert.equal(stats.needsReview, 1);
  assert.equal(stats.complete, true);
});

test("a full page that does not reach back far enough is marked incomplete", () => {
  const recent = Array.from({ length: 3 }, () =>
    pay("2026-11-20T03:00:00Z", 1),
  );
  assert.equal(paymentStats(recent, "2026-11-20", 7, 3).complete, false);
  const reachesBack = [...recent, pay("2026-11-01T03:00:00Z", 1)];
  assert.equal(paymentStats(reachesBack, "2026-11-20", 7, 4).complete, true);
  assert.equal(paymentStats([], "2026-11-20").today, 0);
});

test("short money keeps Vietnamese separators", () => {
  assert.deepEqual(shortVnd(630_000), { value: "630.000", unit: "₫" });
  assert.deepEqual(shortVnd(1_250_000), { value: "1,25", unit: "tr ₫" });
  assert.deepEqual(shortVnd(12_850_000), { value: "12,9", unit: "tr ₫" });
  assert.deepEqual(shortVnd(1_940_000_000), { value: "1,94", unit: "tỷ ₫" });
});

test("sales stats compare today's seats with yesterday and keep the period cancel rate", () => {
  const day = (date: string, seats: number) => ({
    date,
    bookings: seats,
    cancelled: 0,
    abandoned: 0,
    holding: 0,
    seats,
  });
  const r = salesStats(
    {
      from: "2026-11-15",
      to: "2026-11-22",
      totals: {
        bookings: 20,
        cancelled: 2,
        abandoned: 1,
        holding: 0,
        seats: 18,
        cancelRate: 0.1,
      },
      byDay: [day("2026-11-20", 8), day("2026-11-21", 10)],
    },
    "2026-11-21",
  );
  assert.deepEqual(
    { ...r, series: r.series.length },
    {
      seatsToday: 10,
      seatsYesterday: 8,
      change: 25,
      series: 2,
      cancelRate: 0.1,
      cancelled: 2,
      bookings: 20,
    },
  );
  assert.equal(
    salesStats(
      {
        from: "2026-11-21",
        to: "2026-11-22",
        totals: {
          bookings: 3,
          cancelled: 0,
          abandoned: 0,
          holding: 0,
          seats: 3,
          cancelRate: null,
        },
        byDay: [day("2026-11-21", 3)],
      },
      "2026-11-21",
    ).change,
    null,
  );
});

const report = (
  byDay: [string, number][],
  totals: { bookings: number; cancelled: number; cancelRate: number | null },
) => ({
  from: "2026-11-15",
  to: "2026-11-22",
  totals: { ...totals, abandoned: 0, holding: 0, seats: 0 },
  byDay: byDay.map(([date, seats]) => ({
    date,
    bookings: seats,
    cancelled: 0,
    abandoned: 0,
    holding: 0,
    seats,
  })),
});

test("GF7: no seats yesterday gives no percentage instead of dividing by zero", () => {
  const r = salesStats(
    report([["2026-11-21", 4]], { bookings: 4, cancelled: 0, cancelRate: 0 }),
    "2026-11-21",
  );
  assert.equal(r.seatsToday, 4);
  assert.equal(r.seatsYesterday, 0);
  assert.equal(r.change, null);
  assert.equal(salesChangeText(r), "Hôm qua 0 chỗ");
});

test("GF7: a day missing from the report counts as zero seats and a drop shows ↓", () => {
  const r = salesStats(
    report([["2026-11-20", 8]], { bookings: 8, cancelled: 0, cancelRate: 0 }),
    "2026-11-21",
  );
  assert.equal(r.seatsToday, 0);
  assert.equal(r.change, -100);
  assert.equal(salesChangeText(r), "↓ 100% so với hôm qua (8)");
  const up = salesStats(
    report(
      [
        ["2026-11-20", 3],
        ["2026-11-21", 4],
      ],
      { bookings: 7, cancelled: 0, cancelRate: 0 },
    ),
    "2026-11-21",
  );
  assert.equal(up.change, 33);
  assert.equal(salesChangeText(up), "↑ 33% so với hôm qua (3)");
});

test("GF7: yesterday crosses a month boundary", () => {
  const r = salesStats(
    report(
      [
        ["2026-11-30", 5],
        ["2026-12-01", 5],
      ],
      { bookings: 10, cancelled: 0, cancelRate: 0 },
    ),
    "2026-12-01",
  );
  assert.equal(r.seatsYesterday, 5);
  assert.equal(r.change, 0);
  assert.equal(salesChangeText(r), "Bằng hôm qua (5)");
});

test("GF7: cancel rate is shown with one decimal and warns from 10%", () => {
  assert.equal(cancelPercent(null), null);
  assert.equal(cancelPercent(0), "0");
  assert.equal(cancelPercent(0.125), "12,5");
  assert.equal(cancelPercent(1 / 3), "33,3");
  assert.equal(cancelPercent(1), "100");
  assert.equal(CANCEL_WARN, 0.1);
  const none = salesStats(
    report([], { bookings: 0, cancelled: 0, cancelRate: null }),
    "2026-11-21",
  );
  assert.equal(none.cancelRate, null);
  assert.equal(none.bookings, 0);
});
