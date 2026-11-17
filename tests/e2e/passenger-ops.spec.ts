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
const PROOF = "A".repeat(43);
const qr = (code: string, proof = PROOF) =>
  `https://api.example.vn/api/v1/tickets/${code}/verify?proof=${proof}`;

test.beforeEach(async ({ request, page }) => {
  await request.post(`${fixture}/reset`);
  for (const client of [request, page.request]) {
    const login = await client.post("/api/auth/login", {
      headers,
      data: {
        phone: "0900000001",
        password: "Test-only-Password!",
        otp: "123456",
      },
    });
    expect(login.status()).toBe(200);
  }
});

async function passengers(page: Page) {
  // Danh sách khách ở trang riêng (/admin/passengers), không còn là tab trong modal chuyến.
  await page.goto(`/admin/passengers?date=2027-02-05&trip=${TRIP}`);
  return page.locator("main");
}

test("staff boards a booking, cannot cancel it while boarded, cancels it after undo and the accountant settles the refund", async ({
  page,
}) => {
  const dialog = await passengers(page);
  const row = dialog.locator('tr[data-booking="TESTA1"]');
  await row
    .getByRole("button", { name: "Đánh dấu đơn TESTA1 đã lên xe" })
    .click();
  const undo = row.getByRole("button", {
    name: "Bỏ đánh dấu lên xe đơn TESTA1",
  });
  await expect(undo).toHaveText(/2\/2 lên xe/);
  await expect(undo).toHaveAttribute("aria-pressed", "true");
  await expect(dialog).toContainText("Đã lên xe: 2/3 chỗ");

  await row.getByRole("button", { name: "Hủy đơn TESTA1" }).click();
  let cancel = page.getByRole("dialog", { name: "Hủy đơn TESTA1" });
  await expect(cancel).toContainText("Khách đã được đánh dấu lên xe");
  await expect(
    cancel.getByRole("button", { name: "Hủy đơn", exact: true }),
  ).toBeDisabled();
  await cancel.getByRole("button", { name: "Giữ đơn" }).click();

  await undo.click();
  await expect(
    row.getByRole("button", { name: "Đánh dấu đơn TESTA1 đã lên xe" }),
  ).toHaveText(/0\/2 lên xe/);
  await row.getByRole("button", { name: "Hủy đơn TESTA1" }).click();
  cancel = page.getByRole("dialog", { name: "Hủy đơn TESTA1" });
  await expect(cancel).toContainText("Hủy sẽ tạo khoản cần hoàn");
  await cancel.getByRole("button", { name: "Hủy đơn", exact: true }).click();
  await expect(cancel).toContainText("ít nhất 3 ký tự");
  await cancel.getByLabel("Lý do hủy").fill("Khách báo bận đột xuất");
  await cancel.getByRole("button", { name: "Hủy đơn", exact: true }).click();
  await expect(dialog.locator("[data-message]")).toContainText(
    "Đã hủy đơn TESTA1. Tạo khoản cần hoàn",
  );
  await expect(dialog.locator('tr[data-booking="TESTA1"]')).toHaveCount(0);

  await page.goto("/admin/payments");
  const refunds = page.getByRole("region", {
    name: "Khoản cần hoàn",
    exact: true,
  });
  const item = refunds.locator('tr[data-refund="TESTA1"]');
  await expect(item).toContainText("Khách báo bận đột xuất");
  await expect(refunds).toContainText("1 khoản chờ hoàn");
  await item
    .getByRole("button", { name: "Đánh dấu đã hoàn đơn TESTA1" })
    .click();
  await expect(refunds.locator("[data-message]")).toContainText(
    "Đơn TESTA1: đã ghi đã hoàn.",
  );
  await expect(item).toHaveCount(0);
  await refunds.getByLabel("Hiện cả khoản đã xử lý").check();
  await expect(item).toContainText("Đã hoàn");
});

