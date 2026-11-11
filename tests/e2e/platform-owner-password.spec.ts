import { expect, test, type APIRequestContext } from "@playwright/test";

const fixture = "http://127.0.0.1:3101/__test";
const headers = {
  Origin: "http://127.0.0.1:3102",
  "Content-Type": "application/json",
};
const PN = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "22222222-2222-4222-8222-222222222222";
const temp = "Test-only-Owner-Temp!";

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/reset`);
});

const signIn = (req: APIRequestContext, phone: string, otp?: string) =>
  req.post("/api/auth/login", {
    headers,
    data: { phone, password: "Test-only-Password!", ...(otp ? { otp } : {}) },
  });

test("platform admin lands on /platform and cannot use operator pages or APIs", async ({
  page,
  context,
}) => {
  const login = await signIn(context.request, "0900000003");
  expect(login.status()).toBe(200);
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/platform$/);
  await expect(
    page.getByRole("heading", { name: "Mật khẩu chủ xe" }),
  ).toBeVisible();
  const staff = await context.request.get("/api/staff");
  expect(staff.status()).toBe(403);
  expect((await staff.json()).error.code).toBe("OPERATOR_REQUIRED");
  // Bị từ chối ở khu nhà xe không làm mất phiên.
  expect((await context.request.get("/api/auth/session")).status()).toBe(200);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/platform$/);
});

test("operator accounts cannot open the platform area", async ({
  page,
  context,
}) => {
  expect((await signIn(context.request, "0900000001", "123456")).status()).toBe(
    200,
  );
  await page.goto("/platform");
  await expect(page).toHaveURL(/\/admin$/);
  const res = await context.request.get("/api/platform/operators");
  expect(res.status()).toBe(403);
  expect(
    (
      await context.request.post(
        `/api/platform/operators/${PN}/owners/${OWNER_ID}/temporary-password`,
        { headers, data: { password: temp, adminPassword: "x" } },
      )
    ).status(),
  ).toBe(403);
});

test("platform admin sets a temporary password; the owner must change it at next login", async ({
  page,
  context,
  request,
  browser,
  baseURL,
}) => {
  // OWNER thứ hai của nhà xe, có mật khẩu riêng.
  expect((await signIn(request, "0900000001", "123456")).status()).toBe(200);
  const created = await request.post("/api/staff", {
    headers,
    data: {
      fullName: "Chủ hai",
      phone: "0909876701",
      password: "Test-only-Owner-Two!",
      role: "OWNER",
    },
  });
  expect(created.status()).toBe(201);

  expect((await signIn(context.request, "0900000003")).status()).toBe(200);
  await page.goto("/platform");
  await expect(page.getByLabel("Nhà xe")).toHaveValue(PN);
  const list = page.getByRole("list", { name: /Chủ xe của/ });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list).toContainText("Chủ hai");
  await expect(list).toContainText("Chưa bật 2FA");

  await page
    .getByRole("button", { name: "Đặt mật khẩu tạm cho Chủ hai" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Đặt mật khẩu tạm cho chủ xe",
  });
  await dialog.getByRole("button", { name: "Tạo ngẫu nhiên" }).click();
  await expect(dialog.locator("#owner-temp-password")).toHaveValue(
    /^[A-Za-z2-9]{16}$/,
  );
  await dialog.locator("#owner-temp-password").fill(temp);
  await dialog.locator("#platform-admin-password").fill("Test-only-Wrong!");
  await dialog.getByRole("button", { name: "Đặt mật khẩu tạm" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Mật khẩu hoặc mã xác thực không đúng",
  );
  await expect(dialog.locator("#platform-admin-password")).toHaveValue("");

  await dialog.locator("#platform-admin-password").fill("Test-only-Password!");
  await dialog.getByRole("button", { name: "Đặt mật khẩu tạm" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Đã đặt mật khẩu tạm cho Chủ hai."),
  ).toBeVisible();
  await expect(list).toContainText("Chờ đổi mật khẩu tạm");

  const ownerCtx = await browser.newContext({ baseURL });
  try {
    const p = await ownerCtx.newPage();
    await p.goto("/login");
    await p.locator("#phone").fill("0909876701");
    await p.locator("#password").fill(temp);
    await p.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(p).toHaveURL(/\/change-password$/);
  } finally {
    await ownerCtx.close();
  }
});

test("platform proxy validates ids, body and origin", async ({ context }) => {
  expect((await signIn(context.request, "0900000003")).status()).toBe(200);
  const post = (path: string, data: unknown, h = headers) =>
    context.request.post(path, { headers: h, data });
  const url = `/api/platform/operators/${PN}/owners/${OWNER_ID}/temporary-password`;
  expect(
    (
      await post(
        `/api/platform/operators/not-a-uuid/owners/${OWNER_ID}/temporary-password`,
        { password: temp, adminPassword: "Test-only-Password!" },
      )
    ).status(),
  ).toBe(400);
  expect(
    (await post(url, { password: "short", adminPassword: "x" })).status(),
  ).toBe(400);
  expect(
    (
      await post(url, {
        password: temp,
        adminPassword: "Test-only-Password!",
        extra: true,
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await post(
        url,
        { password: temp, adminPassword: "Test-only-Password!" },
        { ...headers, Origin: "https://other-site.example" },
      )
    ).status(),
  ).toBe(403);
  expect(
    (await context.request.get(`/api/platform/operators?x=1`)).status(),
  ).toBe(400);
  const ok = await post(url, {
    password: temp,
    adminPassword: "Test-only-Password!",
  });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).owner).toMatchObject({
    id: OWNER_ID,
    mustChangePassword: true,
  });
});
