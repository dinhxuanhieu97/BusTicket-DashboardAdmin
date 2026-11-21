import test from "node:test";
import assert from "node:assert/strict";
import { routeChips } from "./route-chips";

const trip = (id: number, route_code: string) => ({ id, route_code });

test("GF13: no filter lists every route seen, sorted, and shows all rows", () => {
  const r = routeChips({
    known: ["HCM-HA"],
    loaded: [trip(1, "HCM-QN"), trip(2, "HCM-HA"), trip(3, "HCM-QN")],
    selected: "",
    serverFiltered: false,
  });
  assert.deepEqual(r.routes, ["HCM-HA", "HCM-QN"]);
  assert.equal(r.active, "");
  assert.equal(r.show, true);
  assert.equal(r.rows.length, 3);
});

test("GF13: a single route without a filter needs no chips", () => {
  const r = routeChips({
    known: [],
    loaded: [trip(1, "HCM-HA")],
    selected: "",
    serverFiltered: false,
  });
  assert.equal(r.show, false);
});

test("GF13: server-filtered rows are kept as returned (pagination stays on the server)", () => {
  const r = routeChips({
    known: ["HCM-HA", "HCM-QN"],
    loaded: [trip(1, "HCM-QN")],
    selected: "HCM-QN",
    serverFiltered: true,
  });
  assert.deepEqual(r.rows, [trip(1, "HCM-QN")]);
  assert.equal(r.active, "HCM-QN");
});

test("GF13: old backend falls back to filtering the loaded page", () => {
  const r = routeChips({
    known: [],
    loaded: [trip(1, "HCM-QN"), trip(2, "HCM-HA")],
    selected: "HCM-HA",
    serverFiltered: false,
  });
  assert.deepEqual(r.rows, [trip(2, "HCM-HA")]);
});

test("GF13: after a date change resets known routes, chips stay so the filter can be cleared", () => {
  // Đổi ngày: `known` bị xóa, backend chỉ trả chuyến của tuyến đang lọc (hoặc không có chuyến nào).
  for (const loaded of [[trip(1, "HCM-QN")], []]) {
    const r = routeChips({
      known: [],
      loaded,
      selected: "HCM-QN",
      serverFiltered: true,
    });
    assert.equal(r.show, true);
    assert.deepEqual(r.routes, ["HCM-QN"]);
    assert.equal(r.active, "HCM-QN");
  }
});
