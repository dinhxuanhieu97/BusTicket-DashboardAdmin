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
  await page.goto("/admin/trips?date=2027-02-05");
  await page
    .getByRole("button", { name: "Chi tiết", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Hành khách" }).click();
  return dialog.getByRole("region", { name: "Hành khách", exact: true });
}

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
  await expect(section).toContainText("2 đơn đã xác nhận · 4 khách · 3 chỗ");
  await expect(section).toContainText("1 đơn đang giữ · 1 chỗ");

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
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Thông tin chuyến" }),
  ).toBeVisible();
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

  // Người không có quyền: không thấy nút Hành khách, gọi thẳng route bị chặn.
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
  await page
    .getByRole("button", { name: "Chi tiết", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Hành khách" }),
  ).toHaveCount(0);
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
