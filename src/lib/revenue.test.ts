import { test } from "node:test";
import assert from "node:assert/strict";
import {
  revenueFromReports,
  revenuePeriods,
  routeNote,
  revenueReport,
  shares,
} from "./revenue";
import {
  revenueReportSchema,
  type Payment,
  type RevenueReport,
} from "./live-contracts";

const pay = (
  receivedAt: string,
  amount: number,
  method: Payment["method"] = "BANK_TRANSFER",
) => ({ receivedAt, amount, method }) as Payment;

test("splits payments into the current and previous period by Vietnam date", () => {
  const report = revenueReport(
    [
      // 20/11 00:30 giờ VN nhưng còn là 19/11 theo UTC.
      pay("2026-11-19T17:30:00.000Z", 100_000),
      pay("2026-11-14T03:00:00.000Z", 50_000, "CASH"),
      // Ngoài kỳ hiện tại (7 ngày từ 14/11), thuộc kỳ trước.
      pay("2026-11-13T03:00:00.000Z", 75_000),
      // Trước cả kỳ trước: không tính.
      pay("2026-11-01T03:00:00.000Z", 999_000),
    ],
    "2026-11-20",
    7,
  );
  assert.equal(report.first, "2026-11-14");
  assert.equal(report.current.length, 7);
  assert.equal(report.current.at(-1)!.amount, 100_000);
  assert.equal(report.current[0].amount, 50_000);
  assert.equal(report.total, 150_000);
  assert.equal(report.previousTotal, 75_000);
  assert.equal(report.previous.at(-1)!.date, "2026-11-13");
  assert.equal(report.change, 100);
  assert.equal(report.count, 2);
  assert.equal(report.average, 75_000);
  assert.deepEqual(report.methods, {
    BANK_TRANSFER: 100_000,
    MANUAL_BANK: 0,
    CASH: 50_000,
  });
  // 00:30 giờ VN có 100.000 > 10:00 có 50.000.
  assert.equal(report.peakHour, 0);
  assert.equal(report.completeCurrent, true);
  assert.equal(report.completePrevious, true);
});

test("marks periods incomplete when the loaded set hits the API cap", () => {
  const recent = Array.from({ length: 3 }, () =>
    pay("2026-11-18T03:00:00.000Z", 10_000),
  );
  const report = revenueReport(recent, "2026-11-20", 7, 3);
  assert.equal(report.completeCurrent, false);
  assert.equal(report.completePrevious, false);
  assert.equal(report.change, null);

  // Khoản cũ nhất trước đầu kỳ hiện tại → kỳ hiện tại đủ, kỳ trước chưa chắc.
  const reaching = [...recent.slice(1), pay("2026-11-10T03:00:00.000Z", 1)];
  const partial = revenueReport(reaching, "2026-11-20", 7, 3);
  assert.equal(partial.completeCurrent, true);
  assert.equal(partial.completePrevious, false);
});

test("empty periods have no peak hour, no change and zero average", () => {
  const report = revenueReport([], "2026-11-20", 30);
  assert.equal(report.current.length, 30);
  assert.equal(report.total, 0);
  assert.equal(report.peakHour, null);
  assert.equal(report.change, null);
  assert.equal(report.average, 0);
});

test("shares round each part and survive a zero total", () => {
  assert.deepEqual(shares({ a: 1, b: 3 }), { a: 25, b: 75 });
  assert.deepEqual(shares({ a: 0, b: 0 }), { a: 0, b: 0 });
});

const day = (date: string, received: number, refunded = 0) => ({
  date,
  received,
  refunded,
  net: received - refunded,
  payments: received ? 1 : 0,
  refunds: refunded ? 1 : 0,
});
const report = (days: ReturnType<typeof day>[]): RevenueReport => {
  const sum = (k: "received" | "refunded" | "net" | "payments" | "refunds") =>
    days.reduce((t, d) => t + d[k], 0);
  return {
    from: days[0].date,
    to: days.at(-1)!.date,
    totals: {
      received: sum("received"),
      refunded: sum("refunded"),
      net: sum("net"),
      payments: sum("payments"),
      refunds: sum("refunds"),
    },
    byDay: days,
    byMethod: [{ method: "CASH", amount: sum("received"), count: 2 }],
    byHour: [
      { hour: 9, amount: 10_000, count: 1 },
      { hour: 17, amount: 90_000, count: 1 },
    ],
    byRoute: [
      {
        code: "HCM-DL",
        origin: "HCM",
        destination: "Đà Lạt",
        received: 80_000,
        refunded: 20_000,
        net: 60_000,
        bookings: 2,
      },
    ],
    unallocated: 20_000,
  };
};

test("report periods end today and the previous period ends where the current starts", () => {
  assert.deepEqual(revenuePeriods("2026-11-21", 7), {
    current: { from: "2026-11-15", to: "2026-11-22" },
    previous: { from: "2026-11-08", to: "2026-11-15" },
  });
});

