import assert from "node:assert/strict";
import { test } from "node:test";
import { NAV, NAV_GROUPS, groupNav, mobileNav, visibleNav } from "./nav";

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
    "booking.read",
    "booking.export",
    "fleet.read",
    "route.read",
  ];
  assert.deepEqual(
    keys(owner),
    NAV.filter((i) => i.key !== "assigned").map((i) => i.key),
  );
});

test("items without a permission are hidden; the account page always stays", () => {
  assert.deepEqual(keys(["trip.read"]), [
    "overview",
    "trips",
    "settings",
    "seats",
    "help",
  ]);
  assert.deepEqual(keys(["payment.read"]), [
    "payments",
    "settings",
    "revenue",
    "help",
  ]);
  assert.deepEqual(keys([]), ["settings", "help"]);
});

test("passenger list needs booking.read", () => {
  assert.deepEqual(keys(["trip.read", "booking.read"]), [
    "overview",
    "trips",
    "passengers",
    "settings",
    "seats",
    "help",
  ]);
});

test("assistants only see their assigned trips and the account page", () => {
  assert.deepEqual(keys(["trip.assigned.read"]), [
    "assigned",
    "settings",
    "help",
  ]);
});

test("an older API without permissions keeps the full menu", () => {
  assert.deepEqual(
    keys(undefined),
    NAV.filter((i) => i.key !== "assigned").map((i) => i.key),
  );
});

test("every menu item belongs to exactly one sidebar group", () => {
  const grouped = NAV_GROUPS.flatMap((g) => g.keys);
  assert.equal(new Set(grouped).size, grouped.length);
  assert.deepEqual([...grouped].sort(), NAV.map((i) => i.key).sort());
});

test("groups follow permissions and empty groups disappear", () => {
  const groups = groupNav(visibleNav(["trip.read", "payment.read"]));
  assert.deepEqual(
    groups.map((g) => [g.title, g.items.map((i) => i.key)]),
    [
      ["Vận hành", ["overview", "trips", "seats"]],
      ["Tài chính", ["payments", "revenue"]],
      ["Quản lý", ["settings", "help"]],
    ],
  );
  assert.deepEqual(
    groupNav(visibleNav(["trip.assigned.read"])).map((g) => g.id),
    ["ops", "manage"],
  );
});

test("the phone bar shows at most four allowed items in priority order", () => {
  assert.deepEqual(
    mobileNav(visibleNav(undefined)).map((i) => i.key),
    ["overview", "trips", "passengers", "payments"],
  );
  assert.deepEqual(
    mobileNav(visibleNav(["trip.assigned.read"])).map((i) => i.key),
    ["assigned", "settings"],
  );
  assert.deepEqual(
    mobileNav(visibleNav([])).map((i) => i.key),
    ["settings"],
  );
});
