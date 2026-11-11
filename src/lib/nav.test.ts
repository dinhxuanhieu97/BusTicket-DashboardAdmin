import assert from "node:assert/strict";
import { test } from "node:test";
import { NAV, visibleNav } from "./nav";

const keys = (p: readonly string[] | undefined) =>
  visibleNav(p).map((i) => i.key);

test("owner permissions show every menu item", () => {
  const owner = [
    "user.manage",
    "policy.read",
    "trip.read",
    "trip.write",
    "audit.read",
    "payment.read",
    "payment.record",
    "payment.manage",
    "trip.assigned.read",
  ];
  assert.deepEqual(
    keys(owner),
    NAV.filter((i) => i.key !== "assigned").map((i) => i.key),
  );
});

test("items without a permission are hidden; the account page always stays", () => {
  assert.deepEqual(keys(["trip.read"]), ["overview", "trips", "settings"]);
  assert.deepEqual(keys(["payment.read"]), ["payments", "settings"]);
  assert.deepEqual(keys([]), ["settings"]);
});

test("assistants only see their assigned trips and the account page", () => {
  assert.deepEqual(keys(["trip.assigned.read"]), ["assigned", "settings"]);
});

test("an older API without permissions keeps the full menu", () => {
  assert.deepEqual(
    keys(undefined),
    NAV.filter((i) => i.key !== "assigned").map((i) => i.key),
  );
});
