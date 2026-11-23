import { test, expect, type BrowserContext, type Page } from "@playwright/test";

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

/** ⌘K bấm trước khi trang hydrate xong thì bị bỏ qua: bấm lại tới khi bảng tìm mở. */
async function openPalette(page: Page) {
  const palette = page.getByRole("dialog", { name: "Tìm nhanh" });
  await expect(async () => {
    if (!(await palette.isVisible()))
      await page.keyboard.press("ControlOrMeta+k");
    await expect(palette).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
  return palette;
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
  const palette = await openPalette(page);
  await expect(palette).toBeVisible();
  const input = palette.getByRole("combobox", { name: /^Tìm trang/ });
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
  await expect(palette.getByText(/Không có kết quả nào khớp/)).toBeVisible();
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
  // Chuông ẩn ở điện thoại để tiêu đề đủ chỗ.
  await expect(page.getByRole("button", { name: /^Thông báo/ })).toBeHidden();
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
  await expect(drawer.getByRole("link", { name: "Cài đặt" })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Nhật ký" })).toHaveCount(0);
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
    page.getByText(
      "Hồ sơ, bảo mật đăng nhập, thông tin chung và email thông báo của nhà xe.",
    ),
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

test("the bell and menu badges show what needs attention (GF2)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/audit-logs");
  // Fixture `counters`: 5 khoản cần đối soát, 1 khoản cần hoàn, 1 chuyến sắp đóng bán.
  const bell = page.getByRole("button", { name: /^Thông báo/ });
  await expect(bell).toHaveAccessibleName("Thông báo: 7 việc mới cần chú ý");
  const nav = page.getByRole("navigation", { name: "Điều hướng quản trị" });
  await expect(nav.getByRole("link", { name: "Sổ thu" })).toHaveAttribute(
    "data-badge",
    "5",
  );
  await expect(nav.getByRole("link", { name: "Chuyến xe" })).toHaveAttribute(
    "data-badge",
    "1",
  );
  await bell.click();
  const panel = page.getByRole("region", { name: "Thông báo" });
  await expect(panel.locator(".pn-notif-text")).toHaveText([
    "5 khoản thu cần đối soát",
    "1 khoản cần hoàn cho khách",
    "1 chuyến đóng bán trong 2 giờ",
  ]);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(bell).toBeFocused();
  await bell.click();
  await panel.getByRole("link", { name: /cần đối soát/ }).click();
  await expect(page).toHaveURL(/\/admin\/payments$/);
});

test("phones list what needs attention in the Thêm drawer (GB7)", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/audit-logs");
  const bar = page.getByRole("navigation", { name: "Điều hướng nhanh" });
  // Fixture `counters`: 5 cần đối soát + 1 cần hoàn + 1 chuyến sắp đóng bán.
  const more = bar.getByRole("button", { name: "Thêm, 7 việc mới cần chú ý" });
  await expect(more).toBeVisible();
  await expect(more.locator(".pn-more-badge")).toHaveText("7");
  await more.click();
  const drawer = page.getByRole("dialog", { name: "Điều hướng" });
  const attention = drawer.getByRole("region", { name: "Cần chú ý" });
  await expect(attention.getByRole("link")).toHaveText([
    "5 khoản thu cần đối soát",
    "1 khoản cần hoàn cho khách",
    "1 chuyến đóng bán trong 2 giờ",
  ]);
  await attention.getByRole("link", { name: /cần hoàn/ }).click();
  await expect(page).toHaveURL(/\/admin\/payments$/);
  await expect(drawer).toHaveCount(0);
  // Mở một việc là việc đó đã đọc: 7 → 6.
  const moreAfter = bar.getByRole("button", {
    name: "Thêm, 6 việc mới cần chú ý",
  });
  await expect(moreAfter.locator(".pn-more-badge")).toHaveText("6");

  // Từ sm đã có chuông ở topbar: ngăn không lặp lại danh sách, nút "Thêm" không có số.
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(moreAfter.locator(".pn-more-badge")).toBeHidden();
  await moreAfter.click();
  await expect(drawer.getByRole("region", { name: "Cần chú ý" })).toBeHidden();
  await page.keyboard.press("Escape");

  // API cũ không có `counters`: không có mục và không có số.
  await request.post("http://127.0.0.1:3101/__test/state", {
    data: { reportsOff: true },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    bar.getByRole("button", { name: "Thêm", exact: true }),
  ).toBeVisible();
  await bar.getByRole("button", { name: "Thêm", exact: true }).click();
  await expect(drawer.getByRole("region", { name: "Cần chú ý" })).toHaveCount(
    0,
  );
});

test("Đánh dấu đã đọc tất cả clears the badges but keeps the list", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/audit-logs");
  const bell = page.getByRole("button", { name: /^Thông báo/ });
  await expect(bell.locator(".pn-bell-badge")).toHaveText("7");
  await bell.click();
  const panel = page.getByRole("region", { name: "Thông báo" });
  await panel.getByRole("button", { name: "Đánh dấu đã đọc tất cả" }).click();
  await expect(bell).toBeFocused();
  await expect(bell).toHaveAccessibleName(
    "Thông báo: đã đọc, còn 7 việc cần chú ý",
  );
  await expect(bell.locator(".pn-bell-badge")).toHaveCount(0);
  // Việc vẫn còn tồn nên danh sách giữ nguyên; chỉ nút đánh dấu biến mất.
  await expect(panel.getByRole("link")).toHaveCount(3);
  await expect(
    panel.getByRole("button", { name: "Đánh dấu đã đọc tất cả" }),
  ).toHaveCount(0);

  // Mốc đã đọc lưu trên máy: tải lại vẫn không có số, điện thoại cũng vậy.
  await page.reload();
  await expect(bell).toHaveAccessibleName(
    "Thông báo: đã đọc, còn 7 việc cần chú ý",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const more = page
    .getByRole("navigation", { name: "Điều hướng nhanh" })
    .getByRole("button", { name: "Thêm", exact: true });
  await expect(more).toBeVisible();
  await expect(more.locator(".pn-more-badge")).toHaveCount(0);
});

test("phones can mark attention as read from the Thêm drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/audit-logs");
  const bar = page.getByRole("navigation", { name: "Điều hướng nhanh" });
  await bar.getByRole("button", { name: "Thêm, 7 việc mới cần chú ý" }).click();
  const attention = page
    .getByRole("dialog", { name: "Điều hướng" })
    .getByRole("region", { name: "Cần chú ý" });
  await attention
    .getByRole("button", { name: "Đánh dấu đã đọc tất cả" })
    .click();
  await expect(attention.getByRole("link")).toHaveCount(3);
  await expect(
    attention.getByRole("button", { name: "Đánh dấu đã đọc tất cả" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(
    bar.getByRole("button", { name: "Thêm", exact: true }),
  ).toBeVisible();
});

test("the bell stays hidden on an API without counters", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:3101/__test/state", {
    data: { reportsOff: true },
  });
  await page.goto("/admin/audit-logs");
  await expect(page).toHaveURL(/\/admin\/settings\?tab=audit$/);
  await expect(
    page.getByRole("heading", { name: "Nhật ký hoạt động", level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Thông báo/ })).toHaveCount(0);
});

