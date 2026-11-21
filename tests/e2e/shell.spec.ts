import { test, expect, type BrowserContext } from "@playwright/test";

async function signIn(context: BrowserContext) {
  await context.request.post("/api/auth/login", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
}

test.beforeEach(async ({ context, request }) => {
  await request.post("http://127.0.0.1:3101/__test/reset");
  await signIn(context);
});

test("sidebar groups pages by job and ⌘K jumps to a page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Điều hướng quản trị" });
  for (const group of ["Vận hành", "Tài chính", "Quản lý"])
    await expect(nav.getByText(group, { exact: true })).toBeVisible();
  // Thanh dưới chỉ dành cho điện thoại.
  await expect(
    page.getByRole("navigation", { name: "Điều hướng nhanh" }),
  ).toBeHidden();

  const opener = page.getByRole("button", { name: "Tìm nhanh" }).first();
  await opener.focus();
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Tìm nhanh" });
  await expect(palette).toBeVisible();
  const input = palette.getByRole("combobox", { name: "Tìm trang" });
  await expect(input).toBeFocused();
  // Gõ không dấu vẫn tìm được.
  await input.fill("so thu");
  await expect(palette.getByRole("option")).toHaveCount(1);
  await expect(palette.getByRole("option", { name: /Sổ thu/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/payments$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sổ thu");
  await expect(palette).toHaveCount(0);

  // Không khớp: báo rõ, Enter không chuyển trang; Escape đóng và trả focus.
  await opener.click();
  await palette.getByRole("combobox").fill("không có trang này");
  await expect(palette.getByText(/Không có trang nào khớp/)).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/payments$/);
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("Tạo chuyến in the top bar opens the new-trip form on the trip page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/users");
  await page.getByRole("link", { name: "Tạo chuyến" }).click();
  await expect(
    page.getByRole("dialog", { name: "Thêm chuyến xe" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/trips\?/);
  // Tham số chỉ dùng một lần: tải lại không mở form lần nữa.
  expect(new URL(page.url()).searchParams.has("create")).toBe(false);
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "Thêm chuyến xe" }),
  ).toHaveCount(0);
});

