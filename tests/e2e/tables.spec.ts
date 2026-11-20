import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const fixture = "http://127.0.0.1:3101/__test";

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

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ context, request }) => {
  await request.post(`${fixture}/reset`);
  await signIn(context);
});

test("payment tabs show counts per review status and filter through the API", async ({
  page,
}) => {
  // Fixture bỏ qua `?review=`; giả lập backend lọc thật để số đếm không thể lấy nhầm từ tập đã lọc.
  await page.route("**/api/live/payments?review=*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const review = new URL(route.request().url()).searchParams.get("review");
    body.payments = body.payments.filter(
      (p: { review: { status: string } }) => p.review.status === review,
    );
    await route.fulfill({ response, json: body });
  });
  await page.goto("/admin/payments");
  await expect(
    page.getByRole("heading", { name: "Sổ thu tài chính", level: 2 }),
  ).toBeVisible();
  const tabs = page.getByRole("group", { name: "Trạng thái kiểm tra" });
  // Fixture: 2 khoản, cả hai đang cần kiểm tra.
  await expect(tabs.getByRole("button")).toHaveText([
    "Tất cả2",
    "Không cần kiểm tra0",
    "Cần kiểm tra2",
    "Đã xử lý0",
  ]);
  await expect(tabs.getByRole("button", { name: /^Tất cả/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const filtered = page.waitForRequest((r) =>
    r.url().endsWith("/api/live/payments?review=RESOLVED"),
  );
  await tabs.getByRole("button", { name: /^Đã xử lý/ }).click();
  await filtered;
  await expect(tabs.getByRole("button", { name: /^Đã xử lý/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("0 kết quả trong 0 khoản đã tải")).toBeVisible();
  // Số đếm vẫn lấy từ tập không lọc khi đang ở tab khác.
  await expect(tabs.getByRole("button", { name: /^Tất cả/ })).toHaveText(
    "Tất cả2",
  );
});

test("trip page has one create button and the card view switch closes sales", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/trips");
  await expect(
    page.getByRole("heading", { name: "Chuyến xe", level: 2 }),
  ).toBeVisible();
  // GF6: nút ở topbar ẩn trên trang này, chỉ còn nút ở đầu trang.
  await expect(page.getByRole("link", { name: "Tạo chuyến" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "+ Thêm chuyến", exact: true }),
  ).toHaveCount(1);

  await page
    .getByRole("group", { name: "Kiểu hiển thị" })
    .getByRole("button", { name: "Thẻ" })
    .click();
  const card = page
    .getByRole("list", { name: "Thẻ chuyến" })
    .getByRole("listitem", { name: "Chuyến kiểm thử" });
  const toggle = card.getByRole("switch", { name: "Mở bán Chuyến kiểm thử" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await page.getByRole("button", { name: "Xác nhận đóng bán" }).click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(card).toContainText("Đã đóng bán");

  const state = await (await request.get(`${fixture}/state`)).json();
  const patches = state.requests.filter(
    (r: { method: string; path: string }) =>
      r.method === "PATCH" && r.path.endsWith("/status"),
  );
  expect(patches).toHaveLength(1);
  expect(patches[0].body.status).toBe("CLOSED");

  // Kiểu hiển thị được nhớ qua lần tải lại.
  await page.reload();
  await expect(page.getByRole("list", { name: "Thẻ chuyến" })).toBeVisible();
});

test("route chips filter the loaded trips", async ({ page }) => {
  await page.route("**/api/live/trips?*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const [first] = body.trips;
    body.trips.push({
      ...first,
      id: "66666666-6666-4666-8666-666666666666",
      name: "Chuyến chiều về",
      route_code: "BACK",
    });
    await route.fulfill({ response, json: body });
  });
  await page.goto("/admin/trips");
  const chips = page.getByRole("group", { name: "Lọc theo tuyến" });
  await expect(chips.getByRole("button")).toHaveText([
    "Tất cả tuyến2",
    "BACK1",
    "TEST1",
  ]);
  const table = page.getByRole("region", { name: "Danh sách chuyến" });
  await expect(table.getByRole("row")).toHaveCount(3);
  await chips.getByRole("button", { name: /^BACK/ }).click();
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).toContainText("Chuyến chiều về");
  await expect(table).not.toContainText("Chuyến kiểm thử");
});

test("audit log is a list of rows with a detail button", async ({ page }) => {
  await page.goto("/admin/audit-logs");
  const list = page.getByRole("list", { name: "Nhật ký hoạt động" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText("Tạo chuyến");
  await expect(list).toContainText("Test OWNER");
  await list.getByRole("button", { name: "Xem nhật ký 1" }).click();
  await expect(
    page.getByRole("dialog", { name: "Chi tiết nhật ký" }),
  ).toBeVisible();
});

test("table pages do not scroll sideways on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of [
    "/admin/trips",
    "/admin/payments",
    "/admin/audit-logs",
    "/admin/passengers",
    "/admin/schedules",
    "/admin/vehicles",
    "/admin/routes",
    "/admin/users",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await noHorizontalOverflow(page);
  }
  await page.goto("/admin/trips");
  await page
    .getByRole("group", { name: "Kiểu hiển thị" })
    .getByRole("button", { name: "Thẻ" })
    .click();
  await expect(page.getByRole("list", { name: "Thẻ chuyến" })).toBeVisible();
  await noHorizontalOverflow(page);
});