test("⌘K finds tickets by code, phone or name and trips by code (GF1)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin");
  const palette = await openPalette(page);
  const input = palette.getByRole("combobox", {
    name: "Tìm trang, vé hoặc chuyến",
  });
  await input.fill("0912 000");
  const ticket = palette.getByRole("option", {
    name: /TESTA1 · Khách Kiểm Thử Một/,
  });
  await expect(ticket).toBeVisible();
  await expect(ticket).toContainText("+84912000001");
  await input.fill("kiểm thử một");
  await expect(ticket).toBeVisible();
  await input.fill("pn050227");
  const trip = palette.getByRole("option", { name: /Chuyến kiểm thử/ });
  await expect(trip).toBeVisible();
  await expect(palette.getByRole("option", { name: /TESTA1/ })).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    /\/admin\/seats\?(.+&)?trip=44444444-4444-4444-8444-444444444444(&|$)/,
  );
});

test("⌘K opens a ticket in place, with a link to the whole trip list (GF1)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin");
  const palette = await openPalette(page);
  await palette.getByRole("combobox").fill("testa1");
  await palette.getByRole("option", { name: /TESTA1/ }).click();
  // Không chuyển trang: chi tiết vé mở ngay trên Tổng quan.
  const ticket = page.getByRole("dialog", { name: "Vé TESTA1" });
  await expect(ticket).toBeVisible();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(ticket).toContainText("Khách Kiểm Thử Một");
  await expect(ticket).toContainText("+84912000001");
  await expect(ticket).toContainText("A1, A2");
  await expect(ticket).toContainText("Đã xác nhận");
  await expect(ticket).toContainText("Trả một phần");

  await ticket.getByRole("button", { name: "Sửa đơn" }).click();
  const edit = page.getByRole("dialog", { name: "Sửa đơn TESTA1" });
  await expect(edit).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(edit).toHaveCount(0);
  await expect(ticket).toBeVisible();

  await ticket.getByRole("link", { name: "Xem cả danh sách chuyến" }).click();
  await expect(page).toHaveURL(
    /\/admin\/passengers\?date=2027-02-05&trip=44444444-4444-4444-8444-444444444444$/,
  );
  await expect(page.getByRole("dialog", { name: "Vé TESTA1" })).toHaveCount(0);
});

test("⌘K ticket view says when the ticket is no longer on its trip (GF1)", async ({
  page,
}) => {
  await page.route("**/api/trip-management/*/passengers?*", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    await route.fulfill({ response: res, json: { ...body, bookings: [] } });
  });
  await page.goto("/admin");
  const palette = await openPalette(page);
  await palette.getByRole("combobox").fill("testa1");
  await palette.getByRole("option", { name: /TESTA1/ }).click();
  const ticket = page.getByRole("dialog", { name: "Vé TESTA1" });
  await expect(ticket).toContainText("Không thấy vé TESTA1");
  await expect(
    ticket.getByRole("link", { name: "Xem cả danh sách chuyến" }),
  ).toBeVisible();
  await expect(ticket.getByRole("button", { name: "Sửa đơn" })).toHaveCount(0);
});

