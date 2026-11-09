import test from "node:test";
import assert from "node:assert/strict";
import {
  tripDetailSchema,
  seatGrid,
  arrival,
  idempotencyKey,
  type TripDetail,
} from "./trip-detail";
const id = "11111111-1111-4111-8111-111111111111";
const seat = (code: string, floor: string, status = "AVAILABLE") => ({
  code,
  floor,
  maxOccupancy: 2,
  sellable: status !== "BLOCKED",
  status,
  bookingCode: status === "HELD" ? "PNABC234" : null,
  holdExpiresAt: status === "HELD" ? "2027-02-05T03:10:00.000Z" : null,
});
const raw = {
  trip: {
    id,
    name: "TP.HCM → Hoài Ân 17:30",
    status: "DRAFT",
    departAt: "2027-02-05T10:30:00.000Z",
    arriveAt: null,
    salesOpenAt: "2027-01-01T00:00:00.000Z",
    salesCloseAt: "2027-02-05T10:30:00.000Z",
    contactPhone: null,
    createdAt: "2027-01-01T00:00:00.000Z",
    onSale: false,
  },
  route: { id, code: "HCM-HA", origin: "TP.HCM", destination: "Hoài Ân" },
  vehicle: {
    id,
    code: "PN01",
    name: "Xe 01",
    type: "LIMOUSINE",
    plateNumber: null,
    status: "ACTIVE",
    layoutChangedSinceTrip: false,
  },
  layout: {
    id,
    code: "LIMO24",
    version: 1,
    name: "Limousine 24 phòng",
    unit: "phòng",
    kind: "room",
    floors: [
      { code: "1", label: "Tầng dưới", rows: ["TX . CUA", "A1 . A2"] },
      { code: "2", label: "Tầng trên", rows: ["_ . _", "B1 . B2"] },
    ],
  },
  fares: [
    { floor: "1", floorLabel: "Tầng dưới", occupancy: 1, price: 450000 },
    { floor: "1", floorLabel: "Tầng dưới", occupancy: 2, price: 700000 },
  ],
  seats: [
    seat("A1", "1"),
    seat("A2", "1", "HELD"),
    seat("B1", "2", "BOOKED"),
    seat("B2", "2", "BLOCKED"),
  ],
  summary: { capacity: 4, available: 1, held: 1, booked: 1, blocked: 1 },
  fetchedAt: "2027-02-01T00:00:00.000Z",
};
test("parses the API detail and rejects non-integer VND prices", () => {
  const d = tripDetailSchema.parse(raw);
  assert.equal(d.fares[1]!.price, 700000);
  assert.equal(
    tripDetailSchema.safeParse({
      ...raw,
      fares: [{ ...raw.fares[0], price: 450000.5 }],
    }).success,
    false,
  );
  assert.equal(
    tripDetailSchema.safeParse({
      ...raw,
      seats: [{ ...raw.seats[0], status: "SOLD" }],
    }).success,
    false,
  );
});
test("builds the seat grid per floor in layout order", () => {
  const grid = seatGrid(tripDetailSchema.parse(raw));
  assert.deepEqual(
    grid.map((f) => f.label),
    ["Tầng dưới", "Tầng trên"],
  );
  const [driverRow, seatRow] = grid[0]!.rows;
  assert.deepEqual(
    driverRow!.map((c) => c.kind),
    ["marker", "gap", "marker"],
  );
  assert.deepEqual(
    seatRow!.map((c) => (c.kind === "seat" ? c.seat.code : c.kind)),
    ["A1", "gap", "A2"],
  );
  const upper = grid[1]!.rows[1]!.filter((c) => c.kind === "seat");
  assert.deepEqual(
    upper.map((c) => (c.kind === "seat" ? c.seat.status : "")),
    ["BOOKED", "BLOCKED"],
  );
});
test("arrival uses the route drop-off or the PN default 07:00 next day", () => {
  const d = tripDetailSchema.parse(raw) as TripDetail;
  assert.deepEqual(arrival(d), {
    at: "2027-02-06T00:00:00.000Z",
    source: "default",
  });
  const late = tripDetailSchema.parse({
    ...raw,
    trip: { ...raw.trip, departAt: "2027-02-05T17:30:00.000Z" },
  });
  // 00:30 VN on 06/02 → 07:00 VN on 07/02.
  assert.equal(arrival(late).at, "2027-02-07T00:00:00.000Z");
  const routed = tripDetailSchema.parse({
    ...raw,
    trip: { ...raw.trip, arriveAt: "2027-02-06T01:00:00.000Z" },
  });
  assert.deepEqual(arrival(routed), {
    at: "2027-02-06T01:00:00.000Z",
    source: "route",
  });
});
test("idempotency key format matches the API", () => {
  assert.ok(idempotencyKey.safeParse(crypto.randomUUID()).success);
  assert.equal(idempotencyKey.safeParse("short").success, false);
  assert.equal(idempotencyKey.safeParse("has space 123").success, false);
  assert.equal(idempotencyKey.safeParse(null).success, false);
});
