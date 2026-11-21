import test from "node:test";
import assert from "node:assert/strict";
import { collectPages, withCursor } from "./paging";

type Page = { trips: number[]; nextCursor?: string | null; meta?: string };

/** API giả: mỗi trang 2 chuyến, con trỏ "c1", "c2"…; ghi lại con trỏ được gọi. */
function pages(total: number, perPage = 2) {
  const calls: (string | null)[] = [];
  const fetchPage = async (cursor: string | null): Promise<Page> => {
    calls.push(cursor);
    const n = cursor === null ? 0 : Number(cursor.slice(1));
    const start = n * perPage;
    const trips = Array.from(
      { length: Math.max(0, Math.min(perPage, total - start)) },
      (_, i) => start + i,
    );
    return {
      trips,
      nextCursor: start + perPage < total ? `c${n + 1}` : null,
      meta: `page-${n}`,
    };
  };
  return { fetchPage, calls };
}

test("GF9: a single page is returned as is", async () => {
  const { fetchPage, calls } = pages(2);
  const r = await collectPages(fetchPage);
  assert.deepEqual(r.trips, [0, 1]);
  assert.equal(r.nextCursor, null);
  assert.deepEqual(calls, [null]);
});

test("GF9: follows nextCursor and merges every page in order", async () => {
  const { fetchPage, calls } = pages(5);
  const r = await collectPages(fetchPage);
  assert.deepEqual(r.trips, [0, 1, 2, 3, 4]);
  assert.equal(r.nextCursor, null);
  assert.deepEqual(calls, [null, "c1", "c2"]);
  assert.equal(r.meta, "page-2");
});

test("GF9: stops at maxPages and keeps the cursor so the UI can say 'at least'", async () => {
  const { fetchPage, calls } = pages(100);
  const r = await collectPages(fetchPage, 3);
  assert.equal(r.trips.length, 6);
  assert.equal(r.nextCursor, "c3");
  assert.equal(calls.length, 3);
});

test("GF9: an empty first page makes one call", async () => {
  const { fetchPage, calls } = pages(0);
  const r = await collectPages(fetchPage);
  assert.deepEqual(r.trips, []);
  assert.equal(calls.length, 1);
});

test("GF9: a repeated cursor stops instead of looping forever", async () => {
  let calls = 0;
  const r = await collectPages<Page>(async () => {
    calls++;
    return { trips: [calls], nextCursor: "same" };
  });
  assert.equal(calls, 2);
  assert.deepEqual(r.trips, [1, 2]);
  assert.equal(r.nextCursor, "same");
});

test("GF9: a failing page rejects the whole load", async () => {
  await assert.rejects(
    collectPages<Page>(async (cursor) => {
      if (cursor) throw new Error("Mất kết nối API.");
      return { trips: [1], nextCursor: "c1" };
    }),
    /Mất kết nối API/,
  );
});

test("GF9: cursor is appended with & or ? and URL-encoded", () => {
  assert.equal(withCursor("trips?from=a", null), "trips?from=a");
  assert.equal(
    withCursor("trips?from=a&to=b", "x+y/="),
    "trips?from=a&to=b&cursor=x%2By%2F%3D",
  );
  assert.equal(withCursor("trips", "c1"), "trips?cursor=c1");
});