test("API reports give net revenue, routes and a complete comparison", () => {
  const r = revenueFromReports(
    report([day("2026-11-20", 60_000), day("2026-11-21", 40_000, 20_000)]),
    report([day("2026-11-18", 40_000), day("2026-11-19", 0)]),
  );
  assert.equal(r.total, 80_000);
  assert.deepEqual(
    r.current.map((p) => p.amount),
    [60_000, 20_000],
  );
  assert.equal(r.change, 100);
  assert.equal(r.average, 50_000);
  assert.equal(r.peakHour, 17);
  assert.equal(r.methods.CASH, 100_000);
  assert.equal(r.completeCurrent && r.completePrevious, true);
  assert.deepEqual(
    { ...r.net, routes: r.net?.routes.length },
    {
      received: 100_000,
      refunded: 20_000,
      refunds: 1,
      unallocated: 20_000,
      routes: 1,
    },
  );
  const flat = revenueFromReports(
    report([day("2026-11-21", 0)]),
    report([day("2026-11-20", 0)]),
  );
  assert.equal(flat.change, null);
});

test("GF8: report periods for 30 days cross a year boundary", () => {
  assert.deepEqual(revenuePeriods("2027-01-10", 30), {
    current: { from: "2026-12-12", to: "2027-01-11" },
    previous: { from: "2026-11-12", to: "2026-12-12" },
  });
});

test("GF8: report figures are complete however many payments there are", () => {
  const big = report([day("2026-11-21", 1_500_000_000)]);
  big.totals.payments = 5000;
  const r = revenueFromReports(big, report([day("2026-11-20", 0)]));
  assert.equal(r.completeCurrent, true);
  assert.equal(r.completePrevious, true);
  assert.equal(r.count, 5000);
  assert.equal(r.average, 300_000);
  assert.equal(r.change, null);
});

test("GF8: an empty period has zero average and no peak hour", () => {
  const empty = { ...report([day("2026-11-21", 0)]), byHour: [] };
  const r = revenueFromReports(empty, empty);
  assert.equal(r.count, 0);
  assert.equal(r.average, 0);
  assert.equal(r.peakHour, null);
  assert.equal(r.total, 0);
});

const route = (
  code: string,
  received: number,
  refunded: number,
  bookings = 1,
) => ({
  code,
  origin: "TP.HCM",
  destination: code,
  received,
  refunded,
  net: received - refunded,
  bookings,
});

test("GF16: routes and the unallocated amount pass through in API order", () => {
  const cur = {
    ...report([day("2026-11-21", 300_000, 60_000)]),
    byRoute: [route("HCM-DL", 200_000, 0, 2), route("HCM-QN", 40_000, 60_000)],
    unallocated: 60_000,
  };
  const r = revenueFromReports(cur, cur);
  assert.deepEqual(
    r.net!.routes.map((x) => [x.code, x.net, x.bookings]),
    [
      ["HCM-DL", 200_000, 2],
      ["HCM-QN", -20_000, 1],
    ],
  );
  assert.equal(r.net!.unallocated, 60_000);
});

test("GF16: the report contract accepts a refund-only route and rejects malformed rows", () => {
  const base = report([day("2026-11-21", 0, 50_000)]);
  assert.equal(
    revenueReportSchema.safeParse({
      ...base,
      byRoute: [route("HCM-QN", 0, 50_000, 0)],
    }).success,
    true,
  );
  for (const bad of [
    { ...route("A", 1, 0), received: -1 },
    { ...route("A", 1, 0), net: 0.5 },
    { ...route("A", 1, 0), bookings: undefined },
  ])
    assert.equal(
      revenueReportSchema.safeParse({ ...base, byRoute: [bad] }).success,
      false,
    );
});

test("GF17: total, series and change use net (received − refunded)", () => {
  const r = revenueFromReports(
    report([day("2026-11-19", 300_000, 100_000), day("2026-11-20", 0, 50_000)]),
    report([day("2026-11-17", 100_000), day("2026-11-18", 100_000)]),
  );
  assert.equal(r.total, 150_000);
  assert.equal(r.previousTotal, 200_000);
  assert.equal(r.change, -25);
  assert.deepEqual(
    r.current.map((p) => p.amount),
    [200_000, -50_000],
  );
  assert.deepEqual(
    {
      received: r.net?.received,
      refunded: r.net?.refunded,
      refunds: r.net?.refunds,
    },
    { received: 300_000, refunded: 150_000, refunds: 2 },
  );
  // Giá trung bình tính trên tiền đã nhận, không trên thu thuần.
  assert.equal(r.average, 300_000);
});

test("GF17: no percentage change when the previous net is zero or negative", () => {
  const current = report([day("2026-11-20", 100_000)]);
  assert.equal(
    revenueFromReports(current, report([day("2026-11-19", 0)])).change,
    null,
  );
  assert.equal(
    revenueFromReports(current, report([day("2026-11-19", 0, 80_000)])).change,
    null,
  );
});

test("routeNote says when a route only had refunds in the period (GE1)", () => {
  const money = (n: number) => `${n.toLocaleString("vi-VN")} ₫`;
  assert.equal(
    routeNote({ bookings: 2, refunded: 0 }, money),
    "2 đơn trả tiền",
  );
  assert.equal(
    routeNote({ bookings: 1200, refunded: 100000 }, money),
    "1.200 đơn trả tiền · đã hoàn 100.000 ₫",
  );
  assert.equal(
    routeNote({ bookings: 0, refunded: 250000 }, money),
    "không có đơn trả tiền · đã hoàn 250.000 ₫",
  );
  assert.equal(
    routeNote({ bookings: 0, refunded: 0 }, money),
    "0 đơn trả tiền",
  );
});
