import test from "node:test";
import assert from "node:assert/strict";
import {
  attentionItems,
  attentionTotal,
  badgeText,
  markAllSeen,
  navBadges,
  parseSeen,
  settleSeen,
  unreadCount,
  type AttentionItem,
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

const item = (key: AttentionItem["key"], count: number): AttentionItem => ({
  key,
  count,
  label: key,
  href: "/admin",
});

test("mark all read: the badge counts only what arrived afterwards", () => {
  const now = [item("review", 5), item("refunds", 1), item("closing", 1)];
  assert.equal(unreadCount(now, {}), 7);
  const seen = markAllSeen(now);
  assert.deepEqual(seen, { review: 5, refunds: 1, closing: 1 });
  assert.equal(unreadCount(now, seen), 0);
  // Có thêm 2 khoản cần đối soát và một loại việc mới.
  assert.equal(unreadCount([item("review", 7), item("refunds", 1)], seen), 2);
});

test("handled items lower the read mark so later ones still count as new", () => {
  const seen = { review: 5, closing: 1 };
  const settled = settleSeen([item("review", 3)], seen);
  assert.deepEqual(settled, { review: 3 });
  assert.equal(unreadCount([item("review", 4)], settled), 1);
  // Không đổi thì trả lại chính đối tượng cũ (không ghi lại localStorage).
  assert.equal(settleSeen([item("review", 5), item("closing", 2)], seen), seen);
});

test("a broken or foreign saved mark reads as nothing read", () => {
  assert.deepEqual(parseSeen(null), {});
  assert.deepEqual(parseSeen("not json"), {});
  assert.deepEqual(parseSeen("[1,2]"), {});
  assert.deepEqual(
    parseSeen('{"review":2,"refunds":-1,"closing":1.5,"other":3}'),
    { review: 2 },
  );
});
