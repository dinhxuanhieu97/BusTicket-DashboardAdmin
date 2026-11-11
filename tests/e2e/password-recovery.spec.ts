import { expect, test, type Page } from "@playwright/test";

const fixture = "http://127.0.0.1:3101/__test";
const headers = {
  Origin: "http://127.0.0.1:3102",
  "Content-Type": "application/json",
};
const owner = {
  phone: "0900000001",
  password: "Test-only-Password!",
  otp: "123456",
};
const temp = "Test-only-Temp-Password!";
const fresh = "Test-only-New-Password!";

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/reset`);
});

async function fillPair(page: Page, value: string, confirm = value) {
  await page.locator("#new-password").fill(value);
  await page.locator("#confirm-password").fill(confirm);
}

test("login links to forgot password; 2FA reset succeeds and wrong code shows a generic error", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Quên mật khẩu?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByText("Chủ nhà xe chưa bật 2FA:")).toBeVisible();

  const form = page.getByRole("form", { name: "Đặt lại mật khẩu bằng 2FA" });
  await page.locator("#reset-phone").fill(owner.phone);
  await page.locator("#reset-otp").fill("000000");
  await fillPair(page, fresh);
  await form.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
  await expect(form.getByRole("alert")).toContainText(
    "Số điện thoại hoặc mã xác thực không đúng",
  );

  await fillPair(page, fresh, "Test-only-Mismatch!");
  await page.locator("#reset-otp").fill(owner.otp);
  await form.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
  await expect(form.getByRole("alert")).toContainText("không khớp");

  await fillPair(page, fresh);
  await form.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
  await expect(page.getByText("Đã đặt lại mật khẩu.")).toBeVisible();
  await page.getByRole("link", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("reset API validates input and rejects cross-site requests", async ({
  request,
}) => {
  const post = (data: unknown, h = headers) =>
    request.post("/api/auth/password/reset", { headers: h, data });
  expect(
    (
      await post({ phone: owner.phone, otp: "12345", newPassword: fresh })
    ).status(),
  ).toBe(400);
  expect(
    (
      await post({ phone: owner.phone, otp: owner.otp, newPassword: "short" })
    ).status(),
  ).toBe(400);
  expect(
    (
      await post(
        { phone: owner.phone, otp: owner.otp, newPassword: fresh },
        { ...headers, Origin: "https://other-site.example" },
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await post({ phone: owner.phone, otp: owner.otp, newPassword: fresh })
    ).status(),
  ).toBe(200);
});

test("OWNER sets a temporary password; staff must change it before using the dashboard", async ({
  page,
  request,
}) => {
  const login = await request.post("/api/auth/login", {
    headers,
    data: owner,
  });
  expect(login.status()).toBe(200);
  const created = await request.post("/api/staff", {
    headers,
    data: {
      fullName: "Bán vé quên mật khẩu",
      phone: "0909876601",
      password: "Test-only-First-Password!",
      role: "SELLER",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const reset = await request.patch(`/api/staff/${id}`, {
    headers,
    data: { password: temp },
  });
  expect(reset.status()).toBe(200);

  await page.goto("/login");
  await page.locator("#phone").fill("0909876601");
  await page.locator("#password").fill(temp);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/change-password$/);

  // Mọi API quản trị bị chặn và /admin chuyển về trang đổi mật khẩu.
  expect((await page.request.get("/api/staff")).status()).toBe(403);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/change-password$/);

  const form = page.getByRole("form", { name: "Đổi mật khẩu" });
  await page.locator("#current-password").fill(temp);
  await fillPair(page, temp);
  await form.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(form.getByRole("alert")).toContainText("khác");

  await page.locator("#current-password").fill(temp);
  await fillPair(page, fresh);
  await form.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(page).toHaveURL(/\/admin(\/|$)/);
  expect((await page.request.get("/api/auth/session")).status()).toBe(200);
  await page.goto("/change-password");
  await expect(page).toHaveURL(/\/admin\/settings$/);
});

test("Settings lets a signed-in user change their own password", async ({
  page,
  context,
}) => {
  const login = await context.request.post("/api/auth/login", {
    headers,
    data: owner,
  });
  expect(login.status()).toBe(200);
  await page.goto("/admin/settings");
  const section = page.getByRole("region", { name: "Đổi mật khẩu" });
  await section.locator("#current-password").fill("Test-only-Wrong-Password!");
  await fillPair(page, fresh);
  await section.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(section.getByRole("alert")).toContainText(
    "Mật khẩu hiện tại không đúng.",
  );

  await section.locator("#current-password").fill(owner.password);
  await section.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(
    section.getByText("Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất."),
  ).toBeVisible();
  // Phiên hiện tại được cấp lại nên vẫn dùng tiếp được.
  await page.reload();
  await expect(page).toHaveURL(/\/admin\/settings$/);
});
