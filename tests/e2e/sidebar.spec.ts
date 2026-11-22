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
  // Nhãn ẩn; rê chuột hoặc focus vào icon thì tên hiện nổi bên phải (không dùng title).
  await expect(tripsLink.locator(".pn-sidebar-text")).toBeHidden();
  await expect(tripsLink).not.toHaveAttribute("title");
  const tip = page.getByRole("tooltip");
  await tripsLink.hover();
  await expect(tip).toHaveText("Chuyến xe");
  const linkBox = (await tripsLink.boundingBox())!;
  const tipBox = (await tip.boundingBox())!;
  expect(tipBox.x).toBeGreaterThan(linkBox.x + linkBox.width);
  expect(
    Math.abs(tipBox.y + tipBox.height / 2 - (linkBox.y + linkBox.height / 2)),
  ).toBeLessThan(2);
  await page.keyboard.press("Escape");
  await expect(tip).toHaveCount(0);
  await aside.getByRole("button", { name: "Đăng xuất" }).focus();
  await expect(tip).toHaveText("Đăng xuất");
  await page.mouse.move(800, 400);
  await aside.getByRole("button", { name: "Đăng xuất" }).blur();
  await expect(tip).toHaveCount(0);
  // Nút mở rộng có nhãn nổi kèm phím tắt, mũi tên xoay theo trạng thái.
  const toggle = page.getByRole("button", { name: "Mở rộng menu" });
  await toggle.hover();
  await expect(tip).toHaveText(/Mở rộng menu\s+\[/);
  await expect(toggle.locator("svg")).toHaveCSS("rotate", "180deg");
  await page.mouse.move(800, 400);
  await expect(tip).toHaveCount(0);
  // Avatar tài khoản nằm giữa thanh bên thu gọn, thẳng hàng với icon menu.
  const avatar = (await aside.locator(".pn-avatar").boundingBox())!;
  expect(
    Math.abs(avatar.x + avatar.width / 2 - (linkBox.x + linkBox.width / 2)),
  ).toBeLessThan(2);
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
