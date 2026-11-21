import { test } from "node:test";
import assert from "node:assert/strict";
import { nextScrollChrome, type ScrollChrome } from "./scroll-chrome";

const run = (
  ys: number[],
  start: ScrollChrome = { hidden: false, anchor: 0 },
) =>
  ys.reduce<ScrollChrome[]>(
    (all, y) => [...all, nextScrollChrome(all.at(-1) ?? start, y)],
    [],
  );

test("hides when scrolling down past the top zone and shows when scrolling up", () => {
  const steps = run([100, 300, 600, 590, 560, 800]);
  assert.deepEqual(
    steps.map((s) => s.hidden),
    [true, true, true, false, false, true],
  );
});

test("always shows near the top of the page", () => {
  const hidden = { hidden: true, anchor: 500 };
  assert.deepEqual(nextScrollChrome(hidden, 40), { hidden: false, anchor: 40 });
  assert.deepEqual(nextScrollChrome(hidden, -20), { hidden: false, anchor: 0 });
});

test("ignores small movements but adds up slow scrolling", () => {
  // Cuộn chậm 3 px mỗi lần: neo không dời nên tới lúc đủ 8 px mới ẩn.
  const steps = run([200, 203, 206, 209], { hidden: false, anchor: 200 });
  assert.deepEqual(
    steps.map((s) => s.hidden),
    [false, false, false, true],
  );
  // Rung tay 5 px khi đang ẩn không làm hiện lại.
  assert.equal(
    nextScrollChrome({ hidden: true, anchor: 400 }, 395).hidden,
    true,
  );
});

test("a direction change is measured from where the last change happened", () => {
  const s = nextScrollChrome({ hidden: false, anchor: 300 }, 700);
  assert.deepEqual(s, { hidden: true, anchor: 700 });
  assert.equal(nextScrollChrome(s, 693).hidden, true);
  assert.equal(nextScrollChrome(s, 690).hidden, false);
});

test("shows again at the bottom of the page", () => {
  const hidden = { hidden: true, anchor: 1000 };
  assert.deepEqual(nextScrollChrome(hidden, 1500, 8, 64, true), {
    hidden: false,
    anchor: 1500,
  });
  assert.equal(nextScrollChrome(hidden, 1500, 8, 64, false).hidden, true);
});
