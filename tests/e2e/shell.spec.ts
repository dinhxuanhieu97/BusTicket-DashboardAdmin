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
  for (const label of await bar.locator("span").all())
    expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
  // Tiêu đề trang không bị cắt ở điện thoại.
  const title = page.getByRole("heading", { level: 1 });
  expect(await title.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await expect(page.getByRole("img", { name: /Test OWNER/ })).toBeHidden();
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
