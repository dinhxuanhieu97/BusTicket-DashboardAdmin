import { expect, test } from "@playwright/test";

// Chính sách đặt vé (cọc cố định) đi qua cổng operations: chỉ OWNER đủ 2FA, chỉ ghi từ đúng origin dashboard.
const fixture = "http://127.0.0.1:3101";
const headers = { Origin: "http://127.0.0.1:3102" };
const path = "/api/operations/policy";

test.beforeEach(async ({ request }) => {
  await request.post(fixture + "/__test/reset");
});

test("owner reads the policy and sets a fixed deposit", async ({ context }) => {
  const login = await context.request.post("/api/auth/login", {
    headers,
    data: {
      phone: "0900000001",
      password: "Test-only-Password!",
      otp: "123456",
    },
  });
  expect(login.ok()).toBe(true);
  const current = await (await context.request.get(path)).json();
  expect(current.fixedDeposit).toBeNull();
  const saved = await context.request.put(path, {
    headers,
    data: {
      holdMinutes: current.holdMinutes,
      maxUnitsPerBooking: current.maxUnitsPerBooking,
      childPolicy: current.childPolicy,
      fixedDeposit: { single: 300000, double: 450000 },
    },
  });
  expect(saved.ok()).toBe(true);
  expect((await saved.json()).fixedDeposit).toEqual({
    single: 300000,
    double: 450000,
  });
  const foreign = await context.request.put(path, {
    headers: { Origin: "https://example.invalid" },
    data: { holdMinutes: 10 },
  });
  expect(foreign.status()).toBe(403);
});

test("policy is not readable without a session", async ({ request }) => {
  const res = await request.get(path);
  expect(res.ok()).toBe(false);
});
