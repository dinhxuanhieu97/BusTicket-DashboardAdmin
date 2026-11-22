import { test } from "node:test";
import assert from "node:assert/strict";
import { auditActor, auditGroup, filterAudit } from "./audit-filter";

const e = (action: string, at: string, actor_name: string | null = "A") => ({
  action,
  at,
  actor_name,
});

test("groups actions by prefix; unknown prefixes go to Khác", () => {
  assert.equal(auditGroup("trip.create"), "trip");
  assert.equal(auditGroup("booking.cancel"), "trip");
  assert.equal(auditGroup("payment.manual"), "payment");
  assert.equal(auditGroup("user.update"), "user");
  assert.equal(auditGroup("vehicle.create"), "fleet");
  assert.equal(auditGroup("route.stops.update"), "fleet");
  assert.equal(auditGroup("policy.update"), "other");
  assert.equal(auditGroup("tripx.create"), "other");
});

test("entries without an actor are shown as Hệ thống", () => {
  assert.equal(auditActor({ actor_name: null }), "Hệ thống");
  assert.equal(auditActor({ actor_name: "  " }), "Hệ thống");
  assert.equal(auditActor({ actor_name: "Lan" }), "Lan");
});

test("filters by group and actor together", () => {
  const rows = [
    e("trip.create", "2026-11-20T01:00:00Z", "Lan"),
    e("trip.status", "2026-11-20T01:00:00Z", "Minh"),
    e("payment.manual", "2026-11-20T01:00:00Z", "Lan"),
    e("trip.status", "2026-11-20T01:00:00Z", null),
  ];
  assert.deepEqual(
    filterAudit(rows, { group: "trip", actor: "Lan" }).map((r) => r.action),
    ["trip.create"],
  );
  assert.equal(filterAudit(rows, { actor: "Hệ thống" }).length, 1);
  assert.equal(filterAudit(rows, {}).length, 4);
});

test("date range uses the Vietnam day and includes both ends", () => {
  const rows = [
    e("trip.create", "2026-11-19T16:59:00Z"), // 23:59 19/11 VN
    e("trip.create", "2026-11-19T17:00:00Z"), // 00:00 20/11 VN
    e("trip.create", "2026-11-21T16:59:00Z"), // 23:59 21/11 VN
    e("trip.create", "2026-11-21T17:00:00Z"), // 00:00 22/11 VN
  ];
  const kept = filterAudit(rows, { from: "2026-11-20", to: "2026-11-21" });
  assert.deepEqual(
    kept.map((r) => r.at),
    ["2026-11-19T17:00:00Z", "2026-11-21T16:59:00Z"],
  );
  assert.equal(filterAudit(rows, { from: "2026-11-22" }).length, 1);
  assert.equal(filterAudit(rows, { to: "2026-11-19" }).length, 1);
  assert.equal(
    filterAudit(rows, { from: "2026-11-21", to: "2026-11-20" }).length,
    0,
  );
  assert.equal(
    filterAudit([e("x", "not a date")], { from: "2026-11-20" }).length,
    0,
  );
});
