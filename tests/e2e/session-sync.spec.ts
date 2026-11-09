import { test, expect, type Page } from "@playwright/test";

// Đợt 3A: nhiều tab cùng trình duyệt dùng chung cookie phiên; tab này đăng nhập/đăng xuất thì tab kia
// tự cập nhật sau khi hỏi lại máy chủ. Tin nhắn giữa các tab không chứa token.

test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:3101/__test/reset");
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0900000001");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("Test-only-Password!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByLabel("Mã Authenticator", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Xác thực và đăng nhập" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Tab quan sát cùng origin, không tự chuyển trang: ghi lại mọi tin nhắn đồng bộ phiên. */
async function observer(page: Page) {
  await page.goto("/icon.svg");
  await page.evaluate(() => {
    const w = window as unknown as { seen: unknown[] };
    w.seen = [];
    const ch = new BroadcastChannel("pnticket-session");
    ch.onmessage = (m) => w.seen.push(m.data);
  });
  return () =>
    page.evaluate(() => (window as unknown as { seen: unknown[] }).seen);
}

test("logging out in one tab sends the other tab to the login page", async ({
  context,
}) => {
  const a = await context.newPage();
  await login(a);
  const messages = await observer(await context.newPage());
  const b = await context.newPage();
  await b.goto("/admin/trips");
  await expect(
    b.getByRole("heading", { name: "Chuyến xe", exact: true }),
  ).toBeVisible();

  await a.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(a).toHaveURL(/\/login$/);
  // Tab B không được focus, vẫn phải tự chuyển (không chờ 60 giây).
  await expect(b).toHaveURL(/\/login$/, { timeout: 5000 });

  const seen = await messages();
  expect(seen).toHaveLength(1);
  for (const m of seen) {
    expect(Object.keys(m as object).sort()).toEqual(["at", "id", "type"]);
    expect(JSON.stringify(m)).not.toMatch(/token|test-owner|0900/i);
  }
});

test("logging in in one tab moves a tab waiting on the login page into the dashboard", async ({
  context,
}) => {
  const waiting = await context.newPage();
  await waiting.goto("/login");
  const a = await context.newPage();
  await login(a);
  await expect(waiting).toHaveURL(/\/admin$/, { timeout: 5000 });
});

test("a session event never logs a tab out by itself: the server is asked first", async ({
  context,
}) => {
  const a = await context.newPage();
  await login(a);
  const b = await context.newPage();
  await b.goto("/admin");
  // Tin giả "logout" (vd. extension) khi phiên trên máy chủ vẫn còn: tab vẫn ở lại.
  await a.evaluate(() => {
    const ch = new BroadcastChannel("pnticket-session");
    ch.postMessage({ type: "logout", at: Date.now(), id: "forged-1" });
    ch.close();
  });
  await b.waitForTimeout(1000);
  await expect(b).toHaveURL(/\/admin$/);
});

test("a tab re-checks the server only for well-formed events", async ({
  context,
}) => {
  const a = await context.newPage();
  await login(a);
  const b = await context.newPage();
  await b.goto("/admin");
  let checks = 0;
  b.on("request", (r) => {
    if (r.url().endsWith("/api/auth/session")) checks++;
  });
  // Tin sai dạng (kèm token) bị bỏ qua: không hỏi lại máy chủ.
  await a.evaluate(() => {
    const ch = new BroadcastChannel("pnticket-session");
    ch.postMessage({ type: "logout", at: Date.now(), id: "x", token: "t" });
    ch.close();
  });
  await b.waitForTimeout(1000);
  expect(checks).toBe(0);
  // Tin đúng dạng → hỏi lại máy chủ ngay (tab không có focus).
  await a.evaluate(() => {
    const ch = new BroadcastChannel("pnticket-session");
    ch.postMessage({ type: "logout", at: Date.now(), id: "real-1" });
    ch.close();
  });
  await expect.poll(() => checks, { timeout: 5000 }).toBeGreaterThan(0);
  // Phiên trên máy chủ vẫn còn → tab ở lại.
  await expect(b).toHaveURL(/\/admin$/);
});

test("a first login that still needs 2FA setup moves the waiting login tab to /mfa", async ({
  context,
}) => {
  const waiting = await context.newPage();
  await waiting.goto("/login");
  const a = await context.newPage();
  await a.goto("/login");
  await a.getByLabel("Số điện thoại", { exact: true }).fill("0900000002");
  await a.getByLabel("Mật khẩu", { exact: true }).fill("Test-only-Password!");
  await a.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(a).toHaveURL(/\/mfa$/);
  await expect(waiting).toHaveURL(/\/mfa$/, { timeout: 5000 });
});

test("the menu follows the permissions returned by the server", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:3101/__test/state", {
    data: { permissions: ["trip.read"] },
  });
  await login(page);
  const nav = page.getByRole("navigation", { name: "Điều hướng quản trị" });
  await expect(nav.getByRole("link")).toHaveText([
    "Tổng quan",
    "Chuyến xe",
    "Tài khoản",
  ]);
  await request.post("http://127.0.0.1:3101/__test/state", {
    data: { permissions: null },
  });
  await page.reload();
  await expect(nav.getByRole("link")).toHaveCount(6);
});
