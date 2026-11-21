import test from "node:test";
import assert from "node:assert/strict";
import { paymentTabCounts, type ReviewStatus } from "./payment-tabs";

const loaded = (statuses: ReviewStatus[], limit = 200) => ({
  payments: statuses.map((status) => ({ review: { status } })),
  meta: { limit },
});

test("GF12: counters give exact totals for every tab, never marked partial", () => {
  const t = paymentTabCounts(
    { total: 412, NONE: 405, NEEDS_REVIEW: 5, RESOLVED: 2 },
    loaded(Array(200).fill("NONE")),
  );
  assert.deepEqual(
    [t.count(), t.count("NONE"), t.count("NEEDS_REVIEW"), t.count("RESOLVED")],
    [412, 405, 5, 2],
  );
  assert.equal(t.partial, false);
});

test("GF12: without counters, tabs count the loaded set", () => {
  const t = paymentTabCounts(
    null,
    loaded(["NONE", "NEEDS_REVIEW", "NEEDS_REVIEW", "RESOLVED"]),
  );
  assert.deepEqual(
    [t.count(), t.count("NONE"), t.count("NEEDS_REVIEW"), t.count("RESOLVED")],
    [4, 1, 2, 1],
  );
  assert.equal(t.partial, false);
});

test("GF12: the fallback is marked partial once the loaded set reaches the API cap", () => {
  assert.equal(
    paymentTabCounts(null, loaded(Array(199).fill("NONE"))).partial,
    false,
  );
  assert.equal(
    paymentTabCounts(null, loaded(Array(200).fill("NONE"))).partial,
    true,
  );
  assert.equal(
    paymentTabCounts(null, loaded(["NONE", "NONE"], 2)).partial,
    true,
  );
});

test("GF12: nothing loaded yet shows no numbers", () => {
  const t = paymentTabCounts(null, null);
  assert.equal(t.count(), undefined);
  assert.equal(t.count("NEEDS_REVIEW"), undefined);
  assert.equal(t.partial, false);
});

test("GF12: an empty ledger shows zeros, not blanks", () => {
  const t = paymentTabCounts(null, loaded([]));
  assert.equal(t.count(), 0);
  assert.equal(t.count("RESOLVED"), 0);
  const exact = paymentTabCounts(
    { total: 0, NONE: 0, NEEDS_REVIEW: 0, RESOLVED: 0 },
    null,
  );
  assert.equal(exact.count(), 0);
});
