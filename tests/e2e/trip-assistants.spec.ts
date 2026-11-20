import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
} from "@playwright/test";

const fixture = "http://127.0.0.1:3101/__test";
const headers = {
  Origin: "http://127.0.0.1:3102",
  "Content-Type": "application/json",
};
const TRIP = "44444444-4444-4444-8444-444444444444";
const OTHER_TRIP = "55555555-5555-4555-8555-555555555555";
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

async function addStaff(owner: APIRequestContext, role: string, phone: string) {
  const result = await owner.post("/api/staff", {
    headers,
    data: { fullName: `Phụ xe ${phone.slice(-2)}`, phone, password, role },
  });
  expect(result.status()).toBe(201);
  return { id: (await result.json()).id as string, phone };
}

async function staffContext(browser: Browser, baseURL: string, phone: string) {
  const context = await browser.newContext({ baseURL });
  const login = await context.request.post("/api/auth/login", {
    headers,
    data: { phone, password },
  });
  expect(login.status()).toBe(200);
  return context;
}

test("OWNER assigns an assistant in trip detail; the assistant sees only that trip and its passengers", async ({
  page,
  context,
  request,
  browser,
  baseURL,
}) => {
  const assistant = await addStaff(request, "ASSISTANT", "0909876501");
  const owner = await context.request.post("/api/auth/login", {
    headers,
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
  expect(owner.status()).toBe(200);
  await page.goto("/admin/trips?date=2027-02-05");
  await page.getByLabel("Ngày khởi hành · Giờ Việt Nam").fill("2027-02-05");
  await page
    .getByRole("button", { name: "Chi tiết", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  const section = dialog.getByRole("region", { name: "Phụ xe phụ trách" });
  const save = section.getByRole("button", { name: "Lưu phân công" });
  await expect(save).toBeDisabled();
  await section.getByRole("checkbox", { name: /Phụ xe 01/ }).check();
  await save.click();
  await expect(section).toContainText("Đã lưu phân công phụ xe.");
  await expect(save).toBeDisabled();

  const ctx = await staffContext(browser, baseURL!, assistant.phone);
  try {
    const p = await ctx.newPage();
    await p.goto("/admin");
    await expect(p).toHaveURL(/\/admin\/assigned-trips$/);
    const nav = p.getByRole("navigation", { name: "Điều hướng quản trị" });
    await expect(nav.getByRole("link")).toHaveText([
      "Chuyến được giao",
      "Cài đặt",
    ]);
    await expect(
      p.getByRole("list", { name: "Chuyến được giao" }).getByRole("button"),
    ).toHaveCount(1);
    const table = p.getByRole("table");
    await expect(table).toContainText("Khách Kiểm Thử Một");
    await expect(table).toContainText("+84912000001");
    await expect(table).toContainText("A1 (2), A2 +1 bé");
    await expect(table).toContainText("Đón ở ngã tư");
    await expect(p.getByText("Còn thu: 440.000")).toBeVisible();

    // Chuyến không được giao, hoặc API quản trị chuyến chung, đều bị chặn.
    expect(
      (
        await ctx.request.get(`/api/assigned-trips/${OTHER_TRIP}/passengers`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await ctx.request.get(`/api/assigned-trips/not-a-uuid/passengers`)
      ).status(),
    ).toBe(400);
    expect(
      (await ctx.request.get(`/api/trip-management/${TRIP}`)).status(),
    ).toBe(403);
    const self = await ctx.request.put(
      `/api/trip-management/${TRIP}/assistants`,
      { headers, data: { userIds: [assistant.id] } },
    );
    expect(self.status()).toBe(403);

    // Gỡ phân công → mất quyền xem ngay.
    const revoke = await request.put(
      `/api/trip-management/${TRIP}/assistants`,
      {
        headers,
        data: { userIds: [] },
      },
    );
    expect(revoke.status()).toBe(200);
    expect(
      (
        await ctx.request.get(`/api/assigned-trips/${TRIP}/passengers`)
      ).status(),
    ).toBe(404);
    await p.reload();
    await expect(
      p.getByText("Chưa có chuyến nào được giao cho bạn."),
    ).toBeVisible();
  } finally {
    await ctx.close();
  }
});

test("locking an assigned assistant ends their session and removes them from the choices", async ({
  request,
  browser,
  baseURL,
}) => {
  const assistant = await addStaff(request, "ASSISTANT", "0909876502");
  const put = (userIds: string[]) =>
    request.put(`/api/trip-management/${TRIP}/assistants`, {
      headers,
      data: { userIds },
    });
  expect((await put([assistant.id])).status()).toBe(200);
  const ctx = await staffContext(browser, baseURL!, assistant.phone);
  try {
    expect((await ctx.request.get("/api/assigned-trips")).status()).toBe(200);
    const lock = await request.patch(`/api/staff/${assistant.id}`, {
      headers,
      data: { status: "DISABLED" },
    });
    expect(lock.status()).toBe(200);
    expect((await ctx.request.get("/api/assigned-trips")).status()).toBe(401);
    const listed = await (
      await request.get(`/api/trip-management/${TRIP}/assistants`)
    ).json();
    expect(listed.candidates).toEqual([]);
    expect(listed.assistants).toEqual([
      expect.objectContaining({ id: assistant.id, active: false }),
    ]);
    expect((await put([assistant.id])).status()).toBe(400);
  } finally {
    await ctx.close();
  }
});

test("DISPATCHER can assign, SELLER only reads the assignment, and bad input is rejected", async ({
  request,
  browser,
  baseURL,
}) => {
  const assistant = await addStaff(request, "ASSISTANT", "0909876503");
  const dispatcher = await addStaff(request, "DISPATCHER", "0909876504");
  const seller = await addStaff(request, "SELLER", "0909876505");
  const dctx = await staffContext(browser, baseURL!, dispatcher.phone);
  const sctx = await staffContext(browser, baseURL!, seller.phone);
  try {
    const assigned = await dctx.request.put(
      `/api/trip-management/${TRIP}/assistants`,
      { headers, data: { userIds: [assistant.id] } },
    );
    expect(assigned.status()).toBe(200);
    const read = await sctx.request.get(
      `/api/trip-management/${TRIP}/assistants`,
    );
    expect(read.status()).toBe(200);
    expect(await read.json()).toMatchObject({
      canAssign: false,
      candidates: [],
      assistants: [expect.objectContaining({ id: assistant.id })],
    });
    const denied = await sctx.request.put(
      `/api/trip-management/${TRIP}/assistants`,
      { headers, data: { userIds: [] } },
    );
    expect(denied.status()).toBe(403);
    for (const data of [
      { userIds: [assistant.id, assistant.id] },
      { userIds: ["not-a-uuid"] },
      {
        userIds: Array.from(
          { length: 6 },
          (_, i) => `00000000-0000-4000-8000-00000000000${i}`,
        ),
      },
      { userIds: [], extra: true },
    ])
      expect(
        (
          await request.put(`/api/trip-management/${TRIP}/assistants`, {
            headers,
            data,
          })
        ).status(),
      ).toBe(400);
    const crossSite = await request.put(
      `/api/trip-management/${TRIP}/assistants`,
      {
        headers: { ...headers, Origin: "https://other-site.example" },
        data: { userIds: [] },
      },
    );
    expect(crossSite.status()).toBe(403);
  } finally {
    await dctx.close();
    await sctx.close();
  }
});
