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

test("owner adds, edits and deletes a vehicle; a used vehicle cannot be deleted", async ({
  page,
}) => {
  await page.goto("/admin/vehicles");
  const table = page.getByRole("table", { name: "Đội xe" });
  await expect(table.getByText("TEST01")).toBeVisible();

  await page.getByRole("button", { name: "Thêm xe" }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Mã xe")).toHaveValue("TEST03");
  await dialog.getByLabel("Tên xe").fill("Xe mới E2E");
  await dialog.getByLabel("Biển số (tùy chọn)").fill("77B-123.45");
  await dialog
    .getByLabel("Sơ đồ chỗ")
    .selectOption({ label: "Sơ đồ kiểm thử · 2 chỗ" });
  await dialog.getByRole("button", { name: "Thêm xe" }).click();
  await expect(dialog).toBeHidden();
  const row = page.locator('[data-vehicle="TEST03"]');
  await expect(row).toContainText("Xe mới E2E");
  await expect(row).toContainText("77B-123.45");

  await page.getByRole("button", { name: "Sửa xe TEST03" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Mã xe")).toBeDisabled();
  await dialog.getByLabel("Tên xe").fill("Xe đổi tên");
  await dialog.getByLabel("Trạng thái").selectOption("MAINTENANCE");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("Xe đổi tên");
  await expect(row).toContainText("Bảo trì");

  await page.getByRole("button", { name: "Xóa xe TEST01" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Xóa xe" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Xe đã có chuyến hoặc lịch chạy",
  );
  await dialog.getByRole("button", { name: "Hủy" }).click();
  await expect(table.getByText("TEST01")).toBeVisible();

  await page.getByRole("button", { name: "Xóa xe TEST03" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Xóa xe" }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toHaveCount(0);
});

test("fleet menu is reachable and settings links to it", async ({ page }) => {
  await page.goto("/admin/settings");
  await page.getByRole("link", { name: "Đội xe" }).first().click();
  await expect(page).toHaveURL(/\/admin\/vehicles$/);
});
