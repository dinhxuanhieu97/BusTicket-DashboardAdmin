import { expect, test, type APIRequestContext } from "@playwright/test";

const fixture = "http://127.0.0.1:3101/__test";
const headers = {
  Origin: "http://127.0.0.1:3102",
  "Content-Type": "application/json",
};
const tripQuery = "/api/live/trips?date=2026-11-11";
const password = "Test-only-Staff-Password!";

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/reset`);
  const login = await request.post("/api/auth/login", {
    headers,
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
  expect(login.status()).toBe(200);
});

async function addStaff(owner: APIRequestContext, role: string) {
  const phone = "0909876543";
  const result = await owner.post("/api/staff", {
    headers,
    data: { fullName: "Nhân viên phân quyền", phone, password, role },
  });
  expect(result.status()).toBe(201);
  const { id } = await result.json();
  return { id, phone };
}

const cases = [
  {
    role: "DISPATCHER",
    label: "Điều hành",
    menu: ["Tổng quan", "Chuyến xe", "Lịch tự động", "Cài đặt"],
    readable: [tripQuery, "/api/trip-management/options"],
    forbidden: ["/api/live/payments", "/api/live/audit-logs"],
    deniedPage: "/admin/payments",
  },
  {
    role: "ACCOUNTANT",
    label: "Kế toán",
    menu: ["Tổng quan", "Chuyến xe", "Sổ thu", "Nhật ký", "Cài đặt"],
    readable: [tripQuery, "/api/live/payments", "/api/live/audit-logs"],
    forbidden: ["/api/trip-management/options"],
    deniedPage: "/admin/schedules",
  },
  {
    role: "SELLER",
    label: "Bán vé",
    menu: ["Tổng quan", "Chuyến xe", "Sổ thu", "Cài đặt"],
    readable: [tripQuery, "/api/live/payments"],
    forbidden: [
      "/api/live/audit-logs",
      "/api/trip-management/options",
      "/api/assigned-trips",
    ],
    deniedPage: "/admin/audit-logs",
  },
  {
    role: "ASSISTANT",
    label: "Phụ xe",
    menu: ["Chuyến được giao", "Cài đặt"],
    readable: ["/api/assigned-trips"],
    forbidden: [
      tripQuery,
      "/api/live/payments",
      "/api/operations/profile",
      "/api/trip-management/44444444-4444-4444-8444-444444444444",
      "/api/trip-management/44444444-4444-4444-8444-444444444444/assistants",
    ],
    deniedPage: "/admin/trips",
  },
];

for (const { role, label, menu, readable, forbidden, deniedPage } of cases) {
  test(`${role} sees only its permitted menus, pages and APIs`, async ({
    request,
    page,
  }) => {
    const { phone } = await addStaff(request, role);
    await page.goto("/login");
    await page.getByLabel("Số điện thoại", { exact: true }).fill(phone);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(
      role === "ASSISTANT" ? /\/admin\/assigned-trips$/ : /\/admin$/,
    );

    const nav = page.getByRole("navigation", { name: "Điều hướng quản trị" });
    await expect(nav.getByRole("link")).toHaveText(menu);
    for (const path of readable)
      expect((await page.request.get(path)).status()).toBe(200);
    for (const path of [
      ...forbidden,
      "/api/staff",
      "/api/operations/payment-account",
    ])
      expect((await page.request.get(path)).status()).toBe(403);
    const profileWrite = await page.request.put("/api/operations/profile", {
      headers,
      data: { name: "Blocked profile write", defaultDepartureTime: "17:30" },
    });
    expect(profileWrite.status()).toBe(403);
    await page.goto(deniedPage);
    if (role === "ASSISTANT") {
      // Phụ xe bị đưa về trang chuyến được giao thay vì trang cài đặt.
      await expect(page).toHaveURL(/\/admin\/assigned-trips$/);
      await page.goto("/admin/settings");
    }
    await expect(page).toHaveURL(/\/admin\/settings$/);
    await expect(
      page.getByRole("definition").filter({ hasText: label }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Thông tin chung" }),
    ).toHaveCount(0);
  });
}

test("an OWNER can lock an active staff session and prevent new login until unlocking", async ({
  request,
  browser,
  baseURL,
}) => {
  const { id, phone } = await addStaff(request, "SELLER");
  const current = await browser.newContext({ baseURL });
  const fresh = await browser.newContext({ baseURL });
  try {
    const login = (context: typeof current) =>
      context.request.post("/api/auth/login", {
        headers,
        data: { phone, password, rememberMe: true },
      });
    expect((await login(current)).status()).toBe(200);
    await current.clearCookies({ name: "pnticket_owner_session" });
    const resumed = await current.request.get("/api/auth/session");
    expect(resumed.status()).toBe(200);
    expect((await resumed.json()).user.role).toBe("SELLER");
    const status = (value: string) =>
      request.patch(`/api/staff/${id}`, { headers, data: { status: value } });
    expect((await status("DISABLED")).status()).toBe(200);
    expect((await current.request.get("/api/auth/session")).status()).toBe(401);
    const denied = await login(fresh);
    expect(denied.status()).toBe(401);
    expect((await denied.json()).error.code).toBe("INVALID_CREDENTIALS");
    expect(await fresh.cookies()).toHaveLength(0);
    expect((await status("ACTIVE")).status()).toBe(200);
    expect((await login(fresh)).status()).toBe(200);
  } finally {
    await current.close();
    await fresh.close();
  }
});
