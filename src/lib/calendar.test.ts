import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  dayDisabled,
  dayLabel,
  monthGrid,
  monthTitle,
  orderedRange,
  spanDays,
  vnRange,
  weekdayMon,
} from "./calendar";

test("month grid starts on Monday and always has six weeks", () => {
  // 01/11/2026 là Chủ nhật → ô đầu là thứ Hai 26/10.
  const grid = monthGrid("2026-11-01");
  assert.equal(grid.length, 42);
  assert.deepEqual(grid[0], { date: "2026-10-26", inMonth: false });
  assert.deepEqual(grid[6], { date: "2026-11-01", inMonth: true });
  assert.equal(grid.filter((c) => c.inMonth).length, 30);
  // Tháng bắt đầu đúng thứ Hai: không có ô tháng trước.
  assert.deepEqual(monthGrid("2027-02-01")[0], {
    date: "2027-02-01",
    inMonth: true,
  });
  assert.equal(weekdayMon("2026-11-23"), 0);
  assert.equal(weekdayMon("2026-11-22"), 6);
});

test("month arithmetic crosses year boundaries", () => {
  assert.equal(addMonths("2026-12-01", 1), "2027-01-01");
  assert.equal(addMonths("2026-01-01", -1), "2025-12-01");
  assert.equal(addMonths("2026-11-01", -12), "2025-11-01");
  assert.equal(monthTitle("2026-11-01"), "Thg 11 2026");
});

test("ranges are ordered, counted inclusively and formatted in Vietnamese", () => {
  assert.deepEqual(orderedRange("2026-11-22", "2026-11-16"), {
    from: "2026-11-16",
    to: "2026-11-22",
  });
  assert.equal(spanDays("2026-11-16", "2026-11-22"), 7);
  assert.equal(spanDays("2026-11-16", "2026-11-16"), 1);
  assert.equal(
    vnRange({ from: "2026-11-16", to: "2026-11-22" }),
    "16/11/2026 – 22/11/2026",
  );
  assert.equal(vnRange({ from: "2026-11-16", to: "2026-11-16" }), "16/11/2026");
  assert.equal(dayLabel("2026-11-23"), "Thứ Hai, 23 tháng 11 năm 2026");
});

test("days after max, before min or beyond maxDays from the first click are disabled", () => {
  const opts = { min: "2026-01-01", max: "2026-11-23" };
  assert.equal(dayDisabled("2026-11-24", opts), true);
  assert.equal(dayDisabled("2025-12-31", opts), true);
  assert.equal(dayDisabled("2026-11-23", opts), false);
  const picking = { ...opts, anchor: "2026-11-10", maxDays: 7 };
  assert.equal(dayDisabled("2026-11-16", picking), false); // 7 ngày
  assert.equal(dayDisabled("2026-11-17", picking), true); // 8 ngày
  assert.equal(dayDisabled("2026-11-04", picking), false); // ngược chiều, 7 ngày
  assert.equal(dayDisabled("2026-11-03", picking), true);
});
