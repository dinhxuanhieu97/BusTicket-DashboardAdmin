import { test } from "node:test";
import assert from "node:assert/strict";
import { revenueReport, shares } from "./revenue";
import type { Payment } from "./live-contracts";

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
