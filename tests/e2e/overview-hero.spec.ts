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

  // Fixture: 1 chuyến mở bán 8/24 chỗ trống. API báo cáo: hôm nay nhận 630.000, hoàn 100.000;
  // `counters` có 5 khoản cần đối soát (cả sổ thu, không chỉ 200 khoản gần nhất).
  const today = page.getByRole("list", { name: "Tình hình hôm nay" });
  await expect(today.getByRole("listitem")).toHaveText([
    "1 chuyến hôm nay",
    "16/24 chỗ đã bán",
    "Thu thuần hôm nay 530.000 ₫",
    "5 khoản cần đối soát",
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
  await expect(due).toContainText("5khoản");
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
  const card = page.getByRole("region", { name: "Thu thuần hôm nay" });
  await expect(card).toContainText("530.000");
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
  await expect(today).not.toContainText("Thu thuần");
  await expect(page.getByRole("region", { name: /^Thu/ })).toHaveCount(0);
  // Điều hành có `booking.read`: thấy vé bán và tỷ lệ hủy, không thấy tiền.
  await expect(
    page.getByRole("region", { name: "Vé bán hôm nay" }),
  ).toContainText("6vé");
  await expect(page.getByRole("region", { name: "Cần đối soát" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: /^Đối soát thanh toán/ }),
  ).toHaveCount(0);
});

test("overview compares tickets with yesterday and shows the 7-day cancel rate (GF7)", async ({
  page,
}) => {
  await ownerLogin(page);
  await page.goto("/admin");
  // Fixture `reports/bookings`: hôm nay 6 chỗ, hôm qua 4 chỗ; 7 ngày 6 đơn, 1 đơn bị hủy.
  const sold = page.getByRole("region", { name: "Vé bán hôm nay" });
  await expect(sold).toContainText("6vé");
  await expect(page.getByTestId("sales-vs-yesterday")).toHaveText(
    "↑ 50% so với hôm qua (4)",
  );
  const cancel = page.getByRole("region", { name: "Tỷ lệ hủy 7 ngày" });
  await expect(cancel).toContainText("16,7%");
  await expect(cancel).toContainText("1/6 đơn tạo trong 7 ngày bị hủy");
  await expect(
    page.getByRole("region", { name: "Thu thuần 7 ngày" }),
  ).toContainText("730.000");
});

test("overview falls back to the payment list on an API without reports", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/state`, { data: { reportsOff: true } });
  await ownerLogin(page);
  await page.goto("/admin");
  const today = page.getByRole("list", { name: "Tình hình hôm nay" });
  await expect(today).toContainText("Thu hôm nay 630.000 ₫");
  await expect(today).toContainText("2 khoản cần đối soát");
  await expect(page.getByRole("region", { name: "Thu 7 ngày" })).toContainText(
    "630.000",
  );
  // API báo cáo đơn cũng chưa có: không bịa thẻ vé/tỷ lệ hủy, không hiện lỗi đỏ.
  await expect(
    page.getByRole("region", { name: "Tỷ lệ hủy 7 ngày" }),
  ).toHaveCount(0);
  await expect(page.getByText("Cannot GET")).toHaveCount(0);
});