test("phones get a bottom bar that never covers the page and a Thêm drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  const bar = page.getByRole("navigation", { name: "Điều hướng nhanh" });
  // Nhãn ngắn để vừa 390px; tên truy cập vẫn là tên trang đầy đủ.
  await expect(bar.getByRole("link")).toHaveText([
    "Tổng quan",
    "Chuyến",
    "Khách",
    "Sổ thu",
  ]);
  await expect(
    bar.getByRole("link", { name: "Hành khách", exact: true }),
  ).toBeVisible();
  // Nhãn không bị cắt ở 320px, và ở 390px còn dư ít nhất 4px trong ô: font
  // trên Linux (CI) rộng hơn macOS một chút nên "vừa khít" là chưa đủ.
  for (const [width, slack] of [
    [320, 0],
    [390, 4],
  ]) {
    await page.setViewportSize({ width, height: 844 });
    for (const label of await bar.locator("span").all())
      expect(
        await label.evaluate((el) => {
          const box = el.parentElement!;
          const pad = parseFloat(getComputedStyle(box).paddingLeft) * 2;
          return box.clientWidth - pad - el.scrollWidth;
        }),
        `nhãn ở ${width}px`,
      ).toBeGreaterThanOrEqual(slack);
  }
  // Tiêu đề trang không bị cắt ở điện thoại.
  const title = page.getByRole("heading", { level: 1 });
  expect(await title.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  // Điện thoại: avatar mở menu tài khoản; nút đổi giao diện chuyển vào menu (GF20).
  await expect(
    page.getByRole("button", { name: "Đổi giao diện", exact: true }),
  ).toBeHidden();
  const avatar = page.getByRole("button", { name: /^Tài khoản: Test OWNER/ });
  await avatar.click();
  const menu = page.getByRole("menu", { name: "Tài khoản" });
  // Đo sau hiệu ứng mở (scale 0.96 → 1), nếu không chiều cao bị nhỏ đi 4%.
  await menu.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished)),
  );
  const box = (await menu.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  for (const item of await menu.locator("[role^=menuitem]").all())
    expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(bar.getByRole("link", { name: "Tổng quan" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  for (const target of await bar.locator("a, button").all()) {
    const box = (await target.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  await bar.getByRole("link", { name: "Chuyến xe" }).click();
  await expect(page).toHaveURL(/\/admin\/trips/);
  await expect(bar.getByRole("link", { name: "Chuyến xe" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // Cuối trang: chân trang nằm trên thanh dưới, không bị che.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const footer = (await page.locator("main footer").boundingBox())!;
  const barBox = (await bar.boundingBox())!;
  expect(footer.y + footer.height).toBeLessThanOrEqual(barBox.y);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  await bar.getByRole("button", { name: "Thêm" }).click();
  const drawer = page.getByRole("dialog", { name: "Điều hướng" });
  await expect(drawer.getByRole("link", { name: "Nhật ký" })).toBeVisible();
  await expect(bar).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(bar).toBeVisible();
});

test("the chosen theme survives a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 860 });
  await page.goto("/admin");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Đổi giao diện", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByRole("button", { name: "Đổi giao diện", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("the avatar opens an account menu that works by mouse and keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin");
  const avatar = page.getByRole("button", { name: /^Tài khoản: Test OWNER/ });
  await expect(avatar).toHaveAttribute("aria-haspopup", "menu");
  await expect(avatar).toHaveAttribute("aria-expanded", "false");

  await avatar.click();
  const menu = page.getByRole("menu", { name: "Tài khoản" });
  await expect(menu).toBeVisible();
  await expect(avatar).toHaveAttribute("aria-expanded", "true");
  await expect(menu).toContainText("Test OWNER");
  await expect(menu).toContainText("Chủ nhà xe");
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Thông tin tài khoản",
    "Đổi mật khẩu",
    "Trợ giúp & phím tắt",
    "Đăng xuất",
  ]);
  // Mở bằng chuột cũng đưa focus vào mục đầu để dùng phím mũi tên ngay.
  await expect(
    menu.getByRole("menuitem", { name: "Thông tin tài khoản" }),
  ).toBeFocused();
  // Menu nằm dưới avatar, căn phải, không tràn khỏi màn hình.
  const a = (await avatar.boundingBox())!;
  const m = (await menu.boundingBox())!;
  expect(m.y).toBeGreaterThan(a.y + a.height);
  expect(m.x + m.width).toBeLessThanOrEqual(1440);
  expect(Math.abs(m.x + m.width - (a.x + a.width))).toBeLessThan(2);

  // Bấm ra ngoài thì đóng.
  await page.mouse.click(700, 500);
  await expect(menu).toHaveCount(0);

  // Bàn phím: ↓ mở ở mục đầu, ↑ vòng về mục cuối, End/Home, Esc trả focus.
  await avatar.focus();
  await page.keyboard.press("ArrowDown");
  const theme = menu.getByRole("menuitemcheckbox", { name: "Giao diện tối" });
  await expect(
    menu.getByRole("menuitem", { name: "Thông tin tài khoản" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(menu.getByRole("menuitem", { name: "Đăng xuất" })).toBeFocused();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(theme).toBeFocused();
  await expect(theme).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(theme).toHaveAttribute("aria-checked", "false");
  // Nút đổi giao diện trên topbar cũng cập nhật theo.
  await expect(
    page.getByRole("button", { name: "Đổi giao diện", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(avatar).toBeFocused();

  // "Đổi mật khẩu" mở trang Cài đặt ở đúng mục.
  await avatar.click();
  await menu.getByRole("menuitem", { name: "Đổi mật khẩu" }).click();
  await expect(page).toHaveURL(/\/admin\/settings#change-password$/);
  await expect(
    page.getByRole("heading", { name: "Đổi mật khẩu" }),
  ).toBeInViewport();
  await expect(menu).toHaveCount(0);
  await expect(
    page.getByText("Hồ sơ, bảo mật đăng nhập và thông tin chung của nhà xe."),
  ).toBeVisible();

  // Đăng xuất từ menu đưa về trang đăng nhập.
  await avatar.click();
  await menu.getByRole("menuitem", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("scrolling down hides the top bar and bottom nav, scrolling up shows them", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/payments");
  await expect(
    page.getByRole("heading", { name: "Sổ thu tài chính", level: 2 }),
  ).toBeVisible();
  // Trang thử ít dữ liệu: kéo dài trang để cuộn được.
  await page.evaluate(() => (document.body.style.minHeight = "4000px"));
  const topbar = page.locator("header.pn-topbar");
  const nav = page.getByRole("navigation", { name: "Điều hướng nhanh" });
  await expect(nav).not.toHaveAttribute("data-hidden");

  await page.mouse.wheel(0, 600);
  await expect(nav).toHaveAttribute("data-hidden", "true");
  await expect(topbar).toHaveAttribute("data-hidden", "true");
  await expect
    .poll(async () => (await nav.boundingBox())?.y ?? 0)
    .toBeGreaterThanOrEqual(844);

  await page.mouse.wheel(0, -200);
  await expect(nav).not.toHaveAttribute("data-hidden");
  await expect(topbar).not.toHaveAttribute("data-hidden");
  await expect
    .poll(async () => (await nav.boundingBox())?.y ?? 9999)
    .toBeLessThan(844);

  // Đang ẩn mà dùng bàn phím vào thanh thì hiện lại.
  await page.mouse.wheel(0, 600);
  await expect(nav).toHaveAttribute("data-hidden", "true");
  await nav.getByRole("link").first().focus();
  await expect(nav).not.toHaveAttribute("data-hidden");
  // Chạm cuối trang: hiện lại để chuyển trang tiếp.
  await page.mouse.wheel(0, 300);
  await expect(nav).toHaveAttribute("data-hidden", "true");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(nav).not.toHaveAttribute("data-hidden");
});
