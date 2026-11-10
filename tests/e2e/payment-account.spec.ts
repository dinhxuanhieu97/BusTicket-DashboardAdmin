import { expect, test } from "@playwright/test";

const fixture = "http://127.0.0.1:3101";
const headers = { Origin: "http://127.0.0.1:3102" };
const path = "/api/operations/payment-account";

test.beforeEach(async ({ context, request }) => {
  await request.post(fixture + "/__test/reset");
  const login = await context.request.post("/api/auth/login", {
    headers,
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
  expect(login.ok()).toBe(true);
});

test("owner saves the receiving account in General Information", async ({
  page,
  context,
}) => {
  await page.goto("/admin/settings?tab=general");
  const form = page.getByRole("region", { name: "Tài khoản nhận tiền" });
  await form.getByLabel("Mã ngân hàng").fill("mb");
  await form.getByLabel("Số tài khoản").fill("0000000123");
  await form.getByLabel("Tên chủ tài khoản").fill("TAI KHOAN KIEM THU");
  await form
    .getByLabel("API Key webhook SePay")
    .fill("fixture-only-webhook-key-0000");
  await form.getByRole("button", { name: "Lưu tài khoản nhận tiền" }).click();
  await expect(form.getByRole("status")).toHaveText(
    "Đã lưu tài khoản nhận tiền.",
  );
  await page.reload();
  await expect(form.getByLabel("Mã ngân hàng")).toHaveValue("MB");
  await expect(form.getByLabel("Số tài khoản")).toHaveValue("0000000123");
  await expect(form.getByLabel("Tên chủ tài khoản")).toHaveValue(
    "TAI KHOAN KIEM THU",
  );
  await expect(form.getByLabel("API Key webhook SePay")).toHaveValue("");
  const response = await context.request.get(path);
  expect(await response.json()).toEqual({
    account: {
      bankCode: "MB",
      accountNumber: "0000000123",
      accountName: "TAI KHOAN KIEM THU",
      reconcileEnabled: false,
    },
  });
});

test("configuration requires permission and accepts writes only from the dashboard origin", async ({
  context,
  request,
}) => {
  const foreign = await context.request.put(path, {
    headers: { Origin: "https://example.invalid" },
    data: {},
  });
  expect(foreign.status()).toBe(403);
  await request.post(fixture + "/__test/state", {
    data: { permissions: ["policy.read"] },
  });
  const forbidden = await context.request.get(path);
  expect(forbidden.status()).toBe(403);
});
