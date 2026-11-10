import { test } from "node:test";
import assert from "node:assert/strict";
import { overviewMetrics } from "./overview";
import type { Trip } from "./live-contracts";
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
