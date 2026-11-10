import test from "node:test";
import assert from "node:assert/strict";
import { tripPeriodRange } from "./trip-period";
import { readPath } from "./access-policy";
test("day month and year use exclusive calendar boundaries", () => {
  assert.deepEqual(tripPeriodRange("2028-02-29", "day"), {
    from: "2028-02-29",
    to: "2028-03-01",
  });
  assert.deepEqual(tripPeriodRange("2028-02-29", "month"), {
    from: "2028-02-01",
    to: "2028-03-01",
  });
  assert.deepEqual(tripPeriodRange("2028-12-31", "year"), {
    from: "2028-01-01",
    to: "2029-01-01",
  });
});
test("proxy range validation rejects mixed, invalid and unbounded dates", () => {
  const path = (q: string) =>
    readPath("trips", "operator", new URLSearchParams(q));
  assert.match(path("from=2028-01-01&to=2029-01-01"), /limit=25/);
  for (const query of [
    "from=2027-02-29&to=2027-03-01",
    "from=2027-01-01&to=2029-01-01",
    "date=2027-01-01&from=2027-01-01",
    "from=2027-01-01&to=2027-02-01&limit=0",
  ])
    assert.throws(() => path(query));
});
