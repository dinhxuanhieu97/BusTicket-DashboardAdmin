import test from "node:test";
import assert from "node:assert/strict";
import {
  vnInputToISO,
  createTripInput,
  assertTripManager,
  fareRequirements,
  parseFareThousands,
} from "./trip-management";
import type { Session } from "./live-contracts";
const id = "11111111-1111-4111-8111-111111111111";
const session: Session = {
  scope: "full",
  user: {
    id,
    operatorId: id,
    fullName: "Test",
    phone: "0900000000",
    role: "OWNER",
    mfaEnabled: true,
  },
};
const body = {
  routeId: id,
  vehicleId: id,
  name: "Test",
  departAt: "2027-01-01T01:00:00.000Z",
  salesOpenAt: "2026-12-30T00:00:00.000Z",
  salesCloseAt: "2027-01-01T00:00:00.000Z",
  fares: [{ floor: "1", occupancy: 1, price: 250000 }],
  status: "DRAFT",
};
test("Vietnam datetime independent of host timezone, rejects invalid dates", () => {
  assert.equal(vnInputToISO("2027-01-01T00:30"), "2026-12-31T17:30:00.000Z");
  assert.throws(() => vnInputToISO("2027-02-30T12:00"));
});
test("trip writes require trip.write in the explicitly enabled tenant", () => {
  assert.doesNotThrow(() => assertTripManager(session, id));
  assert.doesNotThrow(() =>
    assertTripManager(
      { ...session, user: { ...session.user, mfaEnabled: false } },
      id,
    ),
  );
  for (const s of [
    { ...session, scope: "mfa_setup" },
    { ...session, user: { ...session.user, role: "DISPATCHER" } },
  ])
    assert.throws(() => assertTripManager(s as Session, id));
  assert.doesNotThrow(() =>
    assertTripManager(
      {
        ...session,
        user: { ...session.user, role: "DISPATCHER" },
        permissions: ["trip.write"],
      },
      id,
    ),
  );
  assert.throws(() => assertTripManager(session, undefined));
  assert.throws(() => assertTripManager(session, "other"));
});
test("trip body rejects tenant injection, fractional money, duplicate fares and bad sale window", () => {
  assert.ok(createTripInput.safeParse(body).success);
  for (const b of [
    { ...body, operatorId: id },
    { ...body, fares: [{ floor: "1", occupancy: 1, price: 1.5 }] },
    { ...body, fares: [...body.fares, ...body.fares] },
    { ...body, salesCloseAt: body.salesOpenAt },
  ])
    assert.equal(createTripInput.safeParse(b).success, false);
});
test("fare fields follow sellable seats and occupancy overrides", () => {
  assert.deepEqual(
    fareRequirements({
      floors: [
        { code: "1", label: "Dưới", rows: ["TX A1 A2 ."] },
        { code: "2", label: "Trên", rows: ["B1"] },
      ],
      defaultMaxOccupancy: 2,
      seatOverrides: {
        A1: { sellable: false },
        A2: { maxOccupancy: 1 },
        B1: { sellable: false },
      },
    }),
    [{ floor: "1", occupancy: 1, label: "Dưới · 1 người" }],
  );
});

test("fare input in thousands saves exact VND and rejects out of range amounts", () => {
  assert.equal(parseFareThousands("700"), 700_000);
  assert.equal(parseFareThousands("1.200,125"), 1_200_125);
  assert.equal(parseFareThousands("20.000"), 20_000_000);
  assert.equal(parseFareThousands("0"), 0);
  for (const value of ["", "700.000", "20.000,001", "700,0001", "-1", "1e3"]) {
    assert.equal(parseFareThousands(value), null, value);
  }
});
