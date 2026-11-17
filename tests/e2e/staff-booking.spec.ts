import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";

const fixture = "http://127.0.0.1:3101/__test";
const origin = "http://127.0.0.1:3102";
const headers = { Origin: origin, "Content-Type": "application/json" };
const XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const TRIP = "44444444-4444-4444-8444-444444444444";
const OTHER_TRIP = "55555555-5555-4555-8555-555555555555";
const staffPassword = "Test-only-Staff-Password!";
const ownerLogin = {
  phone: "0900000001",
  password: "Test-only-Password!",
  otp: "123456",
};
const COLUMNS = [
  "STT",
  "Mã vé",
  "Phòng/Chỗ",
  "Loại",
  "Số người",
  "Trẻ <2 tuổi",
  "Họ tên khách",
  "SĐT",
  "Điểm đón",
  "Giờ đón dự kiến",
  "Điểm trả",
  "Tổng tiền",
  "Đã trả",
  "Còn phải thu",
  "Ghi chú",
  "Đã lên xe",
  "Thực thu trên xe",
];

test.beforeEach(async ({ request, page }) => {
  await request.post(`${fixture}/reset`);
  for (const client of [request, page.request]) {
    const login = await client.post("/api/auth/login", {
      headers,
      data: ownerLogin,
    });
    expect(login.status()).toBe(200);
  }
});

async function openTrip(page: Page, tab: "Bán vé" | "Hành khách") {
  // Danh sách khách ở trang riêng; modal chi tiết chuyến chỉ còn tab "Bán vé".
  if (tab === "Hành khách") {
    await page.goto(`/admin/passengers?date=2027-02-05&trip=${TRIP}`);
    return page.locator("main");
  }
  await page.goto("/admin/trips?date=2027-02-05");
  await page
    .getByRole("button", { name: "Chi tiết", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: tab, exact: true }).click();
  return dialog;
}

