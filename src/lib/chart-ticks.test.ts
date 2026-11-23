import { test } from "node:test";
import assert from "node:assert/strict";
import { axisTicks, tickPercent } from "./chart-ticks";

test("short ranges show every label", () => {
  assert.deepEqual(axisTicks(0), []);
  assert.deepEqual(axisTicks(1), [0]);
  assert.deepEqual(axisTicks(7), [0, 1, 2, 3, 4, 5, 6]);
});

test("long ranges show at most seven labels, always first and last, never crowded", () => {
  const ticks = axisTicks(42);
  assert.equal(ticks[0], 0);
  assert.equal(ticks[ticks.length - 1], 41);
  assert.ok(ticks.length <= 7, `got ${ticks.length}`);
  const step = Math.ceil(41 / 6);
  for (let i = 1; i < ticks.length; i++)
    assert.ok(ticks[i] - ticks[i - 1] >= step / 2, `gap at ${i}`);
  for (const n of [8, 11, 30, 31, 90, 366]) {
    const t = axisTicks(n);
    assert.ok(t.length <= 7 && t[0] === 0 && t.at(-1) === n - 1, String(n));
  }
});

test("label positions match data points", () => {
  assert.equal(tickPercent(0, 42), 0);
  assert.equal(tickPercent(41, 42), 100);
  assert.equal(tickPercent(0, 1), 0);
});
