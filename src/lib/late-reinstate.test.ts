import { test } from "node:test";
import assert from "node:assert/strict";
import {
  balance,
  estimateLeg,
  initialChoices,
  reinstateContextSchema,
  requestBody,
  selectable,
  toggleSeat,
} from "./late-reinstate";

const ctx = reinstateContextSchema.parse({
  paymentId: "11111111-1111-4111-8111-111111111111",
  unallocatedAmount: 380_000,
  eligible: true,
  booking: {
    code: "PNAB12",
    status: "EXPIRED",
    previousTotal: 380_000,
    paidAmount: 0,
    pickupStop: null,
    dropoffStop: null,
  },
  legs: [
    {
      tripId: "22222222-2222-4222-8222-222222222222",
      tripName: "TP.HCM → Hoài Ân",
      tripCode: "PN011226-HA",
      departAt: "2026-12-01T10:30:00.000Z",
      departed: false,
      cancelled: false,
      seats: [
        { seatCode: "A1", occupancy: 1, infantCount: 1, available: true },
        { seatCode: "A3", occupancy: 1, infantCount: 0, available: false },
      ],
    },
  ],
});

const detail = {
  seats: [
    {
      code: "A1",
      floor: "1",
      maxOccupancy: 1 as const,
      sellable: true,
      status: "AVAILABLE" as const,
      bookingCode: null,
      holdExpiresAt: null,
    },
    {
      code: "A3",
      floor: "1",
      maxOccupancy: 1 as const,
      sellable: true,
      status: "BOOKED" as const,
      bookingCode: "PNZZ99",
      holdExpiresAt: null,
    },
    {
      code: "B2",
      floor: "2",
      maxOccupancy: 2 as const,
      sellable: true,
      status: "HELD" as const,
      bookingCode: "PNAB12",
      holdExpiresAt: null,
    },
    {
      code: "C2",
      floor: "2",
      maxOccupancy: 1 as const,
      sellable: false,
      status: "BLOCKED" as const,
      bookingCode: null,
      holdExpiresAt: null,
    },
  ],
  fares: [
    { floor: "1", floorLabel: "Tầng 1", occupancy: 1 as const, price: 380_000 },
    { floor: "2", floorLabel: "Tầng 2", occupancy: 1 as const, price: 350_000 },
    { floor: "2", floorLabel: "Tầng 2", occupancy: 2 as const, price: 600_000 },
  ],
};

test("preselects only the old seats that are still free", () => {
  assert.deepEqual(initialChoices(ctx), [
    {
      tripId: ctx.legs[0]!.tripId,
      seats: [{ seatCode: "A1", occupancy: 1, infantCount: 1 }],
    },
  ]);
});

test("preselects nothing on a departed or cancelled trip", () => {
  const departed = { ...ctx, legs: [{ ...ctx.legs[0]!, departed: true }] };
  assert.deepEqual(initialChoices(departed)[0]!.seats, []);
});

test("free seats and seats still tied to this booking are selectable; others are not", () => {
  const [a1, a3, b2, c2] = detail.seats;
  assert.equal(selectable(a1!, "PNAB12"), true);
  assert.equal(selectable(a3!, "PNAB12"), false);
  assert.equal(selectable(b2!, "PNAB12"), true);
  assert.equal(selectable(c2!, "PNAB12"), false);
});

test("toggling keeps old infant counts and sorts naturally", () => {
  const old = [{ seatCode: "A1", occupancy: 1, infantCount: 1 }];
  let picked = toggleSeat([], "A10", old);
  picked = toggleSeat(picked, "A1", old);
  assert.deepEqual(picked, [
    { seatCode: "A1", occupancy: 1, infantCount: 1 },
    { seatCode: "A10", occupancy: 1, infantCount: 0 },
  ]);
  assert.deepEqual(toggleSeat(picked, "A1"), [
    { seatCode: "A10", occupancy: 1, infantCount: 0 },
  ]);
});

test("estimates by floor and occupancy, null when a fare is missing", () => {
  assert.equal(
    estimateLeg(detail, [
      { seatCode: "A1", occupancy: 1, infantCount: 0 },
      { seatCode: "B2", occupancy: 2, infantCount: 0 },
    ]),
    980_000,
  );
  assert.equal(
    estimateLeg(detail, [{ seatCode: "A1", occupancy: 2, infantCount: 0 }]),
    null,
  );
});

test("balance: positive means refund the difference, negative means the customer owes", () => {
  assert.equal(balance(ctx, 350_000), 30_000);
  assert.equal(balance(ctx, 450_000), -70_000);
});

test("request body matches the API contract and trims the note", () => {
  assert.deepEqual(
    requestBody(
      [
        {
          tripId: "t",
          seats: [{ seatCode: "A1", occupancy: 1, infantCount: 0 }],
        },
      ],
      "  ",
    ),
    {
      legs: [
        {
          tripId: "t",
          items: [{ seatCode: "A1", occupancy: 1, infantCount: 0 }],
        },
      ],
    },
  );
  assert.equal(requestBody([], " Khách đồng ý ").note, "Khách đồng ý");
});
