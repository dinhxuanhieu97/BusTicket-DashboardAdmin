import { expect, test } from "@playwright/test";

const fixture = "http://127.0.0.1:3101/__test";
const headers = {
  Origin: "http://127.0.0.1:3102",
  "Content-Type": "application/json",
};
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
]);

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/reset`);
});

test("login shows the configured operator's name instead of PNTicket", async ({
  page,
}) => {
  await page.goto("/login");
  const brand = page.getByTestId("auth-brand");
  await expect(brand).toContainText("Nhà xe kiểm thử");
  await expect(brand.locator("img")).toHaveCount(0);
  await expect(page.getByText("PNTicket", { exact: true })).toHaveCount(0);
  await expect(page).toHaveTitle("Trang quản trị · Nhà xe kiểm thử");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/icon.svg",
  );
  await page.getByRole("link", { name: "Quên mật khẩu?" }).click();
  await expect(page.getByTestId("auth-brand")).toContainText("Nhà xe kiểm thử");
});

test("brand block is hidden when the operator brand is not available", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/state`, { data: { brandMissing: true } });
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Đăng nhập quản trị" }),
  ).toBeVisible();
  await expect(page.getByTestId("auth-brand")).toHaveCount(0);
  await expect(page.getByText("PNTicket", { exact: true })).toHaveCount(0);
  await expect(page).toHaveTitle("Trang quản trị");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/icon.svg",
  );
});

test("OWNER uploads a logo in Settings; login and menu show it; removing it falls back to the initial", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const login = await context.request.post("/api/auth/login", {
    headers,
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
  expect(login.status()).toBe(200);
  await page.goto("/admin/settings?tab=general");
  await expect(page).toHaveTitle("Trang quản trị · Nhà xe kiểm thử");
  const section = page.getByRole("region", { name: "Logo nhà xe" });
  await section.getByLabel("Chọn tệp logo").setInputFiles({
    name: "note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("x"),
  });
  await expect(
    page.getByText("Logo phải là ảnh PNG, JPEG hoặc WebP"),
  ).toBeVisible();

  await section
    .getByLabel("Chọn tệp logo")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(
    page.getByRole("status").getByText("Đã cập nhật logo."),
  ).toBeVisible();
  await expect(section.locator("img")).toHaveAttribute(
    "src",
    /^\/api\/brand\/logo\/TEST\?v=\d+$/,
  );
  await expect(page.locator("aside img, nav img").first()).toBeAttached();

  const guest = await browser.newContext({ baseURL });
  try {
    const p = await guest.newPage();
    await p.goto("/login");
    const img = p.getByTestId("auth-brand").locator("img");
    await expect(img).toHaveAttribute("src", /^\/api\/brand\/logo\/TEST\?v=/);
    const src = (await img.getAttribute("src"))!;
    await expect(p.locator('link[rel="icon"]')).toHaveAttribute("href", src);
    const res = await guest.request.get(src);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.compare(await res.body(), PNG)).toBe(0);
  } finally {
    await guest.close();
  }

  await section.getByRole("button", { name: "Xóa logo" }).click();
  await expect(
    page.getByRole("status").getByText("Đã xóa logo."),
  ).toBeVisible();
  await expect(section.locator("img")).toHaveCount(0);
  await page.reload();
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/icon.svg",
  );
  await page.goto("/login");
  await expect(page).toHaveURL(/\/admin/);
});

test("logo routes validate type, size, origin and code", async ({
  context,
  request,
}) => {
  expect((await request.get("/api/brand/logo/TEST")).status()).toBe(404);
  expect((await request.get("/api/brand/logo/bad-code")).status()).toBe(404);
  const login = await context.request.post("/api/auth/login", {
    headers,
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
  expect(login.status()).toBe(200);
  const put = (data: Buffer, type: string, origin = headers.Origin) =>
    context.request.put("/api/operations/logo", {
      headers: { Origin: origin, "Content-Type": type },
      data,
    });
  expect((await put(Buffer.from("<svg/>"), "image/svg+xml")).status()).toBe(
    415,
  );
  expect(
    (
      await put(Buffer.concat([PNG, Buffer.alloc(205 * 1024)]), "image/png")
    ).status(),
  ).toBe(400);
  expect(
    (await put(PNG, "image/png", "https://other-site.example")).status(),
  ).toBe(403);
  expect((await put(PNG, "image/png")).status()).toBe(200);
  expect((await request.get("/api/brand/logo/TEST")).status()).toBe(200);
});
