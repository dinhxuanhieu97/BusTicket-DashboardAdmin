import { test, expect, type Page } from "@playwright/test";

const fixture = "http://127.0.0.1:3101/__test";
const headers = {
  Origin: "http://127.0.0.1:3102",
  "Content-Type": "application/json",
};

test.beforeEach(async ({ context, request }) => {
  await request.post(`${fixture}/reset`);
  await context.request.post("/api/auth/login", {
    headers,
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
});

async function signInAs(page: Page, role: string) {
  const phone = "0909876543";
  const password = "Test-only-Staff-Password!";
  const created = await page.request.post("/api/staff", {
    headers,
    data: { fullName: "Nhân viên trang mới", phone, password, role },
  });
  expect(created.status()).toBe(201);
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Số điện thoại", { exact: true }).fill(phone);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/admin(\/assigned-trips)?$/);
}

async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
}

test("revenue shows net income, refunds and routes from the report API (GF8, GF16, GF17)", async ({
  page,
}) => {
  await page.goto("/admin/revenue");
  // Fixture `reports/revenue`: hôm nay nhận 630.000 (2 chuyển khoản), hoàn 100.000; hôm qua 200.000 tiền mặt.
  const total = page.getByRole("region", { name: "Thu thuần 7 ngày" });
  await expect(total).toContainText("730.000");
  await expect(page.getByTestId("revenue-refunded")).toHaveText(
    /^Đã nhận 830\.000\s₫ · đã hoàn 100\.000\s₫$/,
  );
  await expect(
    page.getByRole("region", { name: "Số khoản thu" }),
  ).toContainText("3");
  await expect(page.getByText(/200 khoản thu gần nhất/)).toHaveCount(0);
  const routes = page.getByRole("list", { name: "Doanh thu theo tuyến" });
  await expect(routes.getByRole("listitem")).toHaveCount(1);
  await expect(routes).toContainText("TP. Hồ Chí Minh → Đà Lạt");
  await expect(routes).toContainText("430.000");
  await expect(routes).toContainText("2 đơn trả tiền · đã hoàn 100.000");
  await expect(page.getByTestId("revenue-unallocated")).toContainText(
    "100.000",
  );
  // Bảng ẩn cho trình đọc màn hình: ngày cuối là thu thuần hôm nay.
  const table = page.locator("[data-area-chart] table");
  await expect(table.locator("tbody tr")).toHaveCount(7);
  await expect(table.locator("tbody tr").last()).toContainText("530.000");
});

test("revenue falls back to summing the payment list on an API without reports", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/state`, { data: { reportsOff: true } });
  await page.goto("/admin/revenue");
  await expect(
    page.getByRole("heading", { name: "Doanh thu", level: 1 }),
  ).toBeVisible();
  // Fixture: 250.000 + 380.000 chuyển khoản, cả hai nhận hôm nay.
  const total = page.getByRole("region", { name: "Tổng thu 7 ngày" });
  await expect(total).toContainText("630.000");
  await expect(total).toContainText("Kỳ trước chưa có khoản thu");
  await expect(
    page.getByRole("region", { name: "Số khoản thu" }),
  ).toContainText("2");
  await expect(
    page.getByRole("region", { name: "Trung bình mỗi khoản" }),
  ).toContainText("315.000");
  const methods = page.getByRole("list", {
    name: "Doanh thu theo phương thức",
  });
  await expect(methods.getByRole("listitem").first()).toContainText("100%");
  // Bảng ẩn cho trình đọc màn hình có đủ 7 ngày, ngày cuối là 630.000.
  const table = page.locator("[data-area-chart] table");
  await expect(table.locator("tbody tr")).toHaveCount(7);
  await expect(table.locator("tbody tr").last()).toContainText("630.000");

  await page
    .getByRole("combobox", { name: "Khoảng thời gian" })
    .selectOption("30");
  await expect(
    page.getByRole("region", { name: "Tổng thu 30 ngày" }),
  ).toContainText("630.000");
  await expect(table.locator("tbody tr")).toHaveCount(30);
});

test("revenue range filter: yesterday, 3 months and a custom range", async ({
  page,
}) => {
  await page.goto("/admin/revenue");
  const range = page.getByRole("combobox", { name: "Khoảng thời gian" });
  await expect(range).toHaveValue("7");
  await expect(range.locator("option")).toHaveText([
    "Hôm qua",
    "7 ngày",
    "30 ngày",
    "3 tháng",
    "Tự chọn",
  ]);
  const table = page.locator("[data-area-chart] table");

  // Fixture: hôm qua nhận 200.000 tiền mặt, không hoàn.
  await range.selectOption("yesterday");
  await expect(
    page.getByRole("region", { name: "Thu thuần hôm qua" }),
  ).toContainText("200.000");
  await expect(table.locator("tbody tr")).toHaveCount(1);

  await range.selectOption("90");
  await expect(
    page.getByRole("region", { name: "Thu thuần 3 tháng" }),
  ).toContainText("730.000");
  await expect(table.locator("tbody tr")).toHaveCount(90);

  // Tự chọn: mở sẵn 7 ngày gần nhất; chỉ lấy hôm nay → 630.000 − 100.000.
  await range.selectOption("custom");
  const from = page.getByLabel("Từ ngày");
  const to = page.getByLabel("Đến ngày");
  const today = await to.inputValue();
  await from.fill(today);
  const [y, m, d] = today.split("-");
  await expect(
    page.getByRole("region", { name: `Thu thuần ${d}/${m}/${y}` }),
  ).toContainText("530.000");
  await expect(table.locator("tbody tr")).toHaveCount(1);

  // Từ ngày sau đến ngày: báo lỗi, không hiện số.
  const next = new Date(`${today}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  await from.fill(next.toISOString().slice(0, 10));
  await expect(
    page.getByText("Từ ngày phải trước hoặc bằng đến ngày."),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: /^Thu thuần/ })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await noHorizontalOverflow(page);
});

