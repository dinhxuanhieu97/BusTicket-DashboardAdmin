import { test, expect } from "@playwright/test";
const headers = {
  Origin: "http://127.0.0.1:3102",
  "Content-Type": "application/json",
};
const LATE = "55555555-5555-4555-8555-555555555555";
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
async function reinstateBodies(
  request: import("@playwright/test").APIRequestContext,
) {
  const state = await (
    await request.get("http://127.0.0.1:3101/__test/state")
  ).json();
  return state.requests
    .filter(
      (r: { method: string; path: string }) =>
        r.method === "POST" && r.path.endsWith(`/payments/${LATE}/reinstate`),
    )
    .map((r: { body: unknown }) => r.body);
}

test("late payment: old free seat is preselected, taken seats are disabled, confirm re-books", async ({
  page,
  context,
  request,
}) => {
  await signIn(context.request);
  await page.goto("/admin/payments");
  await page
    .getByRole("button", { name: `Chi tiết khoản thu ${LATE}` })
    .click();
  await page.getByRole("button", { name: "Cấp lại chỗ" }).click();

  const dialog = page.getByRole("dialog", {
    name: "Cấp lại chỗ cho tiền về muộn",
  });
  await expect(dialog.getByText("TESTLATE")).toBeVisible();
  await expect(dialog.locator('[data-seat="A1"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // A2 đang được đơn khác giữ, B2 không bán → không chọn được.
  await expect(dialog.locator('[data-seat="A2"]')).toBeDisabled();
  await expect(dialog.locator('[data-seat="B2"]')).toBeDisabled();
  await expect(dialog.getByText(/Tạm tính/)).toBeVisible();

  await dialog.getByLabel(/Ghi chú/).fill("Khách đồng ý giữ chỗ cũ");
  await dialog.getByRole("button", { name: "Xác nhận cấp lại chỗ" }).click();
  await expect(page.getByText(/đã xác nhận vé/)).toBeVisible();
  expect(await reinstateBodies(request)).toEqual([
    {
      legs: [
        {
          tripId: "44444444-4444-4444-8444-444444444444",
          items: [{ seatCode: "A1", occupancy: 1, infantCount: 0 }],
        },
      ],
      note: "Khách đồng ý giữ chỗ cũ",
    },
  ]);
});

test("deselecting every seat disables confirm", async ({ page, context }) => {
  await signIn(context.request);
  await page.goto("/admin/payments");
  await page
    .getByRole("button", { name: `Chi tiết khoản thu ${LATE}` })
    .click();
  await page.getByRole("button", { name: "Cấp lại chỗ" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Cấp lại chỗ cho tiền về muộn",
  });
  await dialog.locator('[data-seat="A1"]').click();
  await expect(
    dialog.getByRole("button", { name: "Xác nhận cấp lại chỗ" }),
  ).toBeDisabled();
});

test("without payment.manage the button is hidden and the proxy refuses the call", async ({
  page,
  context,
  request,
}) => {
  await request.post("http://127.0.0.1:3101/__test/state", {
    data: { permissions: ["payment.read", "payment.record", "trip.read"] },
  });
  await signIn(context.request);
  await page.goto("/admin/payments");
  await page
    .getByRole("button", { name: `Chi tiết khoản thu ${LATE}` })
    .click();
  await expect(page.getByText("Thanh toán trễ")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cấp lại chỗ" })).toHaveCount(
    0,
  );
  const res = await context.request.post(
    `/api/operations/payments/${LATE}/reinstate`,
    { headers, data: { legs: [] } },
  );
  expect(res.status()).toBe(403);
  expect(await reinstateBodies(request)).toEqual([]);
});