type Row = (string | number | null)[];
async function workbook(rows: Row[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("DanhSachKhach");
  ws.addRow(COLUMNS);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
/** Dòng theo cột của file: [Mã vé, Chỗ, Số người, Họ tên, SĐT, Điểm đón, Đã trả]. */
const line = (
  code: string | null,
  seat: string,
  occupancy: number,
  name: string,
  phone: string | number,
  pickup: string | null,
  paid: number | null,
): Row => [
  null,
  code,
  seat,
  null,
  occupancy,
  null,
  name,
  phone,
  pickup,
  null,
  null,
  null,
  paid,
  null,
  null,
  null,
  null,
];

const requestsTo = async (
  request: import("@playwright/test").APIRequestContext,
  suffix: string,
) =>
  (await (await request.get(`${fixture}/state`)).json()).requests.filter(
    (r: { path: string; method: string }) =>
      r.method === "POST" && r.path.endsWith(suffix),
  );

test("sells a seat at the counter after a dry-run quote, with pickup and cash", async ({
  page,
  request,
}) => {
  const dialog = await openTrip(page, "Bán vé");
  const sale = dialog.getByRole("region", { name: "Bán vé tại quầy" });
  // Chỉ chỗ còn trống và đang bán mới chọn được (A2 đang giữ, B2 không bán).
  await expect(sale.locator("[data-seat-pick]")).toHaveCount(1);
  await sale.getByRole("button", { name: /^A1/ }).click();
  await sale.getByLabel("Số người").selectOption("2");
  await sale.getByLabel("Họ tên khách").fill("Khách Tại Quầy");
  await sale.getByLabel("Số điện thoại").fill("0912 345 678");
  await sale.getByLabel("Điểm đón").selectOption("Ngã tư Thủ Đức");
  await sale.getByLabel("Tiền mặt đã thu (VND)").fill("200000");
  await expect(sale.getByLabel("Tiền mặt đã thu (VND)")).toHaveValue("200.000");
  await sale.getByRole("button", { name: "Kiểm tra giá" }).click();
  await expect(sale).toContainText("Xác nhận ngay · 1 phòng");
  await expect(sale).toContainText("700.000");
  await expect(sale).toContainText("500.000");
  // Dry-run không gửi Idempotency-Key; bấm bán mới ghi.
  await sale.getByRole("button", { name: /^Bán 700\.000/ }).click();
  await expect(sale).toContainText("Đã tạo đơn TESTC1 · A1");
  await expect(sale).toContainText("còn phải thu 500.000");

  const posts = await requestsTo(request, "/bookings");
  expect(posts.map((r: { query: string }) => r.query)).toEqual([
    "?dryRun=true",
    "",
  ]);
  expect(posts[1].body).toEqual({
    contactName: "Khách Tại Quầy",
    contactPhone: "0912 345 678",
    pickupStop: "Ngã tư Thủ Đức",
    items: [{ seatCode: "A1", occupancy: 2, infantCount: 0 }],
    paidAmount: 200000,
    confirm: true,
    notifyCustomer: true,
  });
  await sale.getByRole("button", { name: "Bán vé khác" }).click();
  await expect(sale.getByLabel("Họ tên khách")).toHaveValue("");
});

test("shows per-seat conflicts from the API without leaking other details", async ({
  page,
  request,
}) => {
  const dialog = await openTrip(page, "Bán vé");
  const sale = dialog.getByRole("region", { name: "Bán vé tại quầy" });
  await sale.getByRole("button", { name: /^A1/ }).click();
  await sale.getByLabel("Họ tên khách").fill("Khách Chậm Tay");
  await sale.getByLabel("Số điện thoại").fill("0912999999");
  await sale.getByRole("button", { name: "Kiểm tra giá" }).click();
  await sale.getByRole("button", { name: /^Bán / }).click();
  await expect(sale.getByRole("alert")).toContainText(
    "Chỗ vừa được đặt. Vui lòng chọn chỗ khác.",
  );
  await expect(sale.getByRole("alert")).toContainText(
    "Chỗ A1 đã có đơn TESTZZ.",
  );
  // Phải kiểm tra giá lại trước khi bán tiếp.
  await expect(
    sale.getByRole("button", { name: "Kiểm tra giá" }),
  ).toBeVisible();

  const direct = await request.post(`/api/trip-management/${TRIP}/bookings`, {
    headers: { ...headers, "Idempotency-Key": "test-key-12345678" },
    data: {
      contactName: "X",
      contactPhone: "0912999999",
      items: [{ seatCode: "A1", occupancy: 1, infantCount: 0 }],
      paidAmount: 0,
      confirm: true,
      notifyCustomer: false,
    },
  });
  expect(direct.status()).toBe(409);
  const body = await direct.json();
  expect(body.error).toEqual({
    code: "SEAT_UNAVAILABLE",
    message: "Chỗ vừa được đặt. Vui lòng chọn chỗ khác.",
    issues: [{ rows: [], message: "Chỗ A1 đã có đơn TESTZZ." }],
  });
  // Ghi thật cần Idempotency-Key; dữ liệu sai bị chặn trước khi gọi API.
  const noKey = await request.post(`/api/trip-management/${TRIP}/bookings`, {
    headers,
    data: {},
  });
  expect(noKey.status()).toBe(400);
  const badSeat = await request.post(
    `/api/trip-management/${TRIP}/bookings?dryRun=true`,
    {
      headers,
      data: {
        contactName: "X",
        contactPhone: "0912000000",
        items: [{ seatCode: "a1; drop", occupancy: 1, infantCount: 0 }],
        paidAmount: 0,
        confirm: true,
        notifyCustomer: true,
      },
    },
  );
  expect(badSeat.status()).toBe(400);
});

test("downloads a blank template with free seats, stops and pick lists", async ({
  page,
}) => {
  const dialog = await openTrip(page, "Hành khách");
  await dialog.getByRole("button", { name: "Nhập danh sách" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("link", { name: "Tải file mẫu trống" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(
    "mau-nhap-khach-TEST-20270205-1730.xlsx",
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile((await download.path())!);
  expect(wb.worksheets.map((w) => w.name)).toEqual([
    "DanhSachKhach",
    "ChoTrong",
    "DiemDonTra",
    "HuongDan",
  ]);
  const list = wb.getWorksheet("DanhSachKhach")!;
  expect((list.getRow(1).values as unknown[]).slice(1)).toEqual(COLUMNS);
  expect(list.getCell("C2").dataValidation).toMatchObject({
    type: "list",
    formulae: ["ChoTrong!$A$2:$A$2"],
  });
  expect(list.getCell("I2").dataValidation).toMatchObject({
    formulae: ["DiemDonTra!$A$2:$A$3"],
  });
  const seats = wb.getWorksheet("ChoTrong")!;
  expect(seats.getRow(2).values).toEqual([
    undefined,
    "A1",
    "Tầng dưới",
    2,
    450000,
    700000,
  ]);
  const stops = wb.getWorksheet("DiemDonTra")!;
  expect(stops.getCell("A2").value).toBe("Bến xe Miền Đông");
  expect(stops.getCell("D2").value).toBe("05:30 (+1 ngày)");
});

test("imports new passengers: preview with errors, fix, write once, replay safely", async ({
  page,
  request,
}) => {
  const dialog = await openTrip(page, "Hành khách");
  await dialog.getByRole("button", { name: "Nhập danh sách" }).click();
  const panel = dialog.getByRole("region", {
    name: "Nhập danh sách khách mới",
  });
  const file = panel.getByLabel("Tệp Excel (.xlsx, tối đa 2 MB)");

  await file.setInputFiles({
    name: "khach.xlsx",
    mimeType: XLSX,
    buffer: await workbook([
      line(
        "TESTA1",
        "A1",
        2,
        "Khách Kiểm Thử Một (+1)",
        "0912000001",
        null,
        400000,
      ),
      line(
        null,
        "A1",
        1,
        "Khách Mới (+1)",
        912345678,
        "Bến xe Miền Đông",
        100000,
      ),
      line(null, "A2", 1, "Khách Trùng", "0912345679", null, null),
      [],
    ]),
  });
  await panel.getByRole("button", { name: "Kiểm tra file" }).click();
  await expect(panel).toContainText("2 dòng khách mới");
  await expect(panel).toContainText("1 dòng có Mã vé là khách đã có đơn");
  await expect(panel.locator("[data-import-issues]")).toHaveText(
    "Dòng 4: chỗ A2 đã có đơn TESTBK1.",
  );
  await expect(panel.getByRole("button", { name: /^Ghi / })).toHaveCount(0);

  const fixed = await workbook([
    line(
      null,
      "A1",
      1,
      "Khách Mới (+1)",
      912345678,
      "Bến xe Miền Đông",
      100000,
    ),
  ]);
  await file.setInputFiles({
    name: "khach.xlsx",
    mimeType: XLSX,
    buffer: fixed,
  });
  await panel.getByRole("button", { name: "Kiểm tra file" }).click();
  await expect(panel.getByRole("region", { name: "Đơn sẽ tạo" })).toContainText(
    "Khách Mới",
  );
  await panel.getByRole("button", { name: "Ghi 1 đơn" }).click();
  await expect(panel).toContainText("Đã nhập 1 đơn mới.");
  await expect(panel).toContainText("TESTI1");

  const posts = await requestsTo(request, "/passengers/import");
  expect(posts.map((r: { query: string }) => r.query)).toEqual([
    "?dryRun=true",
    "?dryRun=true",
    "",
  ]);
  expect(posts[2].body).toEqual({
    fileName: "khach.xlsx",
    confirm: true,
    notifyCustomer: true,
    rows: [
      {
        row: 2,
        seatCode: "A1",
        contactName: "Khách Mới",
        contactPhone: 912345678,
        occupancy: 1,
        infantCount: null,
        pickupStop: "Bến xe Miền Đông",
        dropoffStop: null,
        paidAmount: 100000,
        totalAmount: null,
        note: null,
      },
    ],
  });

  // Gửi lại đúng file (cùng tùy chọn) → cùng Idempotency-Key → API trả lại kết quả cũ.
  const again = await request.post(
    `/api/trip-management/${TRIP}/passengers/import?dryRun=false&name=khach.xlsx`,
    { headers: { Origin: origin, "Content-Type": XLSX }, data: fixed },
  );
  expect(again.status()).toBe(200);
  expect((await again.json()).replayed).toBe(true);
});

test("guards the import, template and counter routes", async ({
  request,
  browser,
  baseURL,
}) => {
  const base = `/api/trip-management/${TRIP}`;
  const xlsx = await workbook([
    line(null, "A1", 1, "X", "0912000000", null, null),
  ]);
  // Sai kiểu nội dung, thiếu Origin, tệp hỏng, chuyến nhà xe khác.
  expect(
    (
      await request.post(`${base}/passengers/import`, {
        headers: { Origin: origin, "Content-Type": "text/csv" },
        data: "a,b",
      })
    ).status(),
  ).toBe(415);
  expect(
    (
      await request.post(`${base}/passengers/import`, {
        headers: { "Content-Type": XLSX },
        data: xlsx,
      })
    ).status(),
  ).toBe(403);
  const broken = await request.post(`${base}/passengers/import`, {
    headers: { Origin: origin, "Content-Type": XLSX },
    data: Buffer.from("not a workbook"),
  });
  expect(broken.status()).toBe(400);
  expect((await broken.json()).error.message).toContain("Không đọc được tệp");
  expect(
    (
      await request.post(`${base}/passengers/import?foo=1`, {
        headers: { Origin: origin, "Content-Type": XLSX },
        data: xlsx,
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post(
        `/api/trip-management/${OTHER_TRIP}/passengers/import`,
        { headers: { Origin: origin, "Content-Type": XLSX }, data: xlsx },
      )
    ).status(),
  ).toBe(404);
  const onlyExisting = await request.post(`${base}/passengers/import`, {
    headers: { Origin: origin, "Content-Type": XLSX },
    data: await workbook([
      line("TESTA1", "A1", 1, "X", "0912000000", null, null),
    ]),
  });
  expect(onlyExisting.status()).toBe(400);
  expect((await onlyExisting.json()).error.message).toContain(
    "File chưa có dòng khách mới",
  );

  // ACCOUNTANT không có booking.create: không thấy tab Bán vé, nút Nhập danh sách; route bị chặn.
  const created = await request.post("/api/staff", {
    headers,
    data: {
      fullName: "NV ACCOUNTANT",
      phone: "0909876611",
      password: staffPassword,
      role: "ACCOUNTANT",
    },
  });
  expect(created.status()).toBe(201);
  const ctx = await browser.newContext({ baseURL });
  const login = await ctx.request.post("/api/auth/login", {
    headers,
    data: { phone: "0909876611", password: staffPassword },
  });
  expect(login.status()).toBe(200);
  expect(
    (
      await ctx.request.post(`${base}/bookings?dryRun=true`, {
        headers,
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await ctx.request.post(`${base}/passengers/import`, {
        headers: { Origin: origin, "Content-Type": XLSX },
        data: xlsx,
      })
    ).status(),
  ).toBe(403);
  expect((await ctx.request.get(`${base}/passengers/template`)).status()).toBe(
    403,
  );
  const page = await ctx.newPage();
  await page.goto("/admin/trips?date=2027-02-05");
  await page
    .getByRole("button", { name: "Chi tiết", exact: true })
    .first()
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Bán vé", exact: true }),
  ).toHaveCount(0);
  const list = await openTrip(page, "Hành khách");
  await expect(list.getByText("TESTE1").first()).toBeVisible();
  await expect(
    list.getByRole("button", { name: "Nhập danh sách" }),
  ).toHaveCount(0);
  await ctx.close();
});
