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
  for (const input of await dialog.getByLabel(/Giá .*nghìn đồng/).all())
    await input.fill("300");
  await expect(dialog.getByText(/300\.000/).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Xem lại cấu hình" }).click();
  await expect(
    dialog.getByText(/Tầng 1 · 1 người: 300\.000/).first(),
  ).toBeVisible();
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
  for (const input of await page.getByLabel(/Giá .*nghìn đồng/).all())
    await input.fill("300");
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
    page.getByRole("definition").filter({ hasText: /^Chủ nhà xe$/ }),
  ).toBeVisible();
});

test("settings save shows a dismissible toast that clears after five seconds", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/admin/settings?tab=general");
  const name = page.getByRole("textbox", { name: "Tên nhà xe" });
  const save = page.getByRole("button", { name: "Lưu thông tin nhà xe" });
  const toast = page.getByRole("group", { name: "Thông báo lưu thành công" });
  await name.fill("Nhà xe thử thông báo");
  await save.click();
  await expect(toast).toHaveText("Đã lưu thông tin.");
  await expect(toast).toHaveCSS("position", "fixed");
  await expect(toast.locator(".pn-success-toast-progress")).toHaveCSS(
    "animation-duration",
    "5s",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Đã lưu thông tin." }),
  ).toHaveCount(1);
  await toast.getByRole("button", { name: "Đóng thông báo" }).click();
  await expect(toast).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await name.fill("Nhà xe thử thông báo trên mobile");
  await save.click();
  await expect(toast).toBeVisible();
  const box = await toast.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThan(0);
  expect(box!.x + box!.width).toBeLessThan(390);
  await page.clock.fastForward(5000);
  await expect(toast).toHaveCount(0);
  await page.reload();
  await expect(name).toHaveValue("Nhà xe thử thông báo trên mobile");
});
