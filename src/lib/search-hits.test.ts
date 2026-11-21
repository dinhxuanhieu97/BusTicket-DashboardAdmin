import test from "node:test";
import assert from "node:assert/strict";
import { searchHits, searchQuery } from "./search-hits";
import type { SearchResult } from "./live-contracts";

const tripId = "22222222-2222-4222-8222-222222222222";
const booking = (
  over: Partial<NonNullable<SearchResult["bookings"]>[number]> = {},
) => ({
  code: "PNAB12",
  status: "CONFIRMED",
  contactName: "Nguyễn Văn Khách",
  contactPhone: "+84912345678",
  totalAmount: 450000,
  trip: {
    id: tripId,
    code: "PN050227-TEST",
    name: "TP.HCM → Đà Lạt",
    departAt: "2027-02-05T10:30:00.000Z",
  },
  ...over,
});
const trip = {
  id: tripId,
  code: "PN050227-TEST",
  name: "TP.HCM → Đà Lạt 17:30",
  status: "OPEN",
  departAt: "2027-02-05T10:30:00.000Z",
  routeCode: "TEST",
};

test("GF1: searchQuery sends 2–64 trimmed characters and nothing else", () => {
  assert.equal(searchQuery("  PN "), "PN");
  assert.equal(searchQuery("a"), null);
  assert.equal(searchQuery("   "), null);
  assert.equal(searchQuery(""), null);
  assert.equal(searchQuery("x".repeat(64)), "x".repeat(64));
  assert.equal(searchQuery("x".repeat(65)), null);
  assert.equal(searchQuery(" 0912 345 "), "0912 345");
});

test("GF1: tickets come before trips and link to the right pages", () => {
  const hits = searchHits({ q: "PN", trips: [trip], bookings: [booking()] });
  assert.deepEqual(
    hits.map((h) => [h.kind, h.group, h.href]),
    [
      ["booking", "Vé", `/admin/passengers?date=2027-02-05&trip=${tripId}`],
      ["trip", "Chuyến", `/admin/seats?trip=${tripId}`],
    ],
  );
  assert.equal(hits[0]!.label, "PNAB12 · Nguyễn Văn Khách");
  assert.equal(hits[0]!.detail, "+84912345678 · PN050227-TEST");
  assert.match(hits[1]!.detail, /^PN050227-TEST · /);
});

test("GF1: the passenger link uses the Vietnam date of departure, not UTC", () => {
  // 18:30 UTC ngày 4 = 01:30 ngày 5 giờ VN.
  const late = booking({
    trip: { ...booking().trip, departAt: "2027-02-04T18:30:00.000Z" },
  });
  const [hit] = searchHits({ q: "PN", trips: [], bookings: [late] });
  assert.equal(hit!.href, `/admin/passengers?date=2027-02-05&trip=${tripId}`);
});

test("GF1: a role without booking.read (bookings: null) only gets trips", () => {
  const hits = searchHits({ q: "PN", trips: [trip], bookings: null });
  assert.deepEqual(
    hits.map((h) => h.kind),
    ["trip"],
  );
});

test("GF1: no results and erased contacts do not break the list", () => {
  assert.deepEqual(searchHits({ q: "zz", trips: [], bookings: [] }), []);
  const erased = booking({ contactPhone: "" });
  const [hit] = searchHits({ q: "PN", trips: [], bookings: [erased] });
  assert.equal(hit!.detail, "PN050227-TEST");
});

test("GF1: an unreadable departure time drops the date instead of throwing", () => {
  const bad = booking({ trip: { ...booking().trip, departAt: "not-a-date" } });
  const [hit] = searchHits({ q: "PN", trips: [], bookings: [bad] });
  assert.equal(hit!.href, `/admin/passengers?trip=${tripId}`);
});
