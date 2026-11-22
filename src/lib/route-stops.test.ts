import { test } from "node:test";
import assert from "node:assert/strict";
import {
  duplicateStopName,
  orderStops,
  prepareStops,
  stopTimeText,
} from "./route-stops";

const stop = (name: string, time: string, day = 0) => ({ name, time, day });

test("orders points by day then time, keeping entry order on equal times", () => {
  const list = [
    stop("Nhà xe Phong Nhung", "17:20"),
    stop("Bx. An Sương", "07:30", 1),
    stop("Bưu điện Ân Nghĩa", "16:30"),
    stop("Hoài Nhơn", "17:00"),
    stop("Ngã ba", "17:00"),
  ];
  assert.deepEqual(
    orderStops(list).map((s) => s.name),
    [
      "Bưu điện Ân Nghĩa",
      "Hoài Nhơn",
      "Ngã ba",
      "Nhà xe Phong Nhung",
      "Bx. An Sương",
    ],
  );
  assert.deepEqual(orderStops([]), []);
});

test("tidies spaces in names without changing the input", () => {
  const input = [stop("  Phù   Mỹ ", "17:30")];
  assert.equal(orderStops(input)[0]!.name, "Phù Mỹ");
  assert.equal(input[0]!.name, "  Phù   Mỹ ");
});

test("finds duplicate names regardless of case and spacing", () => {
  assert.equal(
    duplicateStopName([
      stop("Hoài Nhơn", "17:00"),
      stop(" hoài  nhơn", "17:10"),
    ]),
    "hoài nhơn",
  );
  assert.equal(
    duplicateStopName([stop("Hoài Nhơn", "17:00"), stop("Phù Mỹ", "17:20")]),
    null,
  );
});

test("prepare sorts both lists or reports which list has a duplicate", () => {
  const ok = prepareStops({
    pickup: [stop("Phù Mỹ", "17:20"), stop("Ân Nghĩa", "16:30")],
    dropoff: [stop("Bx. An Sương", "07:30", 1), stop("Suối Tiên", "06:00", 1)],
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.deepEqual(
      ok.stops.pickup.map((s) => s.name),
      ["Ân Nghĩa", "Phù Mỹ"],
    );
    assert.deepEqual(
      ok.stops.dropoff.map((s) => s.name),
      ["Suối Tiên", "Bx. An Sương"],
    );
  }
  const bad = prepareStops({
    pickup: [],
    dropoff: [stop("Suối Tiên", "06:00", 1), stop("Suối Tiên", "06:10", 1)],
  });
  assert.deepEqual(bad, {
    ok: false,
    error: 'Điểm trả "Suối Tiên" bị trùng tên. Mỗi điểm cần một tên riêng.',
  });
});

test("time text adds the day offset only after the departure day", () => {
  assert.equal(stopTimeText(stop("A", "17:00")), "17:00");
  assert.equal(stopTimeText(stop("B", "06:00", 1)), "06:00 (+1 ngày)");
});
