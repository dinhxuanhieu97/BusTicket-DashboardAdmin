import { expect, test, type APIRequestContext } from "@playwright/test";

const fixture = "http://127.0.0.1:3101/__test";
const headers = {
  Origin: "http://127.0.0.1:3102",
  "Content-Type": "application/json",
};

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/reset`);
});

const signIn = (req: APIRequestContext, phone: string, otp?: string) =>
  req.post("/api/auth/login", {
    headers,
    data: { phone, password: "Test-only-Password!", ...(otp ? { otp } : {}) },
  });

test("platform admin creates operator VHA, then its owner with a one-time temporary password", async ({
  page,
  context,
}) => {
  expect((await signIn(context.request, "0900000003")).status()).toBe(200);
  await page.goto("/platform");
  await expect(page.getByText("2 nhà xe trên nền tảng.")).toBeVisible();

  await page.getByRole("button", { name: "Tạo nhà xe" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo nhà xe" });
  await dialog.getByLabel("Mã nhà xe").fill("vha01");
  await expect(dialog.getByLabel("Mã nhà xe")).toHaveValue("VHA");
  await dialog.getByLabel("Tên nhà xe").fill("Nhà xe Việt Hà");
  await dialog.getByRole("button", { name: "Tạo nhà xe" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText(/Đã tạo nhà xe VHA · Nhà xe Việt Hà/),
  ).toBeVisible();
  await expect(page.getByLabel("Nhà xe", { exact: true })).toHaveValue(
    /^[0-9a-f-]{36}$/,
  );
  await expect(
    page.getByLabel("Nhà xe", { exact: true }).locator("option:checked"),
  ).toHaveText("VHA · Nhà xe Việt Hà");
  await expect(page.getByText("3 nhà xe trên nền tảng.")).toBeVisible();

  await page.getByRole("button", { name: "Tạo nhà xe" }).click();
  await dialog.getByLabel("Mã nhà xe").fill("PN");
  await dialog.getByLabel("Tên nhà xe").fill("Trùng");
  await dialog.getByRole("button", { name: "Tạo nhà xe" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Mã PN đã được dùng.");
  await dialog.getByRole("button", { name: "Hủy" }).click();

  await page.getByRole("button", { name: "Tạo tài khoản chủ xe" }).click();
  const owner = page.getByRole("dialog", { name: "Tạo tài khoản chủ xe" });
  await owner.getByLabel("Họ tên chủ xe").fill("Chủ Việt Hà");
  await owner.getByLabel("Số điện thoại đăng nhập").fill("0909111222");
  await owner
    .locator("#create-owner-admin-password")
    .fill("Test-only-Password!");
  await owner.getByRole("button", { name: "Tạo tài khoản" }).click();
  const done = page.getByRole("dialog", { name: "Đã tạo tài khoản chủ xe" });
  await expect(done.getByTestId("owner-temporary-password")).toHaveText(
    /^[A-Za-z2-9]{16}$/,
  );
  await done.getByRole("button", { name: "Xong" }).click();
  const list = page.getByRole("list", { name: "Chủ xe của Nhà xe Việt Hà" });
  await expect(list).toContainText("Chủ Việt Hà");
  await expect(list).toContainText("Chờ đổi mật khẩu tạm");
});

test("a wrong admin password still creates the owner but asks to set the temporary password", async ({
  page,
  context,
}) => {
  expect((await signIn(context.request, "0900000003")).status()).toBe(200);
  const created = await context.request.post("/api/platform/operators", {
    headers,
    data: { code: "VHA", name: "Nhà xe Việt Hà" },
  });
  expect(created.status()).toBe(201);
  const { operator } = await created.json();
  const res = await context.request.post(
    `/api/platform/operators/${operator.id}/owners`,
    {
      headers,
      data: {
        fullName: "Chủ Việt Hà",
        phone: "0909111222",
        adminPassword: "Test-only-Wrong!",
      },
    },
  );
  expect(res.status()).toBe(403);
  expect((await res.json()).error.code).toBe("OWNER_CREATED_PASSWORD_NOT_SET");
  await page.goto("/platform");
  await page.getByLabel("Nhà xe", { exact: true }).selectOption(operator.id);
  await expect(
    page.getByRole("button", { name: "Đặt mật khẩu tạm cho Chủ Việt Hà" }),
  ).toBeVisible();
});

test("create routes validate code, body, origin and caller", async ({
  context,
  request,
}) => {
  expect(
    (
      await request.post("/api/platform/operators", {
        headers,
        data: { code: "VHA", name: "X" },
      })
    ).status(),
  ).toBe(401);
  expect((await signIn(context.request, "0900000003")).status()).toBe(200);
  const post = (data: unknown, origin = headers.Origin) =>
    context.request.post("/api/platform/operators", {
      headers: { ...headers, Origin: origin },
      data,
    });
  expect((await post({ code: "VHA01", name: "X" })).status()).toBe(400);
  expect((await post({ code: "VHA", name: "X", extra: 1 })).status()).toBe(400);
  expect(
    (
      await post({ code: "VHA", name: "X" }, "https://other-site.example")
    ).status(),
  ).toBe(403);
  expect(
    (
      await context.request.post("/api/platform/operators/not-a-uuid/owners", {
        headers,
        data: { fullName: "A", phone: "0909", adminPassword: "x" },
      })
    ).status(),
  ).toBe(400);

  await context.clearCookies();
  expect((await signIn(context.request, "0900000001", "123456")).status()).toBe(
    200,
  );
  expect((await post({ code: "VHA", name: "X" })).status()).toBe(403);
});
