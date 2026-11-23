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
  await expect(page.getByLabel("Tháng khởi hành")).toHaveAttribute(
    "data-value",
    "2027-12-01",
  );
  await expect(page.getByLabel("Tháng khởi hành")).toContainText(
    "Tháng 12/2027",
  );
  await page.getByRole("button", { name: "Năm", exact: true }).click();
  await expect(page.getByLabel("Năm khởi hành")).toContainText("Năm 2027");
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
    page.getByRole("heading", { name: "Tuyến đường" }),
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

test("trip period picker opens a popup to pick a day, month or year", async ({
  page,
}) => {
  await page.goto("/admin/trips?date=2027-12-15&period=day");
  const day = page.getByLabel("Ngày khởi hành · Giờ Việt Nam");
  await expect(day).toContainText("15/12/2027");
  await day.click();
  const pop = page.getByRole("dialog", {
    name: "Ngày khởi hành · Giờ Việt Nam",
  });
  await expect(pop).toContainText("Thg 12 2027");
  await expect(pop.locator('[data-date="2027-12-15"]')).toBeFocused();
  // Mũi tên phải chuyển ô focus; sang tháng sau rồi chọn ngày 03/01/2028.
  await page.keyboard.press("ArrowRight");
  await expect(pop.locator('[data-date="2027-12-16"]')).toBeFocused();
  await pop.getByRole("button", { name: "Tháng sau" }).click();
  await pop.locator('[data-date="2028-01-03"]').click();
  await expect(pop).toHaveCount(0);
  await expect(day).toHaveAttribute("data-value", "2028-01-03");
  await expect(day).toBeFocused();
  await expect(page).toHaveURL(/date=2028-01-03/);

  // Escape đóng popup, giữ nguyên ngày.
  await day.click();
  await page.keyboard.press("Escape");
  await expect(pop).toHaveCount(0);
  await expect(day).toHaveAttribute("data-value", "2028-01-03");

  // Tháng: lưới 12 tháng theo năm.
  await page.getByRole("button", { name: "Tháng", exact: true }).click();
  const month = page.getByLabel("Tháng khởi hành");
  await month.click();
  const monthPop = page.getByRole("dialog", { name: "Tháng khởi hành" });
  await expect(monthPop).toContainText("Năm 2028");
  await monthPop.getByRole("button", { name: "Năm trước" }).click();
  await monthPop.getByRole("button", { name: "Tháng 3 năm 2027" }).click();
  await expect(month).toHaveAttribute("data-value", "2027-03-01");
  await expect(month).toContainText("Tháng 3/2027");

  // Năm: lưới 12 năm.
  await page.getByRole("button", { name: "Năm", exact: true }).click();
  const year = page.getByLabel("Năm khởi hành");
  await year.click();
  const yearPop = page.getByRole("dialog", { name: "Năm khởi hành" });
  await expect(yearPop).toContainText("2016 – 2027");
  await yearPop.getByRole("button", { name: "Năm 2025" }).click();
  await expect(year).toContainText("Năm 2025");
});
