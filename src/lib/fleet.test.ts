import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fleetLayoutsSchema,
  nextVehicleCode,
  vehicleCodePattern,
} from "./fleet";

test("suggests the first unused vehicle code for the operator", () => {
  assert.equal(nextVehicleCode("PN", []), "PN01");
  assert.equal(
    nextVehicleCode("PN", [{ code: "PN01" }, { code: "PN02" }]),
    "PN03",
  );
  assert.equal(nextVehicleCode("PN", [{ code: "PN02" }]), "PN01");
});

test("vehicle code must be the operator prefix plus 2-3 digits", () => {
  const re = vehicleCodePattern("PN");
  assert.ok(re.test("PN03"));
  assert.ok(re.test("PN103"));
  assert.ok(!re.test("PN3"));
  assert.ok(!re.test("AB03"));
  assert.ok(!re.test("PN0003"));
});

test("layouts keep only the fields the fleet page needs", () => {
  const parsed = fleetLayoutsSchema.parse({
    layouts: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Limo 24",
        kind: "room",
        definition: {},
        capacity: 24,
      },
    ],
  });
  assert.deepEqual(parsed.layouts[0], {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Limo 24",
    kind: "room",
    capacity: 24,
  });
});
