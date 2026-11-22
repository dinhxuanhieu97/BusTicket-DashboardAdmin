import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";

const fixture = "http://127.0.0.1:3101/__test";
const headers = {
  Origin: "http://127.0.0.1:3102",
  "Content-Type": "application/json",
};
const TRIP = "44444444-4444-4444-8444-444444444444";
const OTHER_TRIP = "55555555-5555-4555-8555-555555555555";
const staffPassword = "Test-only-Staff-Password!";

const ownerLogin = {
  phone: "0900000001",
  password: "Test-only-Password!",
  otp: "123456",
};

test.beforeEach(async ({ request, page }) => {
  await request.post(`${fixture}/reset`);
  // `request` (gọi API trực tiếp) và trình duyệt của `page` là hai phiên riêng: đăng nhập cả hai.
  for (const client of [request, page.request]) {
    const login = await client.post("/api/auth/login", {
      headers,
      data: ownerLogin,
    });
    expect(login.status()).toBe(200);
  }
});

async function openPassengers(page: Page) {
  await page.goto("/admin/passengers?date=2027-02-05");
  await expect(
    page
      .getByRole("button", { pressed: true })
      .filter({ hasText: "PN050227-TEST" }),
  ).toBeVisible();
  return page.getByRole("region", { name: "Hành khách", exact: true });
}

test("filters by money due and pickup stop, then clears every filter", async ({
  page,
}) => {
  const section = await openPassengers(page);
  const rows = section
    .getByRole("region", { name: "Danh sách hành khách" })
    .locator("tbody tr");
  await expect(rows).toHaveCount(3);
  await section.getByLabel("Thanh toán").selectOption("due");
  await expect(rows).toHaveCount(2);
  await section.getByLabel("Điểm đón").selectOption("Bến xe Miền Đông");
  await expect(rows).toHaveCount(1);
  await expect(rows).toHaveAttribute("data-booking", "TESTA1");
  await expect(section.getByText("1–1 trên 1 đơn · lọc từ 3")).toBeVisible();
  await section.getByRole("button", { name: "Xoá lọc" }).click();
  await expect(rows).toHaveCount(3);
  await expect(section.getByRole("button", { name: "Xoá lọc" })).toHaveCount(0);
});

test("sorts by seat, money due and status, and filters by booking status (T3)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const section = await openPassengers(page);
  const list = section.getByRole("region", { name: "Danh sách hành khách" });
  const codes = () =>
    list
      .locator("tbody tr")
      .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-booking")));
  await expect.poll(codes).toEqual(["TESTA1", "TESTH1", "TESTE1"]);
  await expect(section.getByText("1–3 trên 3 đơn")).toBeVisible();

  await list.getByRole("button", { name: /Chỗ · Khách/ }).click();
  await list.getByRole("button", { name: /Chỗ · Khách/ }).click();
  await expect(
    list.getByRole("columnheader", { name: /Chỗ · Khách/ }),
  ).toHaveAttribute("aria-sort", "descending");
  await expect.poll(codes).toEqual(["TESTE1", "TESTH1", "TESTA1"]);

  // Còn thu tăng dần: đã trả đủ (0) trước.
  await list.getByRole("button", { name: /Thanh toán/ }).click();
  await expect.poll(codes).toEqual(["TESTE1", "TESTH1", "TESTA1"]);
  await list.getByRole("button", { name: /Thanh toán/ }).click();
  await expect.poll(codes).toEqual(["TESTA1", "TESTH1", "TESTE1"]);

  // Trạng thái: đơn đang giữ chỗ (việc cần làm) lên đầu.
  await list.getByRole("button", { name: /Trạng thái/ }).click();
  await expect.poll(codes).toEqual(["TESTH1", "TESTA1", "TESTE1"]);

  await section
    .getByLabel("Trạng thái", { exact: true })
    .selectOption("HOLDING");
  await expect.poll(codes).toEqual(["TESTH1"]);
  await expect(section.getByText("1–1 trên 1 đơn · lọc từ 3")).toBeVisible();
  await section.getByRole("button", { name: "Xoá lọc" }).click();
  await expect.poll(codes).toHaveLength(3);
});

