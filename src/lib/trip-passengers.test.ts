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
  roundTripText,
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
      pickupStop: { name: "Bến xe Miền Đông", time: "17:30", day: 0 },
      dropoffStop: { name: "Hoài Ân", time: "05:30", day: 1 },
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
  // Điểm đón, giờ đón dự kiến, điểm trả của đơn (đơn không chọn điểm để trống).
  assert.deepEqual(rows[0]!.slice(8, 11), [
    "Bến xe Miền Đông",
    "17:30",
    "Hoài Ân",
  ]);
  assert.deepEqual(rows[2]!.slice(8, 11), [null, null, null]);
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

test("manifestRows fills Đã lên xe per seat and the on-board total once per booking, and notes the cancel reason", () => {
  const parsed = adminTripPassengersSchema.parse({
    ...data,
    bookings: [
      booking("PNBOARD1", {
        onboardCollected: 200000,
        seats: [
          {
            code: "A2",
            floor: "1",
            occupancy: 1,
            infantCount: 0,
            boardedAt: "2027-02-01T10:50:00.000Z",
          },
          {
            code: "A4",
            floor: "1",
            occupancy: 1,
            infantCount: 0,
            boardedAt: null,
          },
        ],
      }),
      booking("PNCANCL1", {
        status: "CANCELLED",
        cancelReason: "Khách đổi ngày",
        onboardCollected: 0,
      }),
    ],
  });
  const rows = manifestRows(parsed, detail);
  assert.deepEqual(
    rows.map((r) => r.slice(15)),
    [
      ["x", 200000],
      [null, null],
      [null, null],
    ],
  );
  assert.match(String(rows[2]![14]), /Lý do hủy: Khách đổi ngày/);
});

test("filterBookings: by money still due and by pickup stop", async () => {
  const { filterBookings, NO_PICKUP } = await import("./trip-passengers");
  const stop = (name: string, time: string) => ({ name, time, day: 0 });
  const rows = [
    booking("D1", {
      dueAmount: 440000,
      pickupStop: stop("Ngã tư Ga", "17:50"),
    }),
    booking("P1", { dueAmount: 0, pickupStop: stop("Suối Tiên", "18:15") }),
    booking("N1", { dueAmount: 0, pickupStop: null }),
  ].map((b) => adminTripPassengersSchema.shape.bookings.element.parse(b));
  const codes = (r: { code: string }[]) => r.map((b) => b.code);
  assert.deepEqual(codes(filterBookings(rows, "due", "")), ["D1"]);
  assert.deepEqual(codes(filterBookings(rows, "paid", "")), ["P1", "N1"]);
  assert.deepEqual(codes(filterBookings(rows, "all", "Suối Tiên")), ["P1"]);
  assert.deepEqual(codes(filterBookings(rows, "paid", NO_PICKUP)), ["N1"]);
});

test("pickupOptions are unique and ordered by pickup time", async () => {
  const { pickupOptions } = await import("./trip-passengers");
  const stop = (name: string, time: string, day = 0) => ({ name, time, day });
  const rows = [
    booking("A", { pickupStop: stop("Suối Tiên", "18:15") }),
    booking("B", { pickupStop: stop("Bến xe An Sương", "17:30") }),
    booking("C", { pickupStop: stop("Suối Tiên", "18:15") }),
    booking("D", { pickupStop: null }),
  ].map((b) => adminTripPassengersSchema.shape.bookings.element.parse(b));
  assert.deepEqual(pickupOptions(rows), ["Bến xe An Sương", "Suối Tiên"]);
});

test("paginate clamps the page and reports the visible range", async () => {
  const { paginate } = await import("./trip-passengers");
  const rows = Array.from({ length: 23 }, (_, i) => i + 1);
  assert.deepEqual(paginate(rows, 2, 10), {
    rows: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    page: 2,
    pages: 3,
    from: 11,
    to: 20,
  });
  assert.equal(paginate(rows, 9, 10).page, 3);
  assert.deepEqual(paginate([], 1, 20), {
    rows: [],
    page: 1,
    pages: 1,
    from: 0,
    to: 0,
  });
});

test("seatSummary shows the first seat and how many more", async () => {
  const { seatSummary } = await import("./trip-passengers");
  const seat = (code: string) => ({
    code,
    floor: "1",
    occupancy: 1,
    infantCount: 0,
  });
  assert.equal(seatSummary({ seats: [seat("A1")] }), "A1");
  assert.equal(
    seatSummary({ seats: [seat("A12"), seat("B1"), seat("B2")] }),
    "A12 +2",
  );
  assert.equal(seatSummary({ seats: [] }), "—");
});

test("GB4: a round-trip ticket shows both legs in Vietnam time; one-way and old API show nothing", () => {
  const roundTrip = {
    outbound: {
      tripId: "t1",
      departAt: "2027-02-01T11:00:00.000Z",
      routeCode: "HCM-HA",
    },
    return: {
      tripId: "t2",
      departAt: "2027-02-03T10:30:00.000Z",
      routeCode: "HA-HCM",
    },
  };
  assert.equal(
    roundTripText({ roundTrip }),
    "Khứ hồi · Đi 18:00 01/02/2027 (HCM-HA) · Về 17:30 03/02/2027 (HA-HCM)",
  );
  assert.equal(roundTripText({ roundTrip: null }), null);
  assert.equal(roundTripText({}), null);
});
