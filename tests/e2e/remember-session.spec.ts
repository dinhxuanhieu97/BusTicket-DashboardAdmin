import { test, expect, type Page, type BrowserContext } from "@playwright/test";

// Phiên 30 ngày: access token ngắn hạn + refresh token xoay vòng trong cookie HttpOnly, proxy tự gia hạn,
// đăng xuất thu hồi phiên ở API. Token không bao giờ lộ ra JavaScript hay JSON.

const API = "http://127.0.0.1:3101";
const ACCESS = "pnticket_owner_session";
const REFRESH = "pnticket_owner_refresh";

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function login(page: Page, remember: boolean) {
  await page.goto("/login");
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0900000001");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("Test-only-Password!");
  if (remember) await page.getByLabel(/Ghi nhớ đăng nhập/).check();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByLabel("Mã Authenticator", { exact: true }).fill("123456");
  const bodies: string[] = [];
  await page.route("**/api/auth/login", async (route) => {
    const response = await route.fetch();
    bodies.push(await response.text());
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Xác thực và đăng nhập" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.unroute("**/api/auth/login");
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).not.toMatch(/token|fixture|eyJ/i);
}

const cookie = async (context: BrowserContext, name: string) =>
  (await context.cookies()).find((c) => c.name === name);

async function backendState(page: Page) {
  return (await (await page.request.get(`${API}/__test/state`)).json()) as {
    requests: { path: string }[];
    sessions: { remember: boolean; revoked: boolean }[];
  };
}

test("remember me keeps both HttpOnly Strict cookies for 30 days", async ({
  page,
  context,
}) => {
  await login(page, true);
  const now = Date.now() / 1000;
  for (const name of [ACCESS, REFRESH]) {
    const c = await cookie(context, name);
    expect(c, name).toBeTruthy();
    expect(c!.httpOnly).toBe(true);
    expect(c!.sameSite).toBe("Strict");
    expect(c!.expires).toBeGreaterThan(now + 29 * 86400);
    expect(c!.expires).toBeLessThan(now + 31 * 86400);
  }
  expect(await page.evaluate(() => document.cookie)).toBe("");
  expect((await backendState(page)).sessions).toEqual([
    { remember: true, revoked: false },
  ]);
});

test("without remember me the cookies end with the browser session", async ({
  page,
  context,
}) => {
  await login(page, false);
  for (const name of [ACCESS, REFRESH])
    expect((await cookie(context, name))!.expires).toBe(-1);
  expect((await backendState(page)).sessions[0]!.remember).toBe(false);
});

test("an expired access token is renewed silently and the refresh token rotates", async ({
  page,
  context,
}) => {
  await login(page, true);
  const before = (await cookie(context, REFRESH))!.value;
  await context.clearCookies({ name: ACCESS }); // như access token đã hết hạn
  await page.goto("/admin/trips");
  await expect(
    page.getByRole("heading", { name: "Chuyến xe", exact: true }),
  ).toBeVisible();
  const after = await cookie(context, REFRESH);
  expect(after!.value).not.toBe(before);
  expect(after!.expires).toBeGreaterThan(Date.now() / 1000 + 29 * 86400);
  expect(await cookie(context, ACCESS)).toBeTruthy();
  const refreshes = (await backendState(page)).requests.filter(
    (r) => r.path === "/api/v1/auth/refresh",
  );
  expect(refreshes.length).toBeGreaterThanOrEqual(1);
});

test("API calls from the open page also renew a short-lived access token", async ({
  page,
  context,
}) => {
  await page.request.post(`${API}/__test/state`, {
    data: { accessTtlMs: 1000 }, // luôn dưới ngưỡng gia hạn sớm 30 giây
  });
  await login(page, false);
  const res = await page.request.get("/api/auth/session");
  expect(res.status()).toBe(200);
  expect((await res.json()).user.fullName).toBe("Test OWNER");
  expect(await cookie(context, REFRESH)).toBeTruthy();
});

test("a revoked session sends the user to login and clears both cookies", async ({
  page,
  context,
}) => {
  await login(page, true);
  await page.goto("/icon.svg"); // rời dashboard để trang đang mở không tự chuyển hướng chen vào
  await page.request.post(`${API}/__test/state`, {
    data: { revokeSessions: true },
  });
  await context.clearCookies({ name: ACCESS });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  expect(await cookie(context, ACCESS)).toBeUndefined();
  expect(await cookie(context, REFRESH)).toBeUndefined();
});

test("logout revokes the session at the API and clears both cookies", async ({
  page,
  context,
}) => {
  await login(page, true);
  const refreshToken = (await cookie(context, REFRESH))!.value;
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await cookie(context, ACCESS)).toBeUndefined();
  expect(await cookie(context, REFRESH)).toBeUndefined();
  expect((await backendState(page)).sessions).toEqual([
    { remember: true, revoked: true },
  ]);
  // Token đã bị sao chép trước khi đăng xuất cũng không dùng được nữa.
  const reuse = await page.request.post(`${API}/api/v1/auth/refresh`, {
    data: { refreshToken },
  });
  expect(reuse.status()).toBe(401);
});

test("proxy: admin pages need a session, login skips ahead when already signed in", async ({
  page,
}) => {
  await page.goto("/admin/trips");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/mfa");
  await expect(page).toHaveURL(/\/login$/);
  await login(page, false);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/admin$/);
});

test("login page stays usable when the stored session is no longer valid", async ({
  page,
  context,
}) => {
  await login(page, false);
  await page.goto("/icon.svg");
  await page.request.post(`${API}/__test/state`, { data: { revoked: true } });
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
  expect(await cookie(context, ACCESS)).toBeUndefined();
});

test("a refresh outage keeps the session: 503 instead of logging out, then recovers", async ({
  page,
  context,
}) => {
  await login(page, true);
  await page.goto("/icon.svg");
  await page.request.post(`${API}/__test/state`, {
    data: { refreshDown: true },
  });
  await context.clearCookies({ name: ACCESS });
  const pageRes = await page.goto("/admin");
  expect(pageRes!.status()).toBe(503);
  await expect(page.getByRole("alert")).toContainText("Không kết nối được API");
  const apiRes = await page.request.get("/api/auth/session");
  expect(apiRes.status()).toBe(503);
  expect(await cookie(context, REFRESH)).toBeTruthy();

  await page.request.post(`${API}/__test/state`, {
    data: { refreshDown: false },
  });
  await page.goto("/admin/trips");
  await expect(
    page.getByRole("heading", { name: "Chuyến xe", exact: true }),
  ).toBeVisible();
});

test("a request without cookies (e.g. a link from another site) is redirected without deleting anything", async ({
  request,
}) => {
  const res = await request.get("/admin/trips", { maxRedirects: 0 });
  expect(res.status()).toBeGreaterThanOrEqual(300);
  expect(res.status()).toBeLessThan(400);
  expect(res.headers()["location"]).toMatch(/\/login$/);
  expect(res.headers()["set-cookie"]).toBeUndefined();
});

test("logout with an expired access token still revokes the session through the refresh token", async ({
  page,
  context,
}) => {
  await login(page, true);
  await page.goto("/icon.svg");
  await context.clearCookies({ name: ACCESS });
  const res = await page.request.post("/api/auth/logout", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {},
  });
  expect(res.status()).toBe(200);
  expect(await cookie(context, ACCESS)).toBeUndefined();
  expect(await cookie(context, REFRESH)).toBeUndefined();
  expect((await backendState(page)).sessions).toEqual([
    { remember: true, revoked: true },
  ]);
});