test("re-importing the exported file marks boarding and records the cash collected on board", async ({
  page,
  request,
}) => {
  const exported = await request.get(
    `/api/trip-management/${TRIP}/passengers/export?format=xlsx`,
  );
  expect(exported.status()).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await exported.body()) as unknown as ArrayBuffer);
  const sheet = wb.getWorksheet("DanhSachKhach")!;
  // Phụ xe ghi "x" cho cả hai chỗ của TESTA1 và thu 200.000 trên xe (dòng đầu của đơn).
  sheet.eachRow((r, n) => {
    if (n > 1 && r.getCell(2).value === "TESTA1") {
      r.getCell(16).value = "x";
      if (r.getCell(3).value === "A1") r.getCell(17).value = 200000;
    }
  });
  const file = Buffer.from(await wb.xlsx.writeBuffer());

  const dialog = await passengers(page);
  await dialog.getByRole("button", { name: "Nhập danh sách" }).click();
  const panel = dialog.getByRole("region", {
    name: "Nhập file danh sách khách",
  });
  await panel
    .getByLabel("Tệp Excel (.xlsx, tối đa 2 MB)")
    .setInputFiles({ name: "chuyen.xlsx", mimeType: XLSX, buffer: file });
  await panel.getByRole("button", { name: "Kiểm tra file" }).click();
  await expect(panel).toContainText("1 đơn cập nhật · 2 chỗ lên xe");
  await expect(panel).toContainText("Thu trên xe thêm 200.000");
  await expect(
    panel.getByRole("region", { name: "Đơn sẽ cập nhật" }),
  ).toContainText("TESTA1");
  await panel.getByRole("button", { name: "Ghi 1 cập nhật" }).click();
  await expect(panel).toContainText(
    "Đã cập nhật 1 đơn: 2 chỗ lên xe, thu trên xe 200.000",
  );
  const row = dialog.locator('tr[data-booking="TESTA1"]');
  await expect(row).toContainText("Thu trên xe 200.000");
  await expect(row).toContainText("2/2 lên xe");

  // Xuất lại sau khi cập nhật rồi nhập lại: không còn gì để ghi.
  const again = await request.get(
    `/api/trip-management/${TRIP}/passengers/export?format=xlsx`,
  );
  const preview = await request.post(
    `/api/trip-management/${TRIP}/passengers/import`,
    {
      headers: { Origin: origin, "Content-Type": XLSX },
      data: await again.body(),
    },
  );
  expect(preview.status()).toBe(200);
  expect((await preview.json()).boarding.totals).toEqual({
    bookings: 0,
    boardSeats: 0,
    collectAmount: 0,
  });
});

