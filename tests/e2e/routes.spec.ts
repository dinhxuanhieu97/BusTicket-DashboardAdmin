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

test("owner adds pickup points in any order; saving sorts them, flags duplicates and asks before removing (RT5, RT6)", async ({
  page,
  request,
}) => {
  await page.goto("/admin/routes");
  await page.getByRole("button", { name: "Điểm đón/trả tuyến TEST" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Giờ là giờ dự kiến");
  await expect(dialog).toContainText("khi lưu các điểm tự sắp theo giờ");

  const addPickup = dialog.getByRole("button", { name: "+ Thêm điểm đón" });
  const pickupRow = (i: number) =>
    dialog.locator("fieldset").first().locator(".pn-form-grid").nth(i);
  const fill = async (i: number, name: string, time: string) => {
    await pickupRow(i).getByLabel("Tên điểm").fill(name);
    await pickupRow(i).getByLabel("Giờ đón dự kiến").fill(time);
  };
  await addPickup.click();
  await fill(0, "Phù Mỹ", "17:20");
  await addPickup.click();
  await fill(1, "Bưu điện Ân Nghĩa", "16:30");
  await addPickup.click();
  await fill(2, "Hoài Nhơn", "17:00");
  await addPickup.click();
  await fill(3, "  phù  mỹ ", "17:30");
  await dialog.getByRole("button", { name: "+ Thêm điểm trả" }).click();
  const dropoff = dialog.locator("fieldset").nth(1);
  await dropoff.getByLabel("Tên điểm").fill("Bx. An Sương");
  await dropoff.getByLabel("Giờ trả dự kiến").fill("07:30");
  await dropoff.getByLabel("Ngày").fill("1");

  await dialog.getByRole("button", { name: "Lưu điểm đón/trả" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    'Điểm đón "phù mỹ" bị trùng tên',
  );

  // Bỏ điểm có tên phải xác nhận; "Giữ điểm" không bỏ gì.
  await dialog.getByRole("button", { name: "Bỏ điểm phù mỹ" }).click();
  const confirm = dialog.getByRole("group", {
    name: "Xác nhận bỏ điểm phù  mỹ",
  });
  await expect(confirm).toContainText("Bỏ điểm đón “phù  mỹ”?");
  await confirm.getByRole("button", { name: "Giữ điểm" }).click();
  await expect(pickupRow(3).getByLabel("Tên điểm")).toHaveValue("  phù  mỹ ");
  await dialog.getByRole("button", { name: "Bỏ điểm phù mỹ" }).click();
  await confirm.getByRole("button", { name: "Bỏ điểm này" }).click();
  await expect(
    dialog.locator("fieldset").first().locator(".pn-form-grid"),
  ).toHaveCount(3);
  // Dòng mới chưa có tên thì bỏ ngay.
  await addPickup.click();
  await dialog.getByRole("button", { name: "Bỏ điểm mới" }).click();
  await expect(
    dialog.locator("fieldset").first().locator(".pn-form-grid"),
  ).toHaveCount(3);

  await dialog.getByRole("button", { name: "Lưu điểm đón/trả" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Đã lưu điểm đón/trả tuyến TEST" }),
  ).toContainText("Các chuyến chưa khởi hành dùng điểm mới.");
  const routes = page.getByRole("table", { name: "Tuyến", exact: true });
  await expect(routes.locator('[data-route="TEST"]')).toContainText("3 điểm");

  const state = await (
    await request.get("http://127.0.0.1:3101/__test/state")
  ).json();
  const saved = state.requests.filter(
    (r: { method: string; path: string }) =>
      r.method === "PUT" && r.path.endsWith("/stops"),
  );
  expect(saved).toHaveLength(1);
  expect(saved[0].body).toEqual({
    pickup: [
      { name: "Bưu điện Ân Nghĩa", time: "16:30", day: 0 },
      { name: "Hoài Nhơn", time: "17:00", day: 0 },
      { name: "Phù Mỹ", time: "17:20", day: 0 },
    ],
    dropoff: [{ name: "Bx. An Sương", time: "07:30", day: 1 }],
  });

  // Mở lại: hiện theo thứ tự xe chạy.
  await page.getByRole("button", { name: "Điểm đón/trả tuyến TEST" }).click();
  const names = page
    .getByRole("dialog")
    .locator("fieldset")
    .first()
    .getByLabel("Tên điểm");
  for (const [i, name] of [
    "Bưu điện Ân Nghĩa",
    "Hoài Nhơn",
    "Phù Mỹ",
  ].entries())
    await expect(names.nth(i)).toHaveValue(name);
});
