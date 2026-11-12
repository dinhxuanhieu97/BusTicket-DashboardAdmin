import test from "node:test";
import assert from "node:assert/strict";
import {
  MANIFEST_COLUMNS,
  adminTripPassengersSchema,
  attachmentHeader,
  csvCell,
  filterPassengers,
  localPhone,
  manifestRows,
  manifestTripCode,
  toCsv,
  type AdminTripPassengers,
} from "./trip-passengers";
import type { TripDetail } from "./trip-detail";

const trip = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Chuyến kiểm thử",
  status: "OPEN",
  departAt: "2027-02-01T11:00:00.000Z",
  contactPhone: null,
  route: { code: "HCM-HA", origin: "TP.HCM", destination: "Hoài Ân" },
  vehicle: { code: "PN01", name: "Xe 01", plateNumber: null },
};
const booking = (code: string, extra: Record<string, unknown> = {}) => ({
  code,
  status: "CONFIRMED",
  channel: "ONLINE",
  contactName: "Nguyễn Văn A",
  contactPhone: "+84912000001",
  contactErased: false,
  note: null,
  totalAmount: 840000,
  paidAmount: 400000,
  dueAmount: 440000,
  paymentStatus: "PARTIAL",
  holdUntil: null,
  createdAt: "2027-01-20T03:00:00.000Z",
  seats: [{ code: "A2", floor: "1", occupancy: 2, infantCount: 1 }],
  ...extra,
});
const data: AdminTripPassengers = adminTripPassengersSchema.parse({
  trip,
  bookings: [
    booking("PN7K3D2Q", {
      seats: [
        { code: "A2", floor: "1", occupancy: 2, infantCount: 1 },
        { code: "A4", floor: "1", occupancy: 1, infantCount: 0 },
      ],
    }),
    booking("PN8M4F6R", {
      status: "HOLDING",
      holdUntil: "2027-01-20T05:00:00.000Z",
      contactName: "Trần Thị B",
      contactPhone: "+84912000002",
      note: "Mang 1 thùng hàng",
      seats: [{ code: "B3", floor: "2", occupancy: 1, infantCount: 0 }],
    }),
    booking("PN9P2H7T", {
      contactErased: true,
      contactName: "Khách đã xóa thông tin",
      contactPhone: "",
      seats: [{ code: "B5", floor: "2", occupancy: 1, infantCount: 0 }],
    }),
  ],
  summary: { bookings: 2, seats: 3, people: 4, infants: 1, dueAmount: 880000 },
  holding: { bookings: 1, seats: 1 },
  fetchedAt: "2027-01-20T03:00:00.000Z",
});
const detail = {
  layout: {
    unit: "phòng",
    kind: "room",
    floors: [
      { code: "1", label: "Tầng dưới", rows: [] },
      { code: "2", label: "Tầng trên", rows: [] },
    ],
  },
  seats: [
    { code: "A2", floor: "1", maxOccupancy: 2 },
    { code: "A4", floor: "1", maxOccupancy: 1 },
    { code: "B3", floor: "2", maxOccupancy: 1 },
  ],
} as unknown as TripDetail;

test("passenger schema rejects responses without the admin-only fields", () => {
  const { holding: _h, ...withoutHolding } = data;
  assert.equal(
    adminTripPassengersSchema.safeParse(withoutHolding).success,
    false,
  );
});

test("filterPassengers matches code, seat, name and phone in local or +84 form", () => {
  const codes = (q: string) =>
    filterPassengers(data.bookings, q).map((b) => b.code);
  assert.deepEqual(codes(""), ["PN7K3D2Q", "PN8M4F6R", "PN9P2H7T"]);
  assert.deepEqual(codes("pn8m"), ["PN8M4F6R"]);
  assert.deepEqual(codes("a4"), ["PN7K3D2Q"]);
  assert.deepEqual(codes("trần"), ["PN8M4F6R"]);
  assert.deepEqual(codes("0912 000 002"), ["PN8M4F6R"]);
  assert.deepEqual(codes("84912000001"), ["PN7K3D2Q"]);
  // Khách đã xóa thông tin không khớp theo nhãn thay thế.
  assert.deepEqual(codes("đã xóa"), []);
});

test("manifestRows writes one row per seat with money only on the first row of a booking", () => {
  const rows = manifestRows(data, detail);
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => r.length === MANIFEST_COLUMNS.length));
  assert.deepEqual(rows[0]!.slice(0, 8), [
    1,
    "PN7K3D2Q",
    "A2",
    "Phòng đôi",
    2,
    1,
    "Nguyễn Văn A (+1)",
    "0912000001",
  ]);
  assert.deepEqual(rows[0]!.slice(11, 14), [840000, 400000, 440000]);
  assert.deepEqual(rows[1]!.slice(0, 7), [
    2,
    "PN7K3D2Q",
    "A4",
    "Phòng đơn",
    1,
    null,
    "Nguyễn Văn A",
  ]);
  assert.deepEqual(rows[1]!.slice(11, 15), [null, null, null, null]);
  assert.match(
    String(rows[2]![14]),
    /^Đang giữ chỗ đến 12:00 20\/01\/2027 · Mang 1 thùng hàng$/,
  );
  // Khách đã xóa thông tin: không có SĐT, dùng nhãn.
  assert.equal(rows[3]![6], "Khách đã xóa thông tin");
  assert.equal(rows[3]![7], null);
  // Loại chỗ không có trên sơ đồ hiện tại → tên tầng.
  assert.equal(rows[3]![3], "Tầng trên");
});

test("CSV output has a BOM, CRLF lines, and neutralises spreadsheet formulas", () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell("+84912"), "'+84912");
  assert.equal(csvCell("-1"), "'-1");
  assert.equal(csvCell("@a"), "'@a");
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell(-1), "-1");
  assert.equal(csvCell(null), "");
  const csv = toCsv(
    ["A", "B"],
    [
      ["x", 1],
      [null, "y"],
    ],
  );
  assert.equal(csv, "﻿A,B\r\nx,1\r\n,y\r\n");
});

test("trip code and file names use Vietnam time and stay header-safe", () => {
  assert.equal(
    manifestTripCode("HCM-HA", "2027-02-01T11:00:00.000Z"),
    "HCM-HA-20270201-1800",
  );
  assert.equal(localPhone("+84912000001"), "0912000001");
  assert.equal(localPhone(""), "");
  assert.equal(
    attachmentHeader('danh-sách khách".xlsx'),
    "attachment; filename=\"danh-sach-khach-.xlsx\"; filename*=UTF-8''danh-s%C3%A1ch%20kh%C3%A1ch%22.xlsx",
  );
});