test("on a phone, sorting uses a select instead of hidden column headers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const section = await openPassengers(page);
  const list = section.getByRole("region", { name: "Danh sách hành khách" });
  await expect(list.locator("thead")).toBeHidden();
  const codes = () =>
    list
      .locator("tbody tr")
      .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-booking")));
  await section.getByLabel("Sắp xếp").selectOption("status:asc");
  await expect.poll(codes).toEqual(["TESTH1", "TESTA1", "TESTE1"]);
  await section.getByLabel("Sắp xếp").selectOption("seat:asc");
  await expect.poll(codes).toEqual(["TESTA1", "TESTH1", "TESTE1"]);
});

test("on a phone the list fits the screen without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const section = await openPassengers(page);
  await expect(section.locator('tr[data-booking="TESTA1"]')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const table = section.getByRole("region", { name: "Danh sách hành khách" });
  const scroll = await table.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(scroll).toBeLessThanOrEqual(1);
});

test("OWNER sees passengers with contacts, filters them, and switches to every booking", async ({
  page,
}) => {
  const section = await openPassengers(page);
  const table = section.getByRole("region", { name: "Danh sách hành khách" });
  await expect(table.locator("tbody tr")).toHaveCount(3);
  const first = table.locator('tr[data-booking="TESTA1"]');
  await expect(first).toContainText("Khách Kiểm Thử Một");
  await expect(first.getByRole("link", { name: "0912000001" })).toHaveAttribute(
    "href",
    "tel:+84912000001",
  );
  await expect(table.locator('tr[data-booking="TESTH1"]')).toContainText(
    "Đang giữ chỗ",
  );
  await expect(table.locator('tr[data-booking="TESTH1"]')).toContainText(
    "Tại quầy",
  );
  await expect(table.locator('tr[data-booking="TESTE1"]')).toContainText(
    "Khách đã xóa thông tin",
  );
  await expect(
    table.locator('tr[data-booking="TESTE1"]').getByRole("link"),
  ).toHaveCount(0);
  // GB4: vé khứ hồi ghi rõ hai lượt; vé một chiều không có dòng này.
  await expect(
    table.locator('tr[data-booking="TESTE1"]').getByTestId("round-trip"),
  ).toHaveText(
    "Khứ hồi · Đi 17:30 05/02/2027 (TEST) · Về 08:00 07/02/2027 (TEST-R)",
  );
  await expect(table.getByTestId("round-trip")).toHaveCount(1);
  const summary = section.getByLabel("Tóm tắt hành khách");
  await expect(summary).toContainText(
    /Đơn đã xác nhận\s*2 đơn\s*4 khách · 3 chỗ/,
  );
  await expect(summary).toContainText(/Đang giữ chỗ\s*1 đơn\s*1 chỗ/);
  await expect(summary).toContainText(/Còn phải thu\s*440\.000/);

  await section
    .getByLabel("Tìm theo mã vé, tên, SĐT hoặc chỗ")
    .fill("0912 000 003");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.locator("tbody tr")).toHaveAttribute(
    "data-booking",
    "TESTH1",
  );
  await section.getByLabel("Tìm theo mã vé, tên, SĐT hoặc chỗ").fill("");

  await section.getByRole("button", { name: "Tất cả" }).click();
  await expect(table.locator('tr[data-booking="TESTX1"]')).toContainText(
    "Đã hủy",
  );
  await expect(page).toHaveURL(/trip=44444444-4444-4444-8444-444444444444/);
});

