import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PAGE_SIZE,
  nextSort,
  pageInfo,
  pageSlice,
  parsePageSize,
  rangeText,
  sortRows,
} from "./table-state";

test("clicking a header cycles ascending, descending, then off; another column restarts", () => {
  const a = nextSort(null, "amount");
  assert.deepEqual(a, { key: "amount", dir: "asc" });
  const b = nextSort(a, "amount");
  assert.deepEqual(b, { key: "amount", dir: "desc" });
  assert.equal(nextSort(b, "amount"), null);
  assert.deepEqual(nextSort(b, "at"), { key: "at", dir: "asc" });
});

test("sorts numbers and Vietnamese text, keeps ties in order and empty cells last", () => {
  const rows = [
    { id: 1, n: 30, s: "Đà Lạt" },
    { id: 2, n: null, s: "" },
    { id: 3, n: 5, s: "An Giang" },
    { id: 4, n: 30, s: "Bình Định" },
  ];
  const val = (r: (typeof rows)[number], k: string) => (k === "n" ? r.n : r.s);
  const ids = (sort: Parameters<typeof sortRows>[1]) =>
    sortRows(rows, sort, val).map((r) => r.id);
  assert.deepEqual(ids({ key: "n", dir: "asc" }), [3, 1, 4, 2]);
  assert.deepEqual(ids({ key: "n", dir: "desc" }), [1, 4, 3, 2]);
  // "Đ" xếp sau "B" theo bảng chữ cái tiếng Việt.
  assert.deepEqual(ids({ key: "s", dir: "asc" }), [3, 4, 1, 2]);
  assert.equal(sortRows(rows, null, val), rows);
});

test("text with numbers sorts naturally (A2 before A10)", () => {
  const rows = ["A10", "A2", "A1"];
  assert.deepEqual(
    sortRows(rows, { key: "x", dir: "asc" }, (r) => r),
    ["A1", "A2", "A10"],
  );
});

test("page info clamps the page and says which rows are shown", () => {
  assert.deepEqual(pageInfo(141, 1, 25), {
    page: 1,
    pages: 6,
    from: 1,
    to: 25,
    total: 141,
  });
  const last = pageInfo(141, 99, 25);
  assert.deepEqual([last.page, last.from, last.to], [6, 126, 141]);
  assert.deepEqual(pageInfo(0, 3, 25), {
    page: 1,
    pages: 1,
    from: 0,
    to: 0,
    total: 0,
  });
  assert.equal(pageInfo(10, Number.NaN, 25).page, 1);
  const rows = Array.from({ length: 30 }, (_, i) => i);
  assert.deepEqual(pageSlice(rows, pageInfo(30, 2, 25)), [25, 26, 27, 28, 29]);
  assert.deepEqual(pageSlice([], pageInfo(0, 1, 25)), []);
});

test("range text and page size parsing", () => {
  assert.equal(
    rangeText(pageInfo(1412, 2, 25), "khoản thu"),
    "26–50 trên 1.412 khoản thu",
  );
  assert.equal(rangeText(pageInfo(0, 1, 25), "khoản thu"), "0 khoản thu");
  assert.equal(DEFAULT_PAGE_SIZE, 25);
  assert.equal(parsePageSize("50"), 50);
  assert.equal(parsePageSize("7"), 25);
  assert.equal(parsePageSize(null), 25);
});
