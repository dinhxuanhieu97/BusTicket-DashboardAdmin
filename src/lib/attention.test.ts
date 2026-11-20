import test from "node:test";
import assert from "node:assert/strict";
import {
  attentionItems,
  attentionTotal,
  badgeText,
  navBadges,
} from "./attention";
import type { Counters } from "./live-contracts";

const money: Counters = {
  tripsClosingSoon: 1,
  payments: { total: 412, NONE: 405, NEEDS_REVIEW: 5, RESOLVED: 2 },
  refundsOpen: 1,
};

test("GF2: bell lists review, refunds and closing trips in a fixed order with links", () => {
  assert.deepEqual(
    attentionItems(money).map((i) => [i.key, i.count, i.href]),
    [
      ["review", 5, "/admin/payments"],
      ["refunds", 1, "/admin/payments"],
      ["closing", 1, "/admin/trips"],
    ],
  );
  assert.equal(attentionTotal(money), 7);
});

test("GF2: zero items are hidden and an all-zero state has no total", () => {
  const quiet: Counters = {
    tripsClosingSoon: 0,
    payments: { total: 3, NONE: 3, NEEDS_REVIEW: 0, RESOLVED: 0 },
    refundsOpen: 0,
  };
  assert.deepEqual(attentionItems(quiet), []);
  assert.equal(attentionTotal(quiet), 0);
});

test("GF2: a role without payment.read only sees closing trips", () => {
  const ops: Counters = {
    tripsClosingSoon: 2,
    payments: null,
    refundsOpen: null,
  };
  assert.deepEqual(
    attentionItems(ops).map((i) => i.key),
    ["closing"],
  );
  assert.deepEqual(navBadges(ops), { payments: 0, trips: 2 });
});

test("GF2: menu badges count items to review (not refunds) and closing trips", () => {
  assert.deepEqual(navBadges(money), { payments: 5, trips: 1 });
  assert.deepEqual(navBadges(null), {});
});

test("GF2: badge text caps at 99+", () => {
  assert.equal(badgeText(0), "0");
  assert.equal(badgeText(99), "99");
  assert.equal(badgeText(100), "99+");
  assert.equal(badgeText(12345), "99+");
});