test("Hành khách is its own menu page, reachable from the trip list and trip detail", async ({
  page,
}) => {
  await page.goto("/admin/trips?date=2027-02-05");
  const nav = page.getByRole("navigation").first();
  await expect(nav.getByRole("link", { name: "Hành khách" })).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: "PN050227-TEST" });
  await row.getByRole("link", { name: "Hành khách", exact: true }).click();
  await expect(page).toHaveURL(
    /\/admin\/passengers\?date=\d{4}-\d{2}-\d{2}&trip=44444444-4444-4444-8444-444444444444/,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Hành khách",
  );
  await expect(
    page.getByRole("region", { name: "Chuyến đang xem" }),
  ).toContainText("PN050227-TEST");
  await expect(page.locator('tr[data-booking="TESTA1"]')).toBeVisible();

  // Chi tiết chuyến không còn tab khách; có nút sang trang Hành khách.
  await page.goto("/admin/trips?date=2027-02-05");
  await row.getByRole("button", { name: "Chi tiết", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Hành khách" })).toHaveCount(
    0,
  );
  await dialog.getByRole("link", { name: "Xem hành khách" }).click();
  await expect(page).toHaveURL(
    /\/admin\/passengers\?date=\d{4}-\d{2}-\d{2}&trip=4{8}-/,
  );

  // Ngày không có chuyến: báo rõ, không hiện bảng cũ.
  await page.getByLabel("Ngày khởi hành · Giờ Việt Nam").fill("2027-03-09");
  await expect(page.getByText("Không có chuyến nào khởi hành")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Hành khách", exact: true }),
  ).toHaveCount(0);
});