test("an assigned assistant boards passengers by scanning or typing the ticket", async ({
  request,
  browser,
  baseURL,
}) => {
  const created = await request.post("/api/staff", {
    headers,
    data: {
      fullName: "Phụ xe 77",
      phone: "0909876577",
      password: staffPassword,
      role: "ASSISTANT",
    },
  });
  expect(created.status()).toBe(201);
  const assistantId = (await created.json()).id as string;
  expect(
    (
      await request.put(`/api/trip-management/${TRIP}/assistants`, {
        headers,
        data: { userIds: [assistantId] },
      })
    ).status(),
  ).toBe(200);

  const ctx = await browser.newContext({ baseURL });
  const login = await ctx.request.post("/api/auth/login", {
    headers,
    data: { phone: "0909876577", password: staffPassword },
  });
  expect(login.status()).toBe(200);
  const page = await ctx.newPage();
  await page.goto("/admin/assigned-trips");
  const scan = page.getByLabel("Quét vé hoặc nhập mã vé");
  await scan.fill(qr("TESTA1"));
  await page.getByRole("button", { name: "Lên xe", exact: true }).click();
  await expect(page.locator("[data-message]")).toContainText(
    "TESTA1 · Khách Kiểm Thử Một: chỗ A1, A2 đã lên xe. Còn thu",
  );
  await expect(scan).toHaveValue("");
  await expect(
    page.locator('tr[data-booking="TESTA1"]').getByRole("button", {
      name: "Bỏ đánh dấu lên xe đơn TESTA1",
    }),
  ).toBeVisible();

  await scan.fill(qr("TESTB1", "bad" + "A".repeat(40)));
  await page.getByRole("button", { name: "Lên xe", exact: true }).click();
  await expect(page.locator("[data-message]")).toContainText(
    "Vé không hợp lệ hoặc đã được cấp lại.",
  );
  await scan.fill("ZZZZ9");
  await page.getByRole("button", { name: "Lên xe", exact: true }).click();
  await expect(page.locator("[data-message]")).toContainText(
    "Vé ZZZZ9 không thuộc chuyến này.",
  );
  await scan.fill("PN-12");
  await page.getByRole("button", { name: "Lên xe", exact: true }).click();
  await expect(page.locator("[data-message]")).toContainText("Mã không hợp lệ");

  await page
    .locator('tr[data-booking="TESTB1"]')
    .getByRole("button", { name: "Đánh dấu đơn TESTB1 đã lên xe" })
    .click();
  await expect(page.locator("[data-message]")).toContainText(
    "TESTB1 · Khách Kiểm Thử Hai: chỗ B1 đã lên xe.",
  );
  await expect(page.getByLabel("Tóm tắt")).toContainText("Đã lên xe: 3/3 chỗ");

  // Phụ xe không dùng được route văn phòng; chuyến không được giao trả 404.
  expect(
    (
      await ctx.request.post(`/api/trip-management/${TRIP}/boarding`, {
        headers,
        data: { bookingCode: "TESTA1" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await ctx.request.post(`/api/assigned-trips/${OTHER_TRIP}/boarding`, {
        headers,
        data: { bookingCode: "TESTA1" },
      })
    ).status(),
  ).toBe(404);
  await ctx.close();
});

test("guards the cancel, boarding and refund routes", async ({
  request,
  browser,
  baseURL,
}) => {
  // Thiếu Origin, thân không hợp lệ, mã vé sai dạng.
  expect(
    (
      await request.post(`/api/bookings/TESTH1/cancel`, {
        headers: { "Content-Type": "application/json" },
        data: { reason: "Thử bảo vệ" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(`/api/bookings/TESTH1/cancel`, {
        headers,
        data: { reason: "ok", extra: 1 },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post(`/api/bookings/BAD-CODE/cancel`, {
        headers,
        data: { reason: "Thử bảo vệ" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post(`/api/trip-management/${TRIP}/boarding`, {
        headers,
        data: { bookingCode: "TESTA1", qr: qr("TESTA1") },
      })
    ).status(),
  ).toBe(400);
  const hold = await request.post(`/api/trip-management/${TRIP}/boarding`, {
    headers,
    data: { bookingCode: "TESTH1" },
  });
  expect(hold.status()).toBe(409);
  expect((await hold.json()).error.message).toContain("chưa được xác nhận");
  // Đơn chưa thu tiền: hủy không tạo khoản hoàn; gửi lại báo đã hủy.
  const cancelled = await request.post(`/api/bookings/TESTH1/cancel`, {
    headers,
    data: { reason: "Không liên lạc được" },
  });
  expect(cancelled.status()).toBe(200);
  expect(await cancelled.json()).toMatchObject({
    refund: null,
    alreadyCancelled: false,
  });
  expect(
    (
      await (
        await request.post(`/api/bookings/TESTH1/cancel`, {
          headers,
          data: { reason: "Gửi lại" },
        })
      ).json()
    ).alreadyCancelled,
  ).toBe(true);

  // SELLER đánh dấu lên xe được nhưng không hủy đơn, không xử lý khoản hoàn.
  const created = await request.post("/api/staff", {
    headers,
    data: {
      fullName: "NV SELLER",
      phone: "0909876612",
      password: staffPassword,
      role: "SELLER",
    },
  });
  expect(created.status()).toBe(201);
  const ctx = await browser.newContext({ baseURL });
  expect(
    (
      await ctx.request.post("/api/auth/login", {
        headers,
        data: { phone: "0909876612", password: staffPassword },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await ctx.request.post(`/api/trip-management/${TRIP}/boarding`, {
        headers,
        data: { bookingCode: "TESTA1" },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await ctx.request.post(`/api/bookings/TESTA1/cancel`, {
        headers,
        data: { reason: "Không có quyền" },
      })
    ).status(),
  ).toBe(403);
  expect((await ctx.request.get(`/api/refunds`)).status()).toBe(200);
  expect(
    (
      await ctx.request.post(
        `/api/refunds/00000000-0000-4000-8000-000000000000/resolve`,
        { headers, data: { status: "REFUNDED" } },
      )
    ).status(),
  ).toBe(403);
  const page = await ctx.newPage();
  const dialog = await passengers(page);
  await expect(
    dialog.getByRole("button", { name: "Đánh dấu đơn TESTE1 đã lên xe" }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Hủy đơn / })).toHaveCount(
    0,
  );
  await ctx.close();
});
