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

test("owner adds a route pair, renames a place, edits stops and deletes an unused route", async ({
  page,
}) => {
  await page.goto("/admin/routes");
  const routes = page.getByRole("table", { name: "Tuyến", exact: true });
  await expect(routes.locator('[data-route="TEST"]')).toBeVisible();

  await page.getByRole("button", { name: "Thêm cặp tuyến" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Điểm đi").fill("Đà Lạt");
  await dialog.getByLabel("Điểm đến").fill("Nha Trang");
  await dialog.getByLabel("Mã chiều đi").fill("dl-nt");
  await expect(dialog.getByLabel("Mã chiều đi")).toHaveValue("DL-NT");
  await dialog.getByLabel("Mã chiều về").fill("NT-DL");
  await dialog.getByRole("button", { name: "Thêm cặp tuyến" }).click();
  await expect(dialog).toBeHidden();
  await expect(routes.locator('[data-route="NT-DL"]')).toContainText(
    "Nha Trang",
  );

  await page.getByRole("button", { name: "Đổi tên điểm Nha Trang" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tên mới").fill("TP. Nha Trang");
  await dialog.getByRole("button", { name: "Lưu tên" }).click();
  await expect(dialog).toBeHidden();
  await expect(routes.locator('[data-route="DL-NT"]')).toContainText(
    "TP. Nha Trang",
  );
  await expect(routes.locator('[data-route="NT-DL"]')).toContainText(
    "TP. Nha Trang",
  );

  await page.getByRole("button", { name: "Điểm đón/trả tuyến DL-NT" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "+ Thêm điểm đón" }).click();
  await dialog.getByLabel("Tên điểm").fill("Bến xe Liên tỉnh Đà Lạt");
  await dialog.getByLabel("Giờ").fill("07:00");
  await dialog.getByRole("button", { name: "Lưu điểm đón/trả" }).click();
  await expect(dialog).toBeHidden();
  await expect(routes.locator('[data-route="DL-NT"]')).toContainText("1 điểm");

  await page.getByRole("button", { name: "Xóa tuyến TEST" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Xóa tuyến" }).click();
  await expect(dialog.getByRole("alert")).toContainText("đã có chuyến");
  await dialog.getByRole("button", { name: "Hủy" }).click();

  await page.getByRole("button", { name: "Xóa tuyến DL-NT" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Xóa tuyến" }).click();
  await expect(dialog).toBeHidden();
  await expect(routes.locator('[data-route="DL-NT"]')).toHaveCount(0);
  await expect(routes.locator('[data-route="NT-DL"]')).toBeVisible();
});

test("settings links to the route page", async ({ page }) => {
  await page.goto("/admin/settings");
  await page.getByRole("link", { name: "Tuyến đường" }).last().click();
  await expect(page).toHaveURL(/\/admin\/routes$/);
});