test("⌘K says when the search limit is hit instead of showing no results (GB8)", async ({
  page,
}) => {
  await page.route("**/api/live/search?*", (route) =>
    route.fulfill({
      status: 429,
      json: {
        error: {
          code: "TOO_MANY_ATTEMPTS",
          message: "Tìm kiếm quá nhiều lần.",
        },
      },
    }),
  );
  await page.goto("/admin");
  const palette = await openPalette(page);
  await palette
    .getByRole("combobox", { name: "Tìm trang, vé hoặc chuyến" })
    .fill("0912 345");
  await expect(
    palette.getByText("Bạn tìm quá nhiều lần trong một phút."),
  ).toBeVisible();
  await expect(palette.getByText(/Không có kết quả nào khớp/)).toHaveCount(0);
});

test("pages fade in on navigation and seats grow on hover, unless motion is reduced", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin");
  const enter = page.locator("main#main > .pn-page-enter");
  await expect(enter).toHaveCount(1);
  await expect(enter).toHaveCSS("animation-name", "pn-page-in");

  // Đổi trang bằng thanh bên: template gắn lại, hiệu ứng chạy lại.
  const before = await enter.elementHandle();
  await page
    .getByRole("navigation", { name: "Điều hướng quản trị" })
    .getByRole("link", { name: "Sơ đồ chỗ" })
    .click();
  await expect(page).toHaveURL(/\/admin\/seats/);
  await expect
    .poll(() => enter.evaluate((el, old) => el !== old, before))
    .toBe(true);
  // Hết hiệu ứng thì không còn translate trên lớp bọc.
  await expect(enter).toHaveCSS("translate", "none");

  const seat = page.getByRole("button", { name: "A1 · Còn trống" });
  await expect(seat).toHaveCSS("scale", "none");
  await seat.hover();
  await expect(seat).toHaveCSS("scale", "1.04");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(enter).toHaveCSS("animation-name", "none");
  await seat.hover();
  await expect(seat).toHaveCSS("transition-duration", "0s");
});

test("notification panel groups new and seen items and filters unread", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/audit-logs");
  const bell = page.getByRole("button", { name: /^Thông báo/ });
  await bell.click();
  const panel = page.getByRole("region", { name: "Thông báo" });
  await expect(panel.getByRole("heading", { name: "Thông báo" })).toBeVisible();
  const fresh = panel.getByRole("group", { name: "Mới" });
  await expect(fresh.getByRole("link")).toHaveCount(3);
  await expect(fresh.getByRole("link").first()).toContainText("5 mới · Sổ thu");
  await expect(fresh.locator(".pn-notif-dot")).toHaveCount(3);
  await expect(panel.getByRole("group", { name: "Đã xem" })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /^Chưa đọc/ })).toContainText(
    "7",
  );

  await panel.getByRole("button", { name: "Đánh dấu đã đọc tất cả" }).click();
  const seen = panel.getByRole("group", { name: "Đã xem" });
  await expect(seen.getByRole("link")).toHaveCount(3);
  await expect(seen.getByRole("link").last()).toContainText(
    "Đã xem · Chuyến xe",
  );
  await expect(panel.locator(".pn-notif-dot")).toHaveCount(0);
  await panel.getByRole("button", { name: "Chưa đọc", exact: true }).click();
  await expect(panel).toContainText("Bạn đã xem hết thông báo mới.");
  await panel.getByRole("button", { name: "Tất cả", exact: true }).click();
  await expect(seen.getByRole("link")).toHaveCount(3);
});

test("opening one notification marks only that one read and lowers the count", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/audit-logs");
  const bell = page.getByRole("button", { name: /^Thông báo/ });
  await expect(bell.locator(".pn-bell-badge")).toHaveText("7");
  await bell.click();
  const panel = page.getByRole("region", { name: "Thông báo" });
  await panel.getByRole("link", { name: /cần đối soát/ }).click();
  await expect(page).toHaveURL(/\/admin\/payments$/);
  // 5 khoản cần đối soát đã xem; còn 1 cần hoàn + 1 chuyến sắp đóng bán.
  await expect(bell).toHaveAccessibleName("Thông báo: 2 việc mới cần chú ý");
  await expect(bell.locator(".pn-bell-badge")).toHaveText("2");
  await bell.click();
  await expect(
    panel.getByRole("group", { name: "Mới" }).getByRole("link"),
  ).toHaveCount(2);
  const seen = panel.getByRole("group", { name: "Đã xem" });
  await expect(seen.getByRole("link")).toHaveCount(1);
  await expect(seen).toContainText("5 khoản thu cần đối soát");
  // Giữ sau khi tải lại trang.
  await page.reload();
  await expect(bell.locator(".pn-bell-badge")).toHaveText("2");
});