test("revenue warns when the payment list hits the 200 cap", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/state`, { data: { reportsOff: true } });
  await page.route("**/api/live/payments", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const [first] = body.payments;
    body.payments = Array.from({ length: 200 }, (_, i) => ({
      ...first,
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    }));
    await route.fulfill({ response, json: body });
  });
  await page.goto("/admin/revenue");
  await expect(page.getByText(/nhiều hơn 200 khoản thu/)).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Tổng thu 7 ngày" }),
  ).toContainText("Chưa đủ dữ liệu kỳ trước");
});

test("seat map: picking a seat shows its booking and opens the counter sale", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/seats");
  const panel = page.getByRole("complementary", { name: "Chỗ đang chọn" });
  await expect(panel).toContainText("Bấm vào một phòng");
  await expect(page).toHaveURL(/trip=44444444-4444-4444-8444-444444444444/);

  await page.getByRole("button", { name: "A2 · Đang giữ" }).click();
  await expect(
    page.getByRole("button", { name: "A2 · Đang giữ" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(panel).toContainText("TESTBK1");
  await expect(panel).toContainText("Giữ đến");
  await expect(
    panel.getByRole("link", { name: "Xem khách của chuyến" }),
  ).toBeVisible();

  // Chỗ đã đặt có nền xám riêng, khác xanh "Còn trống" (đề xuất 22/11).
  const booked = page.getByRole("button", { name: /· Đã đặt$/ }).first();
  await expect(booked).toHaveAttribute("data-tone", "booked");
  const bookedBg = await booked.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(bookedBg).toMatch(/^rgba\(206, 206, 206, 0\.41\d*\)$/);
  await expect(
    page.getByRole("button", { name: "A1 · Còn trống" }),
  ).not.toHaveCSS("background-color", bookedBg);

  await page.getByRole("button", { name: "B2 · Không bán" }).click();
  await expect(panel.getByRole("button", { name: "Bán tại quầy" })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "A1 · Còn trống" }).click();
  await panel.getByRole("button", { name: "Bán tại quầy" }).click();
  const sale = page.getByRole("dialog", { name: "Bán tại quầy" });
  await expect(sale).toBeVisible();
  // Chỗ vừa bấm đã được chọn sẵn trong form bán (GF19), chỗ khác thì chưa.
  await expect(sale.locator('[data-seat-pick="A1"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    sale.locator('[data-seat-pick][aria-pressed="true"]'),
  ).toHaveCount(1);
});

test("seat map deep link keeps the date and shows an empty day", async ({
  page,
}) => {
  await page.goto("/admin/seats?date=2027-03-09");
  await expect(page.getByLabel("Ngày khởi hành · Giờ Việt Nam")).toHaveValue(
    "2027-03-09",
  );
  await expect(
    page.getByText("Không có chuyến trong ngày đã chọn."),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/trip=/);
});

test("ACCOUNTANT sees revenue and seats but cannot sell; DISPATCHER cannot open revenue", async ({
  page,
}) => {
  await signInAs(page, "ACCOUNTANT");
  await page.goto("/admin/seats");
  await page.getByRole("button", { name: "A1 · Còn trống" }).click();
  const panel = page.getByRole("complementary", { name: "Chỗ đang chọn" });
  await expect(panel).toContainText("Tài khoản không có quyền bán vé.");
  await expect(panel.getByRole("button", { name: "Bán tại quầy" })).toHaveCount(
    0,
  );
  await page.goto("/admin/revenue");
  await expect(page).toHaveURL(/\/admin\/revenue$/);
});

test("DISPATCHER is sent away from revenue and help lists only its menus", async ({
  page,
}) => {
  await signInAs(page, "DISPATCHER");
  await page.goto("/admin/revenue");
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await page.goto("/admin/help");
  await expect(
    page.getByRole("heading", { name: "Trợ giúp", level: 1 }),
  ).toBeVisible();
  const main = page.locator("#main");
  await expect(main.getByRole("link", { name: "Sơ đồ chỗ" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Doanh thu" })).toHaveCount(0);
  await expect(main.getByRole("link", { name: "Sổ thu" })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Phím tắt" })).toContainText(
    "Thu gọn hoặc mở rộng thanh bên",
  );
});

test("assistants open help from the account menu, not the sidebar", async ({
  page,
}) => {
  await signInAs(page, "ASSISTANT");
  const nav = page.getByRole("navigation", { name: "Điều hướng quản trị" });
  await expect(nav.getByRole("link", { name: "Trợ giúp" })).toHaveCount(0);
  await page.getByRole("button", { name: /^Tài khoản:/ }).click();
  await page.getByRole("menuitem", { name: "Trợ giúp & phím tắt" }).click();
  await expect(page).toHaveURL(/\/admin\/help$/);
  const main = page.locator("#main");
  await expect(
    main.getByRole("link", { name: "Chuyến được giao" }),
  ).toBeVisible();
  await expect(main.getByRole("link", { name: "Chuyến xe" })).toHaveCount(0);
});

test("new pages do not scroll sideways on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["/admin/revenue", "/admin/seats", "/admin/help"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await noHorizontalOverflow(page);
  }
});
