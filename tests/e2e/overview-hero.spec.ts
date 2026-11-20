import { test, expect, type Page } from "@playwright/test";

const fixture = "http://127.0.0.1:3101/__test";
const headers = {
  Origin: "http://127.0.0.1:3102",
  "Content-Type": "application/json",
};

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/reset`);
});

async function ownerLogin(page: Page) {
  const login = await page.request.post("/api/auth/login", {
    headers,
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
  expect(login.status()).toBe(200);
}

test("overview hero shows today's real figures, fill gauge and quick actions", async ({
  page,
}) => {
  await ownerLogin(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin");

  // Fixture: 1 chuyến mở bán 8/24 chỗ trống; 2 khoản thu hôm nay (250.000 + 380.000), cả hai cần đối soát.
  const today = page.getByRole("list", { name: "Tình hình hôm nay" });
  await expect(today.getByRole("listitem")).toHaveText([
    "1 chuyến hôm nay",
    "16/24 chỗ đã bán",
    "Thu hôm nay 630.000 ₫",
    "2 khoản cần đối soát",
  ]);
  await expect(
    page.getByText(/^Chuyến kế tiếp: .*còn 8\/24 chỗ\.$/),
  ).toBeVisible();

  await expect(page.getByTestId("fill-percent")).toHaveText("67%");
  await page.getByRole("button", { name: "7 ngày" }).click();
  await expect(page.getByRole("button", { name: "7 ngày" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("fill-percent")).not.toHaveText("…");

  const due = page.getByRole("region", { name: "Cần đối soát" });
  await expect(due).toContainText("2khoản");
  await due.getByRole("link", { name: "Mở sổ thu" }).click();
  await expect(page).toHaveURL(/\/admin\/payments$/);
  await page.goBack();

  await expect(
    page.getByRole("link", { name: /^Tạo chuyến Chọn tuyến/ }),
  ).toHaveAttribute("href", "/admin/trips?create=1");
  await expect(
    page.getByRole("link", { name: /^Đối soát thanh toán/ }),
  ).toBeVisible();
});

test("on a phone the sparkline never covers the number and actions scroll sideways", async ({
  page,
}) => {
  await ownerLogin(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  const card = page.getByRole("region", { name: "Thu hôm nay" });
  await expect(card).toContainText("630.000");
  const value = (await card.locator("p").nth(1).boundingBox())!;
  const spark = (await card.locator("[data-sparkline]").boundingBox())!;
  expect(spark.y).toBeGreaterThanOrEqual(value.y + value.height);

  const actions = page.getByRole("link", { name: /^Hành khách Danh sách/ });
  const list = actions.locator("xpath=ancestor::ul[1]");
  expect(await list.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    true,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("an empty day shows dashes, not invented percentages", async ({
  page,
}) => {
  await ownerLogin(page);
  await page.route("**/api/live/trips?*", (route) =>
    route.fulfill({
      json: { trips: [], meta: { fetchedAt: new Date().toISOString() } },
    }),
  );
  await page.goto("/admin");
  await expect(page.getByTestId("fill-percent")).toHaveText("—");
  await expect(page.getByText("Chưa có chuyến bán").first()).toBeVisible();
  await expect(page.getByText("Hôm nay chưa có chuyến nào.")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Tình hình hôm nay" }),
  ).not.toContainText("chỗ đã bán");
});

test("staff without payment access see no money figures or payment shortcuts", async ({
  page,
}) => {
  await ownerLogin(page);
  const phone = "0909876543";
  const password = "Test-only-Staff-Password!";
  const created = await page.request.post("/api/staff", {
    headers,
    data: { fullName: "Nguyễn Văn Điều", phone, password, role: "DISPATCHER" },
  });
  expect(created.status()).toBe(201);
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Số điện thoại", { exact: true }).fill(phone);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await expect(page.getByRole("heading", { name: /, Điều$/ })).toBeVisible();
  const today = page.getByRole("list", { name: "Tình hình hôm nay" });
  await expect(today).toContainText("16/24 chỗ đã bán");
  await expect(today).not.toContainText("Thu hôm nay");
  await expect(page.getByRole("region", { name: "Thu hôm nay" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("region", { name: "Cần đối soát" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: /^Đối soát thanh toán/ }),
  ).toHaveCount(0);
});