test("dialogs size by percentage of the screen, not a fixed width", async ({
  page,
}) => {
  for (const [width, ratio] of [
    [375, 1],
    [1024, 0.9],
    [1440, 0.75],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/trips?date=2027-02-05");
    await page
      .getByRole("button", { name: "Chi tiết", exact: true })
      .first()
      .click();
    const box = (await page.getByRole("dialog").boundingBox())!;
    const expected = width < 768 ? width - 32 : width * ratio;
    expect(Math.abs(box.width - expected)).toBeLessThan(2);
    await page.getByRole("button", { name: "Đóng", exact: true }).click();
  }
});

test("exports the manifest as Excel in the operator template and as safe CSV", async ({
  page,
  request,
}) => {
  const section = await openPassengers(page);
  await expect(section.locator('tr[data-booking="TESTA1"]')).toBeVisible();

  const [xlsx] = await Promise.all([
    page.waitForEvent("download"),
    section.getByRole("link", { name: "Xuất Excel" }).click(),
  ]);
  expect(xlsx.suggestedFilename()).toBe(
    "danh-sach-khach-TEST-20270205-1730.xlsx",
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile((await xlsx.path())!);
  expect(wb.worksheets.map((w) => w.name)).toEqual([
    "Chuyen",
    "DanhSachKhach",
    "HuongDan",
  ]);
  const list = wb.getWorksheet("DanhSachKhach")!;
  expect(list.getRow(1).values).toEqual([
    undefined,
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
  ]);
  expect(list.rowCount).toBe(5);
  const r2 = list.getRow(2);
  expect([
    r2.getCell(2).value,
    r2.getCell(3).value,
    r2.getCell(4).value,
  ]).toEqual(["TESTA1", "A1", "Phòng đôi"]);
  expect(r2.getCell(7).value).toBe("Khách Kiểm Thử Một (+1)");
  expect(r2.getCell(8).value).toBe("0912000001");
  expect(r2.getCell(12).value).toBe(840000);
  expect(list.getRow(3).getCell(12).value).toBeNull();
  expect(String(list.getRow(4).getCell(15).value)).toContain("Đang giữ chỗ");
  expect(String(list.getRow(5).getCell(15).value)).toContain(
    "Khứ hồi · Đi 17:30 05/02/2027 (TEST) · Về 08:00 07/02/2027 (TEST-R)",
  );
  const info = wb.getWorksheet("Chuyen")!;
  expect(info.getCell("B2").value).toBe("TEST-20270205-1730");

  const [csv] = await Promise.all([
    page.waitForEvent("download"),
    section.getByRole("link", { name: "CSV" }).click(),
  ]);
  const text = await readFile((await csv.path())!, "utf8");
  expect(text.startsWith("﻿STT,Mã vé,")).toBe(true);
  // Ghi chú bắt đầu bằng "=" không thành công thức khi mở bằng Excel.
  expect(text).toContain("'=Đón ở ngã tư");
  expect(text).not.toContain(",=Đón");

  const state = await (await request.get(`${fixture}/state`)).json();
  const exports = state.requests.filter((r: { path: string }) =>
    r.path.endsWith("/passengers/export"),
  );
  expect(exports.map((r: { query: string }) => r.query)).toEqual([
    "?status=active&format=xlsx",
    "?status=active&format=csv",
  ]);
});

test("SELLER can view and export; ASSISTANT and owners without the permission cannot", async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  for (const [role, phone] of [
    ["SELLER", "0909876601"],
    ["ASSISTANT", "0909876602"],
  ]) {
    const created = await request.post("/api/staff", {
      headers,
      data: { fullName: `NV ${role}`, phone, password: staffPassword, role },
    });
    expect(created.status()).toBe(201);
  }
  const contextFor = async (phone: string) => {
    const ctx = await browser.newContext({ baseURL });
    const login = await ctx.request.post("/api/auth/login", {
      headers,
      data: { phone, password: staffPassword },
    });
    expect(login.status()).toBe(200);
    return ctx;
  };
  const seller = await contextFor("0909876601");
  const listUrl = `/api/trip-management/${TRIP}/passengers`;
  expect((await seller.request.get(listUrl)).status()).toBe(200);
  const exported = await seller.request.get(`${listUrl}/export?format=csv`);
  expect(exported.status()).toBe(200);
  expect(exported.headers()["cache-control"]).toContain("no-store");
  expect(exported.headers()["content-disposition"]).toContain(
    'filename="danh-sach-khach-TEST-20270205-1730.csv"',
  );
  const sellerPage = await seller.newPage();
  const section = await openPassengers(sellerPage);
  await expect(section.getByRole("link", { name: "Xuất Excel" })).toBeVisible();
  await seller.close();

  const assistant = await contextFor("0909876602");
  expect((await assistant.request.get(listUrl)).status()).toBe(403);
  expect(
    (await assistant.request.get(`${listUrl}/export?format=xlsx`)).status(),
  ).toBe(403);
  await assistant.close();

  // Người không có quyền: không thấy menu/nút Hành khách, trang và route bị chặn.
  await request.post(`${fixture}/state`, {
    data: { permissions: ["trip.read", "trip.write"] },
  });
  const relogin = await page.request.post("/api/auth/login", {
    headers,
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
  expect(relogin.status()).toBe(200);
  await page.goto("/admin/trips?date=2027-02-05");
  await expect(
    page
      .getByRole("navigation")
      .first()
      .getByRole("link", { name: "Hành khách" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Hành khách" })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Chi tiết", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Xem hành khách" }),
  ).toHaveCount(0);
  await page.goto("/admin/passengers?date=2027-02-05");
  await expect(page.locator('tr[data-booking="TESTA1"]')).toHaveCount(0);
  expect((await request.get(listUrl)).status()).toBe(403);
  expect((await request.get(`${listUrl}/export`)).status()).toBe(403);
});

test("rejects bad ids and filters, and maps another operator's trip to 404", async ({
  request,
}) => {
  const base = "/api/trip-management";
  expect((await request.get(`${base}/not-a-uuid/passengers`)).status()).toBe(
    400,
  );
  expect(
    (await request.get(`${base}/${TRIP}/passengers?status=foo`)).status(),
  ).toBe(400);
  expect(
    (
      await request.get(`${base}/${TRIP}/passengers/export?format=pdf`)
    ).status(),
  ).toBe(400);
  expect((await request.get(`${base}/${OTHER_TRIP}/passengers`)).status()).toBe(
    404,
  );
});
