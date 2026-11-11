import { test, expect, type Page } from "@playwright/test";

// 2FA tùy chọn (API mặc định không bắt buộc): OWNER chưa bật 2FA vào thẳng quản trị, tự bật được trong Cài đặt,
// và tắt được khi nhập đúng mật khẩu + mã hiện tại.

const API = "http://127.0.0.1:3101";
const ACCESS = "pnticket_owner_session";

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page, phone: string, otp?: string) {
  await page.goto("/login");
  await page.getByLabel("Số điện thoại", { exact: true }).fill(phone);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("Test-only-Password!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  if (otp) {
    await page.getByLabel("Mã Authenticator", { exact: true }).fill(otp);
    await page.getByRole("button", { name: "Xác thực và đăng nhập" }).click();
  }
  await expect(page).toHaveURL(/\/admin$/);
}

test("an OWNER without 2FA signs in with the password only and can turn 2FA on from Settings", async ({
  page,
}) => {
  await signIn(page, "0900000002");
  expect((await page.request.get("/api/live/payments")).status()).toBe(200);
  await page.goto("/admin/settings");
  await expect(page.getByText("Chưa bật", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Bật 2FA" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  await expect(
    page.getByRole("link", { name: "Để sau, quay lại Cài đặt" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu thiết lập 2FA" }).click();
  await page.getByLabel("Mã Authenticator").fill("123456");
  await page.getByRole("button", { name: "Xác nhận và bật 2FA" }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(page.getByText("Đã bật", { exact: true })).toBeVisible();
});

test("the optional 2FA page offers a way back instead of logging out", async ({
  page,
}) => {
  await signIn(page, "0900000002");
  await page.goto("/mfa");
  await page.getByRole("link", { name: "Để sau, quay lại Cài đặt" }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
});

test("turning 2FA off needs the password and current code; a wrong code keeps the session", async ({
  page,
  context,
}) => {
  await signIn(page, "0900000001", "123456");
  await page.goto("/admin/settings");
  const second = await context.newPage();
  await second.goto("/admin/settings");
  await page.getByRole("button", { name: "Tắt 2FA", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Mật khẩu hiện tại")
    .fill("Test-only-Password!");
  await page.getByLabel("Mã Authenticator hiện tại").fill("000000");
  await page.getByRole("button", { name: "Xác nhận tắt 2FA" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Mật khẩu hoặc mã xác thực không đúng" }),
  ).toBeVisible();
  expect(
    (await context.cookies()).some((c) => c.name === ACCESS && c.value),
  ).toBe(true);

  await page
    .getByRole("dialog")
    .getByLabel("Mật khẩu hiện tại")
    .fill("Test-only-Password!");
  await page.getByLabel("Mã Authenticator hiện tại").fill("123456");
  await page.getByRole("button", { name: "Xác nhận tắt 2FA" }).click();
  await expect(page.getByRole("link", { name: "Bật 2FA" })).toBeVisible();
  await expect(page.getByText("Chưa bật", { exact: true })).toBeVisible();
  await expect(second.getByRole("link", { name: "Bật 2FA" })).toBeVisible();

  // Lần đăng nhập sau chỉ cần mật khẩu.
  await page.request.post("/api/auth/logout", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {},
  });
  await signIn(page, "0900000001");
});

test("the disable route rejects a missing code and cross-site posts", async ({
  page,
}) => {
  await signIn(page, "0900000001", "123456");
  const same = { Origin: "http://127.0.0.1:3102" };
  expect(
    (
      await page.request.post("/api/auth/mfa/disable", {
        headers: same,
        data: { password: "Test-only-Password!" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post("/api/auth/mfa/disable", {
        headers: { Origin: "https://evil.example" },
        data: { password: "Test-only-Password!", otp: "123456" },
      })
    ).status(),
  ).toBe(403);
});
