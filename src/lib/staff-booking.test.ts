import test from "node:test";
import assert from "node:assert/strict";
import { issuesFrom } from "./access-policy";
import { counterInput, importOptions } from "./staff-booking";
import { stopTime, tripStopsSchema } from "./trip-detail";

const valid = {
  contactName: "Khách",
  contactPhone: "0912345678",
  items: [{ seatCode: "A1", occupancy: 1, infantCount: 0 }],
  paidAmount: 0,
  confirm: true,
  notifyCustomer: true,
};

test("counterInput accepts a sale and rejects bad seats, duplicates and extra keys", () => {
  assert.equal(counterInput.safeParse(valid).success, true);
  for (const bad of [
    { ...valid, items: [{ seatCode: "a1", occupancy: 1, infantCount: 0 }] },
    { ...valid, items: [valid.items[0], valid.items[0]] },
    { ...valid, items: [] },
    { ...valid, paidAmount: -1 },
    { ...valid, paidAmount: 1.5 },
    { ...valid, items: [{ seatCode: "A1", occupancy: 3, infantCount: 0 }] },
    { ...valid, extra: true },
    { ...valid, contactName: "  " },
  ])
    assert.equal(counterInput.safeParse(bad).success, false);
});

test("importOptions defaults to a dry run and rejects unknown query keys", () => {
  assert.deepEqual(importOptions.parse({}), {
    dryRun: "true",
    confirm: "true",
    notify: "true",
  });
  assert.equal(importOptions.safeParse({ dryRun: "yes" }).success, false);
  assert.equal(importOptions.safeParse({ foo: "1" }).success, false);
});

test("issuesFrom keeps only well-formed row issues", () => {
  assert.equal(issuesFrom(undefined), undefined);
  assert.equal(issuesFrom({ issues: "x" }), undefined);
  assert.deepEqual(
    issuesFrom({
      issues: [
        { rows: [2, 3], message: "Dòng 2 và 3 cùng chỗ A1." },
        { rows: ["2"], message: "bad" },
        { rows: [4] },
        { rows: [5], message: "x".repeat(501) },
      ],
      internal: "secret",
    }),
    [{ rows: [2, 3], message: "Dòng 2 và 3 cùng chỗ A1." }],
  );
});

test("stops default to empty lists and show the day offset", () => {
  assert.deepEqual(tripStopsSchema.parse({}), { pickup: [], dropoff: [] });
  assert.equal(stopTime({ name: "A", time: "17:30", day: 0 }), "17:30");
  assert.equal(
    stopTime({ name: "B", time: "05:30", day: 1 }),
    "05:30 (+1 ngày)",
  );
});
