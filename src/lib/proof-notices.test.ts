import test from "node:test";
import assert from "node:assert/strict";
import type { ProofNotice } from "./live-contracts";
import {
  isNoticeUnread,
  markAllNoticesRead,
  markNoticeRead,
  parseNoticeRead,
  settleNoticeRead,
  unreadNotices,
} from "./proof-notices";

const notice = (
  id: string,
  state: ProofNotice["state"] = "PENDING",
): ProofNotice => ({
  id,
  code: id.split(":")[1] ?? id,
  contactName: "Khách",
  trip: { id: "t", name: "Chuyến", departAt: "2026-11-28T10:30:00.000Z" },
  proofCount: 1,
  at: "2026-11-25T12:30:00.000Z",
  state,
});

test("first use on a device treats existing notices as read", () => {
  const items = [notice("proof:A:1"), notice("proof:B:1")];
  assert.equal(parseNoticeRead(null), null);
  const read = settleNoticeRead(items, parseNoticeRead(null));
  assert.equal(unreadNotices(items, read), 0);
});

test("a read notice stays in the list after the booking is confirmed (F80)", () => {
  const before = [notice("proof:A:1")];
  const read = markNoticeRead([], before[0]!);
  const after = [notice("proof:A:1", "CONFIRMED")];
  assert.equal(after.length, 1);
  assert.equal(isNoticeUnread(after[0]!, settleNoticeRead(after, read)), false);
});

test("another proof on the same booking is a new unread notice", () => {
  const read = ["proof:A:1"];
  const items = [notice("proof:A:2"), notice("proof:B:1")];
  const settled = settleNoticeRead(items, read);
  assert.deepEqual(settled, []);
  assert.equal(unreadNotices(items, settled), 2);
  assert.deepEqual(markAllNoticesRead(items), ["proof:A:2", "proof:B:1"]);
});

test("corrupt or foreign storage is treated as nothing read", () => {
  assert.deepEqual(parseNoticeRead("{bad"), []);
  assert.deepEqual(parseNoticeRead('{"a":1}'), []);
  assert.deepEqual(parseNoticeRead('["x",2,"y"]'), ["x", "y"]);
});

test("marking twice does not duplicate", () => {
  const n = notice("proof:A:1");
  assert.deepEqual(markNoticeRead(markNoticeRead([], n), n), ["proof:A:1"]);
});
