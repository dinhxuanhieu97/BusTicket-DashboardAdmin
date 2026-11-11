import { test, expect } from "@playwright/test";

test("PN overview shows real route availability and opens trip detail on desktop and mobile", async ({
  page,
  context,
  request,
}) => {
  await request.post("http://127.0.0.1:3101/__test/reset");
  await context.request.post("/api/auth/login", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Chỗ khả dụng theo tuyến" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Trạng thái chuyến" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole("heading", { name: "Trạng thái chuyến" })
        .evaluate(
          (el) =>
            getComputedStyle(el).color ===
            getComputedStyle(document.body).color,
        ),
    )
    .toBe(true);
  await expect(
    page.getByText("Chuyến kiểm thử", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/pn-overview-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Chi tiết", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("link", { name: "Quản lý chuyến", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/pn-overview-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Quản lý chuyến", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/trips(?:\?|$)/);
});

test("empty day and light theme do not invent business figures", async ({
  page,
  context,
  request,
}) => {
  await request.post("http://127.0.0.1:3101/__test/reset");
  await context.request.post("/api/auth/login", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
  await page.route("**/api/live/trips?*", (route) =>
    route.fulfill({
      json: { trips: [], meta: { fetchedAt: new Date().toISOString() } },
    }),
  );
  await page.goto("/admin");
  await expect(
    page.getByText("Chưa có dữ liệu chuyến để phân tích."),
  ).toBeVisible();
  await expect(
    page.getByText("Không có chuyến trong ngày đã chọn."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Đổi giao diện", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect
    .poll(() =>
      page
        .locator(".card")
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .toBe("rgb(255, 255, 255)");
  await page.screenshot({
    path: "test-results/pn-overview-empty-light.png",
    fullPage: true,
  });
});

test("mobile navigation and trip details return focus after Escape", async ({
  page,
  context,
  request,
}) => {
  await request.post("http://127.0.0.1:3101/__test/reset");
  await context.request.post("/api/auth/login", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Trạng thái chuyến" }),
  ).toBeVisible();
  const menuButton = page.getByRole("button", { name: "Mở menu" });
  await menuButton.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("dialog", { name: "Điều hướng" });
  await expect(menu.getByRole("link", { name: "Tổng quan" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(menu.getByRole("button", { name: "Đóng menu" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(menuButton).toBeFocused();

  const details = page.getByRole("button", { name: "Chi tiết", exact: true });
  const table = page.getByRole("region", { name: "Danh sách chuyến" });
  const initialX = (await details.boundingBox())!.x;
  await table.evaluate((region) => {
    region.scrollLeft = region.scrollWidth;
  });
  expect(await table.evaluate((region) => region.scrollLeft)).toBeGreaterThan(
    0,
  );
  expect((await details.boundingBox())!.x).toBeCloseTo(initialX, 0);
  await details.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Chi tiết chuyến xe" });
  await expect(dialog).toBeVisible();
  const { header, body } = await dialog.evaluate((element) => ({
    header: getComputedStyle(element.children[0]).paddingInlineStart,
    body: getComputedStyle(element.children[1]).paddingInlineStart,
  }));
  expect(header).toBe("16px");
  expect(body).toBe(header);
  await page.keyboard.press("Escape");
  await expect(details).toBeFocused();
});
