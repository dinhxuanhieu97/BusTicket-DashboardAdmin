import { test, expect } from "@playwright/test";
const origin = "http://127.0.0.1:3102";
const headers = { Origin: origin, "Content-Type": "application/json" };
test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:3101/__test/reset");
});
async function login(
  page: import("@playwright/test").Page,
  phone = "0900000001",
) {
  await page.goto("/login");
  await page.getByLabel("Số điện thoại", { exact: true }).fill(phone);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("Test-only-Password!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}
test("unauthenticated live routes redirect and removed demo returns 404", async ({
  page,
  request,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  expect((await request.get("/api/live/payments")).status()).toBe(401);
  expect((await page.goto("/demo"))?.status()).toBe(404);
  expect((await request.get("/api/live/users")).status()).toBe(401);
});
test("login needs OTP, creates HttpOnly cookie, reads data and logs out", async ({
  page,
  context,
}) => {
  await login(page);
  await expect(
    page.getByLabel("Mã Authenticator", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Mã Authenticator", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Xác thực và đăng nhập" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByText("Chuyến kiểm thử", { exact: true }),
  ).toBeVisible();
  const cookie = (await context.cookies()).find(
    (c) => c.name === "pnticket_owner_session",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "pnticket_owner_session",
  );
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "token",
  );
  await page.getByRole("link", { name: "Sổ thu", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Chi tiết khoản thu/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Chi tiết khoản thu/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Thanh toán thừa");
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.getByRole("link", { name: "Nhân viên", exact: true }).click();
  await expect(page.getByText("Test OWNER", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Nhật ký", exact: true }).click();
  await expect(page.getByText("Tạo chuyến", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await context.cookies()).some((c) => c.name === "pnticket_owner_session"),
  ).toBe(false);
});
test("when the API makes 2FA mandatory, a new OWNER must set it up and the setup token cannot read data", async ({
  page,
  request,
  context,
}) => {
  await request.post("http://127.0.0.1:3101/__test/state", {
    data: { requireMfa: true }, // API bật AUTH_REQUIRE_MFA
  });
  await login(page, "0900000002");
  await expect(page).toHaveURL(/\/mfa$/);
  expect((await context.request.get("/api/live/payments")).status()).toBe(403);
  await page.getByRole("button", { name: "Bắt đầu thiết lập 2FA" }).click();
  await expect(
    page.getByAltText("Mã QR thiết lập Authenticator"),
  ).toBeVisible();
  await page.getByLabel("Mã Authenticator", { exact: true }).fill("000000");
  await page.getByRole("button", { name: "Xác nhận và vào quản trị" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("không đúng");
  await page.getByLabel("Mã Authenticator", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Xác nhận và vào quản trị" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const state = await (
    await request.get("http://127.0.0.1:3101/__test/state")
  ).json();
  expect(state.confirmed).toBe(true);
});
test("sends platform accounts to /platform and rejects invalid credentials", async ({
  page,
}) => {
  await login(page, "0900000003");
  await expect(page).toHaveURL(/\/platform$/);
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0900000003");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("không đúng");
});
test("CSRF, unsupported business writes and tenant overrides are blocked", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/auth/login", {
        data: {},
        headers: { Origin: "https://evil.example" },
      })
    ).status(),
  ).toBe(403);
  expect((await request.post("/api/auth/logout", { data: {} })).status()).toBe(
    403,
  );
  await request.post("/api/auth/login", {
    headers,
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
  expect(
    (await request.get("/api/live/payments?operatorId=other")).status(),
  ).toBe(400);
  for (const method of ["POST", "PATCH", "PUT", "DELETE"])
    expect(
      (
        await request.fetch("/api/live/payments", {
          method,
          headers,
          data: { amount: 123 },
        })
      ).status(),
    ).toBe(405);
  expect(
    (await request.post("/api/auth/password", { headers, data: {} })).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/live/payments/manual", { headers, data: {} })
    ).status(),
  ).toBe(404);
  const response = await request.get("/api/live/payments");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const state = await (
    await request.get("http://127.0.0.1:3101/__test/state")
  ).json();
  expect(
    state.requests.filter(
      (r: { path: string; method: string }) =>
        r.path.includes("/admin/") && r.method !== "GET",
    ),
  ).toHaveLength(0);
  expect(
    state.requests.some((r: { path: string }) =>
      r.path.includes(
        "/operators/11111111-1111-4111-8111-111111111111/payments",
      ),
    ),
  ).toBe(true);
});
test("backend outage and malformed responses never become demo data; revoked session redirects", async ({
  page,
  request,
}) => {
  await login(page);
  await page.getByLabel("Mã Authenticator", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Xác thực và đăng nhập" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByText("Chuyến kiểm thử", { exact: true }),
  ).toBeVisible();
  await request.post("http://127.0.0.1:3101/__test/state", {
    data: { down: true },
  });
  await page
    .getByRole("button", { name: "Làm mới dữ liệu", exact: true })
    .click();
  const errorNotice = page.getByRole("main").getByRole("alert");
  await expect(errorNotice).toBeVisible();
  await expect(
    page.getByText("Vui lòng kiểm tra kết nối mạng hoặc thử lại sau giây lát."),
  ).toBeVisible();
  await expect(page.getByText("Chuyến kiểm thử", { exact: true })).toHaveCount(
    0,
  );
  await request.post("http://127.0.0.1:3101/__test/state", {
    data: { down: false, malformed: true },
  });
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(errorNotice).toContainText("chưa tương thích");
  await request.post("http://127.0.0.1:3101/__test/state", {
    data: { malformed: false, revoked: true },
  });
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
test("mobile login, navigation and read-only screen fit viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByLabel("Mã Authenticator", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Xác thực và đăng nhập" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByText("Chuyến kiểm thử", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mở menu", exact: true }).click();
  await page.getByRole("link", { name: "Sổ thu", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Chi tiết khoản thu/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
