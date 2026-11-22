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

test("payment tabs count the whole ledger from the counters API (GF12)", async ({
  page,
}) => {
  await page.goto("/admin/payments");
  const tabs = page.getByRole("group", { name: "Trạng thái kiểm tra" });
  // Fixture `counters`: 412 khoản (405 / 5 / 2) — nhiều hơn danh sách 200 khoản.
  await expect(tabs.getByRole("button")).toHaveText([
    "Tất cả412",
    "Không cần kiểm tra405",
    "Cần kiểm tra5",
    "Đã xử lý2",
  ]);
  await tabs.getByRole("button", { name: /^Đã xử lý/ }).click();
  await expect(tabs.getByRole("button", { name: /^Tất cả/ })).toHaveText(
    "Tất cả412",
  );
});

test("payment tabs show counts per review status and filter through the API", async ({
  page,
  request,
}) => {
  // API cũ chưa có `counters`: đếm trong 200 khoản gần nhất.
  await request.post(`${fixture}/state`, { data: { reportsOff: true } });
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

test("Sổ thu pages 25 rows, sorts by a column and opens Chi tiết (T1)", async ({
  page,
  request,
}) => {
  // 2 khoản sẵn có + 30 khoản đã khớp (100.000–390.000 đ, mỗi khoản cách nhau 1 giờ).
  await request.post(`${fixture}/state`, { data: { extraPayments: 30 } });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/payments");
  const table = page.getByRole("region", { name: "Danh sách khoản thu" });
  const rows = table.locator("tbody tr");
  const codes = () => rows.locator("td:first-child > span").allInnerTexts();
  const footer = page.locator(".pn-table-footer");
  await expect(rows).toHaveCount(25);
  await expect(footer).toContainText(
    "1–25 trên 32 khoản thu · trong dữ liệu đã tải",
  );
  await expect(footer.getByRole("combobox", { name: "Số dòng" })).toHaveValue(
    "25",
  );
  await footer.getByRole("button", { name: "Sau" }).click();
  await expect(rows).toHaveCount(7);
  await expect(footer).toContainText("26–32 trên 32 khoản thu");
  await expect(footer.getByRole("button", { name: "Sau" })).toBeDisabled();

  // Bấm tiêu đề: tăng → giảm → bỏ; đổi sắp xếp quay về trang 1.
  const amount = table.getByRole("columnheader", { name: /Số tiền/ });
  await expect(amount).toHaveAttribute("aria-sort", "none");
  await amount.getByRole("button").click();
  await expect(amount).toHaveAttribute("aria-sort", "ascending");
  await expect(footer).toContainText("1–25 trên 32");
  expect((await codes())[0]).toBe("TESTP30");
  await amount.getByRole("button").click();
  await expect(amount).toHaveAttribute("aria-sort", "descending");
  // 390.000 đ trước; hai khoản 380.000 đ giữ thứ tự gốc.
  expect((await codes()).slice(0, 3)).toEqual([
    "TESTP17",
    "TESTLATE",
    "TESTP04",
  ]);
  await amount.getByRole("button").click();
  await expect(amount).toHaveAttribute("aria-sort", "none");
  expect((await codes()).slice(0, 2)).toEqual(["TEST123", "TESTLATE"]);
  // Cột không sắp xếp được thì không có nút.
  await expect(
    table.getByRole("columnheader").last().getByRole("button"),
  ).toHaveCount(0);

  // Đổi số dòng mỗi trang; tìm kiếm quay về trang 1.
  await footer.getByRole("combobox", { name: "Số dòng" }).selectOption("10");
  await expect(rows).toHaveCount(10);
  await expect(footer).toContainText("1–10 trên 32");
  await footer.getByRole("button", { name: "Sau" }).click();
  await page
    .getByRole("textbox", { name: "Tìm trong khoản thu đã tải" })
    .fill("TESTP1");
  // TESTP1 + TESTP10…TESTP19.
  await expect(footer).toContainText("1–10 trên 11 khoản thu");

  // Thao tác dòng chỉ có "Chi tiết".
  await page
    .getByRole("textbox", { name: "Tìm trong khoản thu đã tải" })
    .fill("TEST123");
  await expect(rows).toHaveCount(1);
  await expect(rows.getByRole("button")).toHaveText(["Chi tiết"]);
  await rows.getByRole("button", { name: /^Chi tiết khoản thu/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Chi tiết khoản thu" }),
  ).toBeVisible();
});

test("Sổ thu table fits a phone screen (T1)", async ({ page, request }) => {
  await request.post(`${fixture}/state`, { data: { extraPayments: 30 } });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/admin/payments");
  await expect(
    page
      .getByRole("region", { name: "Danh sách khoản thu" })
      .locator("tbody tr"),
  ).toHaveCount(25);
  await noHorizontalOverflow(page);
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

const withBackTrip = async (page: Page, serverFilter: boolean) =>
  page.route("**/api/live/trips?*", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch();
    const body = await response.json();
    if (!response.ok()) return route.fulfill({ response, json: body });
    const [first] = body.trips;
    body.trips.push({
      ...first,
      id: "66666666-6666-4666-8666-666666666666",
      name: "Chuyến chiều về",
      route_code: "BACK",
    });
    const code = url.searchParams.get("route");
    if (serverFilter && code)
      body.trips = body.trips.filter(
        (t: { route_code: string }) => t.route_code === code,
      );
    await route.fulfill({ response, json: body });
  });

test("route chips ask the API for that route across all pages (GF13)", async ({
  page,
}) => {
  await withBackTrip(page, true);
  await page.goto("/admin/trips");
  const chips = page.getByRole("group", { name: "Lọc theo tuyến" });
  await expect(chips.getByRole("button")).toHaveText([
    "Tất cả tuyến",
    "BACK",
    "TEST",
  ]);
  const table = page.getByRole("region", { name: "Danh sách chuyến" });
  await expect(table.getByRole("row")).toHaveCount(3);
  const filtered = page.waitForRequest((r) =>
    /\/api\/live\/trips\?.*route=BACK/.test(r.url()),
  );
  await chips.getByRole("button", { name: "BACK" }).click();
  expect(new URL((await filtered).url()).searchParams.has("cursor")).toBe(
    false,
  );
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).toContainText("Chuyến chiều về");
  await expect(table).not.toContainText("Chuyến kiểm thử");
  // Chip của tuyến khác vẫn còn khi đang lọc.
  await expect(chips.getByRole("button")).toHaveCount(3);
});

test("changing the period while a route is filtered keeps the chips so the filter can be cleared (GF13)", async ({
  page,
}) => {
  await withBackTrip(page, true);
  await page.goto("/admin/trips");
  const chips = page.getByRole("group", { name: "Lọc theo tuyến" });
  await chips.getByRole("button", { name: "BACK" }).click();
  const table = page.getByRole("region", { name: "Danh sách chuyến" });
  await expect(table).not.toContainText("Chuyến kiểm thử");
  // Đổi kỳ xem: danh sách tuyến đã thấy bị xóa, backend chỉ trả chuyến BACK.
  await page.getByRole("button", { name: "Tháng", exact: true }).click();
  await expect(chips).toBeVisible();
  await expect(chips.getByRole("button", { name: "BACK" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await chips.getByRole("button", { name: "Tất cả tuyến" }).click();
  await expect(table).toContainText("Chuyến kiểm thử");
});

test("route chips fall back to filtering the loaded page on an older API", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/state`, { data: { reportsOff: true } });
  await withBackTrip(page, false);
  await page.goto("/admin/trips");
  const chips = page.getByRole("group", { name: "Lọc theo tuyến" });
  await chips.getByRole("button", { name: "BACK" }).click();
  const table = page.getByRole("region", { name: "Danh sách chuyến" });
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).toContainText("Chuyến chiều về");
});

test("audit log is a shared table with a detail button", async ({ page }) => {
  await page.goto("/admin/audit-logs");
  const table = page.getByRole("region", { name: "Nhật ký hoạt động" });
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).toContainText("Tạo chuyến");
  await expect(table).toContainText("Test OWNER");
  await table.getByRole("button", { name: "Chi tiết nhật ký 1" }).click();
  await expect(
    page.getByRole("dialog", { name: "Chi tiết nhật ký" }),
  ).toContainText("Chuyến kiểm thử");
});

test("audit log filters by group, actor and Vietnam date range, sorts and pages", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:3101/__test/state", {
    data: { extraAudit: 30 },
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/audit-logs");
  const table = page.getByRole("region", { name: "Nhật ký hoạt động" });
  // Mặc định theo thứ tự API (mới nhất trước), 25 dòng/trang.
  await expect(page.getByText("1–25 trên 31 bản ghi")).toBeVisible();
  await expect(
    table.getByRole("columnheader", { name: /Thời gian/ }),
  ).toHaveAttribute("aria-sort", "none");
  await expect(table.getByRole("row").nth(1)).toContainText("Tạo chuyến");

  const groups = page.getByRole("group", { name: "Nhóm thao tác" });
  await expect(groups.getByRole("button", { name: /Tất cả/ })).toContainText(
    "31",
  );
  // 30 bản ghi thêm chia đều 5 loại → 6 mỗi loại; Chuyến có thêm bản ghi gốc.
  await expect(groups.getByRole("button", { name: /Chuyến/ })).toContainText(
    "7",
  );
  await groups.getByRole("button", { name: /Thanh toán/ }).click();
  await expect(page.getByText("1–6 trên 6 bản ghi")).toBeVisible();
  await expect(table).not.toContainText("Tạo chuyến");

  // Người thực hiện: "Hệ thống" cho bản ghi không có người.
  await page.getByLabel("Người thực hiện").selectOption("Hệ thống");
  await expect(page.getByText("1–2 trên 2 bản ghi")).toBeVisible();
  await page.getByRole("button", { name: "Bỏ lọc" }).click();
  await expect(page.getByText("1–25 trên 31 bản ghi")).toBeVisible();

  // Khoảng ngày theo giờ Việt Nam: bản ghi x1..x3 lùi 1..3 ngày.
  const vnDay = (offset: number) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
      new Date(Date.now() - offset * 86_400_000),
    );
  await page.getByLabel("Từ ngày").fill(vnDay(3));
  await page.getByLabel("Đến ngày").fill(vnDay(1));
  await expect(page.getByText("1–3 trên 3 bản ghi")).toBeVisible();
  await page.getByLabel("Từ ngày").fill(vnDay(0));
  await expect(page.getByText(/không có bản\s+ghi nào/)).toBeVisible();
  await expect(table).toContainText("Không có bản ghi phù hợp bộ lọc.");
  await page.getByRole("button", { name: "Bỏ lọc" }).click();

  // Cũ nhất trước, rồi sang trang 2.
  await table.getByRole("button", { name: /Thời gian/ }).click();
  await expect(
    table.getByRole("columnheader", { name: /Thời gian/ }),
  ).toHaveAttribute("aria-sort", "ascending");
  await expect(table.getByRole("row").nth(1)).toContainText(
    "Cập nhật trạng thái chuyến",
  );
  await page.getByRole("button", { name: "Sau" }).click();
  await expect(page.getByText("26–31 trên 31 bản ghi")).toBeVisible();
  await expect(table.getByRole("row").last()).toContainText("Tạo chuyến");
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

test("trip columns sort the whole range through the API (T2)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/trips");
  const table = page.getByRole("region", { name: "Danh sách chuyến" });
  const header = (name: string) =>
    table.getByRole("columnheader", { name: new RegExp(name) });
  // Mặc định: giờ khởi hành tăng dần, không gửi tham số sắp xếp.
  await expect(header("Khởi hành")).toHaveAttribute("aria-sort", "ascending");
  const sent = (pattern: RegExp) =>
    page.waitForRequest(
      (r) => /\/api\/live\/trips\?/.test(r.url()) && pattern.test(r.url()),
    );

  let req = sent(/sort=available&order=asc/);
  await header("Chỗ khả dụng").getByRole("button").click();
  expect(new URL((await req).url()).searchParams.has("cursor")).toBe(false);
  await expect(header("Chỗ khả dụng")).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await expect(header("Khởi hành")).toHaveAttribute("aria-sort", "none");
  req = sent(/sort=available&order=desc/);
  await header("Chỗ khả dụng").getByRole("button").click();
  await req;
  // Lần bấm thứ ba bỏ sắp xếp: quay về thứ tự mặc định của API.
  req = page.waitForRequest(
    (r) =>
      /\/api\/live\/trips\?/.test(r.url()) &&
      !new URL(r.url()).searchParams.has("sort"),
  );
  await header("Chỗ khả dụng").getByRole("button").click();
  await req;
  await expect(header("Khởi hành")).toHaveAttribute("aria-sort", "ascending");
  req = sent(/sort=depart&order=desc/);
  await header("Khởi hành").getByRole("button").click();
  await req;

  // Số dòng mỗi trang đi theo `limit`.
  req = sent(/limit=50/);
  await page
    .locator(".pn-table-footer")
    .getByRole("combobox", { name: "Số dòng" })
    .selectOption("50");
  await req;
  await expect(page.locator(".pn-table-footer")).toContainText(
    "Tối đa 50 chuyến/trang",
  );
  // Thao tác dòng: Chi tiết và Đóng bán.
  await expect(
    table.locator("tbody tr").first().getByRole("button"),
  ).toHaveText(["Chi tiết", "Đóng bán"]);
});

test("trip sorting falls back to the loaded page on an older API (T2)", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/state`, { data: { reportsOff: true } });
  await withBackTrip(page, false);
  await page.goto("/admin/trips");
  const table = page.getByRole("region", { name: "Danh sách chuyến" });
  const first = table.locator("tbody tr").first();
  await expect(first).toContainText("Chuyến kiểm thử");
  await table
    .getByRole("columnheader", { name: /Chuyến \/ tuyến/ })
    .getByRole("button")
    .click();
  await expect(first).toContainText("Chuyến chiều về");
  await expect(page.locator(".pn-table-footer")).toContainText(
    "Sắp xếp trong trang đã tải",
  );
});

test("Đóng bán on a trip row asks first and Giữ mở bán changes nothing", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/trips");
  const row = page
    .getByRole("region", { name: "Danh sách chuyến" })
    .locator("tbody tr")
    .first();
  await row.getByRole("button", { name: "Đóng bán" }).click();
  const dialog = page.getByRole("dialog", { name: "Đóng bán chuyến xe" });
  await expect(dialog).toContainText("Khách sẽ không đặt được chỗ mới");
  await dialog.getByRole("button", { name: "Giữ mở bán" }).click();
  await expect(dialog).toHaveCount(0);
  const patches = async () =>
    (await (await request.get(`${fixture}/state`)).json()).requests.filter(
      (r: { method: string; path: string }) =>
        r.method === "PATCH" && r.path.endsWith("/status"),
    );
  expect(await patches()).toHaveLength(0);
  await row.getByRole("button", { name: "Đóng bán" }).click();
  await dialog.getByRole("button", { name: "Xác nhận đóng bán" }).click();
  await expect(row.getByRole("button", { name: "Mở bán" })).toBeVisible();
  expect(await patches()).toHaveLength(1);
});
