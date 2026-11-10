import { test, expect } from "@playwright/test";
const headers = {
  Origin: "http://127.0.0.1:3102",
  "Content-Type": "application/json",
};
test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:3101/__test/reset");
});
async function signIn(request: import("@playwright/test").APIRequestContext) {
  await request.post("/api/auth/login", {
    headers,
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
}
test("OWNER creates draft in Vietnam time, views detail and opens/closes sales", async ({
  page,
  context,
  request,
}) => {
  await signIn(context.request);
  await page.goto("/admin/trips");
  await page.getByRole("button", { name: "+ Thêm chuyến" }).click();
  await page.getByRole("button", { name: "Chỉ tạo một chiều" }).click();
  await page
    .getByLabel("Tuyến", { exact: true })
    .selectOption("66666666-6666-4666-8666-666666666666");
  await page
    .getByLabel("Xe", { exact: true })
    .selectOption("77777777-7777-4777-8777-777777777777");
  await page.getByLabel("Tên chuyến", { exact: true }).fill("Chuyến mới PN");
  await page.getByLabel("Khởi hành", { exact: true }).fill("2027-12-01T00:30");
  await page.getByLabel("Mở bán từ", { exact: true }).fill("2027-11-01T00:00");
  await page
    .getByLabel("Đóng bán lúc", { exact: true })
    .fill("2027-12-01T00:00");
  await page
    .getByLabel("Giá Tầng dưới · 1 người (VND)", { exact: true })
    .fill("250000");
  await page.getByRole("button", { name: "Lưu nháp", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("250.000");
  await page.getByRole("button", { name: "Xác nhận lưu nháp" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const row = page.getByRole("row").filter({ hasText: "Chuyến mới PN" });
  await expect(row).toContainText("Bản nháp");
  await expect(page.getByLabel("Ngày khởi hành · Giờ Việt Nam")).toHaveValue(
    "2027-12-01",
  );
  await row.getByRole("button", { name: "Chi tiết", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("00:30");
  await expect(dialog).toContainText("700.000");
  await expect(dialog).toContainText("Sơ đồ phòng");
  await expect(dialog).toContainText("giờ mặc định PN");
  await expect(dialog).toContainText("Xe đã đổi sang sơ đồ khác");
  await expect(dialog.locator('[data-seat="A2"]')).toHaveAttribute(
    "data-status",
    "HELD",
  );
  await expect(dialog.locator('[data-seat="B1"]')).toHaveAttribute(
    "data-status",
    "BOOKED",
  );
  await expect(dialog.locator('[data-seat="B2"]')).toHaveAttribute(
    "data-status",
    "BLOCKED",
  );
  await expect(dialog).not.toContainText("+84");
  await page
    .getByRole("button", { name: "Làm mới", exact: true })
    .last()
    .click();
  await expect(dialog.locator('[data-seat="A1"]')).toBeVisible();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await row.getByRole("button", { name: "Mở bán", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận mở bán" }).click();
  await expect(row).toContainText("Đang mở bán");
  await row.getByRole("button", { name: "Đóng bán", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận đóng bán" }).click();
  await expect(row).toContainText("Đã đóng bán");
  const state = await (
    await request.get("http://127.0.0.1:3101/__test/state")
  ).json();
  const writes = state.requests.filter(
    (r: any) => r.method === "POST" && r.path.endsWith("/trips"),
  );
  expect(writes).toHaveLength(1);
  expect(writes[0].body.departAt).toBe("2027-11-30T17:30:00.000Z");
  expect(writes[0].body.fares[0].price).toBe(250000);
});
test("trip mutation boundary rejects unauthenticated, CSRF, tenant injection and other writes", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/trip-management", { headers, data: {} })
    ).status(),
  ).toBe(401);
  await signIn(request);
  expect(
    (
      await request.post("/api/trip-management", {
        headers: { ...headers, Origin: "https://evil.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/trip-management", {
        headers,
        data: { operatorId: "other" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.patch("/api/trip-management/not-uuid/status", {
        headers,
        data: { status: "OPEN" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (await request.post("/api/live/payments", { headers, data: {} })).status(),
  ).toBe(405);
  expect(
    (await request.patch("/api/live/users", { headers, data: {} })).status(),
  ).toBe(405);
  expect(
    (await request.delete("/api/trip-management", { headers })).status(),
  ).toBe(405);
  await request.post("/api/auth/logout", { headers, data: {} });
  await request.post("/api/auth/login", {
    headers,
    data: { phone: "0900000002", password: "Test-only-Password!" },
  });
  expect(
    (
      await request.post("/api/trip-management", { headers, data: {} })
    ).status(),
  ).toBe(403);
});
test("create OPEN validates tenant resources and exact fare coverage before forwarding", async ({
  request,
}) => {
  await signIn(request);
  const body = {
    routeId: "66666666-6666-4666-8666-666666666666",
    vehicleId: "77777777-7777-4777-8777-777777777777",
    name: "Chuyến mở bán",
    departAt: "2027-12-01T01:00:00.000Z",
    salesOpenAt: "2027-11-01T00:00:00.000Z",
    salesCloseAt: "2027-12-01T00:00:00.000Z",
    fares: [{ floor: "1", occupancy: 1, price: 300000 }],
    status: "OPEN",
  };
  for (const invalid of [
    { ...body, operatorId: "other" },
    { ...body, routeId: "99999999-9999-4999-8999-999999999999" },
    { ...body, fares: [{ floor: "2", occupancy: 1, price: 300000 }] },
  ])
    expect(
      (
        await request.post("/api/trip-management", { headers, data: invalid })
      ).status(),
    ).toBe(400);
  expect(
    (
      await request.post("/api/trip-management", { headers, data: body })
    ).status(),
  ).toBe(400);
  const keyed = { ...headers, "Idempotency-Key": "e2e-trip-key-0001" };
  const response = await request.post("/api/trip-management", {
    headers: keyed,
    data: body,
  });
  expect(response.status()).toBe(201);
  const created = (await response.json()).trip;
  expect(created.status).toBe("OPEN");
  const retry = await request.post("/api/trip-management", {
    headers: keyed,
    data: body,
  });
  expect((await retry.json()).trip.id).toBe(created.id);
  const state = await (
    await request.get("http://127.0.0.1:3101/__test/state")
  ).json();
  expect(
    state.requests.filter(
      (r: any) => r.method === "POST" && r.path.endsWith("/trips"),
    ),
  ).toHaveLength(2);
  expect(
    new Set(
      state.requests
        .filter((r: any) => r.method === "POST" && r.path.endsWith("/trips"))
        .map((r: any) => r.body.name),
    ).size,
  ).toBe(1);
});
test("trip detail reads fares and seat map; read-only and mobile friendly", async ({
  page,
  context,
  request,
}) => {
  expect(
    (
      await request.get(
        "/api/trip-management/44444444-4444-4444-8444-444444444444",
      )
    ).status(),
  ).toBe(401);
  await signIn(context.request);
  expect(
    (await context.request.get("/api/trip-management/not-a-uuid")).status(),
  ).toBe(400);
  const res = await context.request.get(
    "/api/trip-management/44444444-4444-4444-8444-444444444444",
  );
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toContain("no-store");
  expect((await res.json()).fares).toHaveLength(4);
  const options = await (
    await context.request.get("/api/trip-management/options")
  ).json();
  expect(options.vehicles.find((v: any) => v.code === "TEST02")).toMatchObject({
    usable: true,
    layoutName: "Sơ đồ kiểm thử (bản cũ)",
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/admin/trips?date=2027-02-05");
  await page.getByLabel("Ngày khởi hành · Giờ Việt Nam").fill("2027-02-05");
  await page
    .getByRole("button", { name: "Chi tiết", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator('[data-seat="B2"]')).toBeVisible();
  await expect(dialog).toContainText("420.000");
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  const state = await (
    await request.get("http://127.0.0.1:3101/__test/state")
  ).json();
  expect(
    state.requests.filter(
      (r: any) => r.method !== "GET" && r.path.includes("/trips"),
    ),
  ).toHaveLength(0);
});
