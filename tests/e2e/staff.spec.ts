import { expect, test, type APIRequestContext } from "@playwright/test";

const origin = "http://127.0.0.1:3102";
const fixture = "http://127.0.0.1:3101/__test";
const headers = { Origin: origin, "Content-Type": "application/json" };
const operatorId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const upstreamStaff = `/api/v1/admin/operators/${operatorId}/users`;
const staffInput = {
  fullName: "Nhân viên kiểm thử",
  phone: "0901234567",
  password: "Test-only-Staff-Password!",
  role: "ASSISTANT",
};

async function login(request: APIRequestContext) {
  const response = await request.post("/api/auth/login", {
    headers,
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
  expect(response.ok()).toBe(true);
}

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/reset`);
});

test("manages staff on mobile, including locking, unlocking and confirming deletion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page.request);
  await page.goto("/admin/users");
  const owner = page.getByRole("row", { name: /Test OWNER/ });
  await expect(owner).toBeVisible();
  await expect(owner.getByText("(Bạn)")).toBeVisible();
  // Chính mình: không có Khóa/Xóa trên dòng.
  await expect(owner.getByRole("button", { name: /Xóa|Khóa/ })).toHaveCount(0);
  await owner.getByRole("button", { name: "Chi tiết Test OWNER" }).click();
  const ownDialog = page.getByRole("dialog", { name: "Sửa nhân viên" });
  await expect(ownDialog.getByLabel("Trạng thái")).toHaveCount(0);
  await expect(
    ownDialog.getByRole("button", { name: "Xóa nhân viên" }),
  ).toHaveCount(0);
  await ownDialog.getByRole("button", { name: "Hủy", exact: true }).click();

  await page.getByRole("button", { name: "Thêm nhân viên" }).click();
  const create = page.getByRole("dialog", { name: "Thêm nhân viên" });
  await create.getByLabel("Họ tên").fill(staffInput.fullName);
  await create.getByLabel("Số điện thoại").fill(staffInput.phone);
  await create.getByLabel("Vai trò").selectOption(staffInput.role);
  await create.getByLabel(/^Mật khẩu/).fill(staffInput.password);
  await create.getByRole("button", { name: "Tạo tài khoản" }).click();

  const created = page.getByRole("row", { name: /Nhân viên kiểm thử/ });
  await expect(created).toContainText("Hoạt động");
  await expect(created).toContainText("Phụ xe");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);

  await created
    .getByRole("button", { name: "Chi tiết Nhân viên kiểm thử" })
    .click();
  const edit = page.getByRole("dialog", { name: "Sửa nhân viên" });
  await edit.getByLabel("Họ tên").fill("Nhân viên đã sửa");
  await edit.getByLabel("Số điện thoại").fill("0901234568");
  await edit.getByLabel("Vai trò").selectOption("DISPATCHER");
  await edit.getByLabel("Trạng thái").selectOption("DISABLED");
  await edit
    .getByLabel("Mật khẩu mới", { exact: false })
    .fill("Test-only-New-Password!");
  await edit.getByRole("button", { name: "Lưu thay đổi" }).click();

  const updated = page.getByRole("row", { name: /Nhân viên đã sửa/ });
  await expect(updated).toContainText("Đã khóa");
  await expect(updated).toContainText("Điều hành");
  await expect(updated).toContainText(/(?:\+84|0)901234568/);

  // Mở khóa ngay trên dòng, có hỏi trước.
  await updated
    .getByRole("button", { name: "Mở khóa Nhân viên đã sửa" })
    .click();
  const unlock = page.getByRole("dialog", { name: "Mở khóa nhân viên" });
  await unlock.getByRole("button", { name: "Xác nhận mở khóa" }).click();
  await expect(updated).toContainText("Hoạt động");
  await expect(
    page.getByText("Đã mở khóa tài khoản Nhân viên đã sửa."),
  ).toBeVisible();

  // Khóa: Hủy thì giữ nguyên, xác nhận thì khóa.
  const lockButton = updated.getByRole("button", {
    name: "Khóa Nhân viên đã sửa",
  });
  await lockButton.click();
  const lock = page.getByRole("dialog", { name: "Khóa nhân viên" });
  await expect(lock).toContainText("Nhân viên đã sửa");
  await expect(lock).toContainText("không đăng nhập được");
  await lock.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(lock).toHaveCount(0);
  await expect(updated).toContainText("Hoạt động");
  await lockButton.click();
  await lock.getByRole("button", { name: "Xác nhận khóa" }).click();
  await expect(updated).toContainText("Đã khóa");
  await expect(
    page.getByText("Đã khóa tài khoản Nhân viên đã sửa."),
  ).toBeVisible();

  // Lọc theo trạng thái (có số đếm) và vai trò.
  const statusTabs = page.getByRole("group", { name: "Trạng thái tài khoản" });
  await expect(
    statusTabs.getByRole("button", { name: /Tất cả/ }),
  ).toContainText("2");
  await statusTabs.getByRole("button", { name: /Đã khóa/ }).click();
  await expect(updated).toBeVisible();
  await expect(owner).toHaveCount(0);
  await statusTabs.getByRole("button", { name: /Tất cả/ }).click();
  await page.getByLabel("Lọc theo vai trò").selectOption("OWNER");
  await expect(owner).toBeVisible();
  await expect(updated).toHaveCount(0);
  await page.getByLabel("Lọc theo vai trò").selectOption("");

  // Xóa nằm trong hộp Chi tiết, vẫn hỏi xác nhận.
  await updated
    .getByRole("button", { name: "Chi tiết Nhân viên đã sửa" })
    .click();
  await edit.getByRole("button", { name: "Xóa nhân viên" }).click();
  const remove = page.getByRole("dialog", { name: "Xóa nhân viên" });
  await expect(remove).toContainText("Nhân viên đã sửa");
  await remove.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(updated).toBeVisible();
  await updated
    .getByRole("button", { name: "Chi tiết Nhân viên đã sửa" })
    .click();
  await edit.getByRole("button", { name: "Xóa nhân viên" }).click();
  await remove.getByRole("button", { name: "Xác nhận xóa" }).click();
  await expect(updated).toHaveCount(0);
  await expect(page.getByText("Đã xóa tài khoản nhân viên.")).toBeVisible();
  await page.reload();
  await expect(owner).toBeVisible();
  await expect(updated).toHaveCount(0);
});

test("staff table sorts by column and pages 25 rows at a time", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page.request);
  for (let i = 1; i <= 26; i++) {
    const res = await page.request.post("/api/staff", {
      headers,
      data: {
        ...staffInput,
        fullName: `NV ${String(i).padStart(2, "0")}`,
        phone: `09012${String(i).padStart(5, "0")}`,
      },
    });
    expect(res.status()).toBe(201);
  }
  await page.goto("/admin/users");
  const table = page.getByRole("table");
  await expect(page.getByText("1–25 trên 27 nhân viên")).toBeVisible();
  await table.getByRole("button", { name: "Họ tên" }).click();
  await expect(
    table.getByRole("columnheader", { name: /Họ tên/ }),
  ).toHaveAttribute("aria-sort", "ascending");
  await expect(table.getByRole("row").nth(1)).toContainText("NV 01");
  await table.getByRole("button", { name: /Họ tên/ }).click();
  await expect(table.getByRole("row").nth(1)).toContainText("Test OWNER");
  await page.getByRole("button", { name: "Sau" }).click();
  await expect(page.getByText("26–27 trên 27 nhân viên")).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(3);
});

test("staff BFF enforces session, permission, mutation headers, tenant and self guards", async ({
  request,
}) => {
  expect((await request.get("/api/staff")).status()).toBe(401);
  await login(request);
  const list = await request.get("/api/staff");
  expect(list.status()).toBe(200);
  expect(list.headers()["cache-control"]).toContain("no-store");
  expect(await list.json()).toMatchObject({
    users: expect.arrayContaining([
      expect.objectContaining({ id: ownerId, status: "ACTIVE" }),
    ]),
  });
  expect((await request.get("/api/staff?operatorId=other")).status()).toBe(400);
  expect(
    (
      await request.post("/api/staff", {
        headers,
        data: { ...staffInput, operatorId },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/staff", {
        headers,
        data: { ...staffInput, role: "PLATFORM_ADMIN" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/staff", {
        headers: { ...headers, Origin: "https://other.example" },
        data: staffInput,
      })
    ).status(),
  ).toBe(403);

  const owner = `/api/staff/${ownerId}`;
  expect(
    (
      await request.patch(owner, { headers, data: { status: "DISABLED" } })
    ).status(),
  ).toBe(403);
  expect((await request.delete(owner, { headers })).status()).toBe(403);
  expect(
    (await request.delete(owner, { headers: { Origin: origin } })).status(),
  ).toBe(415);

  await request.post(`${fixture}/state`, {
    data: { permissions: ["trip.read"] },
  });
  expect((await request.get("/api/staff")).status()).toBe(403);
  expect(
    (await request.post("/api/staff", { headers, data: staffInput })).status(),
  ).toBe(403);

  const { requests } = await (await request.get(`${fixture}/state`)).json();
  expect(
    requests.filter((entry: { path: string }) =>
      entry.path.startsWith(upstreamStaff),
    ),
  ).toEqual([
    expect.objectContaining({ method: "GET", path: upstreamStaff, query: "" }),
  ]);
});
