import { test, expect } from "@playwright/test";

async function signIn(context: import("@playwright/test").BrowserContext) {
  await context.request.post("/api/auth/login", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
}

test("desktop sidebar collapses to icons, remembers the choice and toggles with [", async ({
  page,
  context,
  request,
}) => {
  await request.post("http://127.0.0.1:3101/__test/reset");
  await signIn(context);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/admin");

  const aside = page.locator("aside.pn-sidebar");
  const tripsLink = aside.getByRole("link", { name: "Chuyến xe" });
  const width = () => aside.evaluate((el) => el.getBoundingClientRect().width);
  const mainPad = () =>
    page
      .locator(".pn-shell")
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));

  await expect(tripsLink).toBeVisible();
  // Thanh bên nổi cách mép 16px: nội dung lùi vào bề rộng thanh + hai khoảng 16px.
  expect(await width()).toBe(260);
  expect(await mainPad()).toBe(292);
  await expect(tripsLink.locator(".pn-sidebar-text")).toBeVisible();

  await page.getByRole("button", { name: "Thu gọn menu" }).click();
  await expect(
    page.getByRole("button", { name: "Mở rộng menu" }),
  ).toBeVisible();
  await expect.poll(width).toBe(84);
  await expect.poll(mainPad).toBe(116);
  // Nhãn ẩn, icon + tên qua title vẫn còn.
  await expect(tripsLink.locator(".pn-sidebar-text")).toBeHidden();
  await expect(tripsLink).toHaveAttribute("title", "Chuyến xe");
  await expect(aside.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("pnticket_sidebar_collapsed"),
    ),
  ).toBe("1");

  // Giữ trạng thái sau khi tải lại, không nháy: <html> đã có data-sidebar ngay khi vẽ.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Mở rộng menu" }),
  ).toBeVisible();
  expect(await width()).toBe(84);
  expect(
    await page.evaluate(() => document.documentElement.dataset.sidebar),
  ).toBe("collapsed");

  // Phím [ mở rộng lại; không tác dụng khi đang gõ trong ô nhập.
  await page.keyboard.press("[");
  await expect(
    page.getByRole("button", { name: "Thu gọn menu" }),
  ).toBeVisible();
  await expect.poll(width).toBe(260);
  await page.goto("/admin/users");
  const search = page
    .getByRole("searchbox")
    .or(page.getByRole("textbox"))
    .first();
  await search.focus();
  await page.keyboard.press("[");
  expect(await width()).toBe(260);

  // Mobile: nút thu gọn ẩn, drawer ☰ vẫn hoạt động, không tràn ngang.
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("button", { name: "Thu gọn menu" })).toBeHidden();
  await page.getByRole("button", { name: "Mở menu" }).click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Chuyến xe" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
