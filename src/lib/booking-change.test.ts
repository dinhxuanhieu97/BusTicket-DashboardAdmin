import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookingChangeInput,
  buildChangeBody,
  parseMoney,
  touchesMoney,
} from "./booking-change";

const TRIP = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const seats = [
  { seatCode: "A3", occupancy: 1, infantCount: 0 },
  { seatCode: "A4", occupancy: 1, infantCount: 0 },
];
const base = {
  fromTripId: TRIP,
  currentSeats: seats,
  toTripId: TRIP,
  seats,
  totalAmount: "",
  depositAmount: "",
  refundAmount: "",
  reason: "",
  notifyCustomer: true,
};

test("parseMoney reads VND with thousand separators and rejects decimals", () => {
  assert.equal(parseMoney("1.400.000"), 1_400_000);
  assert.equal(parseMoney("700,000đ"), 700_000);
  assert.equal(parseMoney(" 350000 "), 350_000);
  assert.equal(parseMoney(""), undefined);
  assert.ok(Number.isNaN(parseMoney("1.5")));
  assert.ok(Number.isNaN(parseMoney("-5")));
});

test("nothing staged → null", () => {
  assert.equal(buildChangeBody(base), null);
  // Cùng chỗ, khác thứ tự → không đổi.
  assert.equal(buildChangeBody({ ...base, seats: [...seats].reverse() }), null);
});

test("moving to another date keeps seat codes without sending items", () => {
  const body = buildChangeBody({ ...base, toTripId: OTHER });
  assert.deepEqual(body, {
    fromTripId: TRIP,
    toTripId: OTHER,
    notifyCustomer: true,
  });
  assert.ok(bookingChangeInput.safeParse(body).success);
});

test("seat change sends items; occupancy change counts as a change", () => {
  const body = buildChangeBody({
    ...base,
    seats: [{ seatCode: "A3", occupancy: 2, infantCount: 0 }],
    notifyCustomer: false,
  });
  assert.deepEqual(body?.items, [
    { seatCode: "A3", occupancy: 2, infantCount: 0 },
  ]);
  assert.equal(body?.notifyCustomer, false);
  assert.throws(
    () => buildChangeBody({ ...base, seats: [] }),
    /ít nhất một chỗ/,
  );
});

test("money fields are parsed, validated and flagged for payment.manage", () => {
  const body = buildChangeBody({
    ...base,
    totalAmount: "1.200.000",
    refundAmount: "0",
    reason: "  Giảm giá khách quen ",
  });
  assert.deepEqual(body, {
    fromTripId: TRIP,
    totalAmount: 1_200_000,
    reason: "Giảm giá khách quen",
    notifyCustomer: true,
  });
  assert.ok(touchesMoney(body!));
  assert.ok(!touchesMoney(buildChangeBody({ ...base, toTripId: OTHER })!));
  assert.throws(
    () => buildChangeBody({ ...base, depositAmount: "abc" }),
    /Tiền cọc/,
  );
});

test("confirmWithoutDeposit is sent on its own and needs payment.manage", () => {
  const body = buildChangeBody({
    ...base,
    confirmWithoutDeposit: true,
    reason: "Nhà xe cho giữ không cọc",
  });
  assert.deepEqual(body, {
    fromTripId: TRIP,
    confirmWithoutDeposit: true,
    reason: "Nhà xe cho giữ không cọc",
    notifyCustomer: true,
  });
  assert.ok(touchesMoney(body!));
  assert.ok(bookingChangeInput.safeParse(body).success);
  assert.equal(
    buildChangeBody({ ...base, confirmWithoutDeposit: false }),
    null,
  );
});
