import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, request }) => {
  await request.post("http://127.0.0.1:3101/__test/reset");
  await context.request.post("/api/auth/login", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
});

test("date range persists across reload and the default creation flow is both directions", async ({
  page,
}) => {
  await page.goto("/admin/trips?date=2027-12-01&period=day");
  await page.getByRole("button", { name: "Tháng", exact: true }).click();
  await expect(page.getByLabel("Tháng khởi hành")).toHaveValue("2027-12");
  await page.getByRole("button", { name: "Năm", exact: true }).click();
  await expect(page.getByLabel("Năm khởi hành")).toHaveValue("2027");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Năm", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Ngày", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Thêm chuyến", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Cả hai chiều", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Giờ xuất bến")).toHaveValue("17:30");
  for (const input of await dialog.getByLabel(/Giá .*VND/).all())
    await input.fill("300000");
  await dialog.getByRole("button", { name: "Xem lại cấu hình" }).click();
  await expect(
    dialog.getByText("Chuyến TP. Hồ Chí Minh → Đà Lạt", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Chuyến Đà Lạt → TP. Hồ Chí Minh", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Xác nhận tạo hai chuyến" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã lưu hai chuyến nháp." }),
  ).toBeVisible();
});

test("owner saves a disabled schedule, previews it, activates it and skips a day", async ({
  page,
}) => {
  await page.goto("/admin/schedules");
  await page
    .getByRole("button", { name: "+ Thiết lập lịch", exact: true })
    .click();
  const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Ngày bắt đầu phân xe").fill(date);
  for (const input of await page.getByLabel(/Giá .*VND/).all())
    await input.fill("300000");
  await page.getByRole("button", { name: "Xem lại cấu hình" }).click();
  await page.getByRole("button", { name: "Lưu lịch chưa bật" }).click();
  await expect(page.getByText(/Đang tắt/)).toBeVisible();
  await page.getByRole("button", { name: "Xem trước", exact: true }).click();
  await page.getByRole("button", { name: "Bật tự động tạo và mở bán" }).click();
  await expect(page.getByText(/Lượt này tạo 60 chuyến/)).toBeVisible();
  await page.getByLabel("Ngày", { exact: true }).fill(date);
  await page.getByLabel("Ngừng chạy ngày này").check();
  await page.getByLabel(/đã bố trí xe về đúng đầu tuyến/).check();
  await page.getByRole("button", { name: "Lưu ngoại lệ" }).click();
  await expect(
    page.getByRole("cell", { name: "Ngừng chạy", exact: true }),
  ).toBeVisible();
});

test("general information is inside Settings and its previous URL redirects", async ({
  page,
}) => {
  await page.goto("/admin/general");
  await expect(page).toHaveURL(/\/admin\/settings\?tab=general$/);
  const settings = page.getByRole("navigation", { name: "Mục cài đặt" });
  await expect(
    settings.getByRole("link", { name: "Thông tin chung" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "Tuyến hai chiều" }),
  ).toBeVisible();
  await settings.getByRole("link", { name: "Tài khoản", exact: true }).click();
  await expect(
    page.getByText("OWNER · Chủ nhà xe", { exact: true }),
  ).toBeVisible();
});
