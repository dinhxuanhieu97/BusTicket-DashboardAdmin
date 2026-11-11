import test from "node:test";
import assert from "node:assert/strict";
import {
  assertOperatorSession,
  hasPermission,
  readPath,
  checkOrigin,
  ApiError,
} from "./access-policy";
import { sessionSchema, paymentSchema, type Session } from "./live-contracts";
const operator = "11111111-1111-4111-8111-111111111111";
const session: Session = {
  scope: "full",
  user: {
    id: "22222222-2222-4222-8222-222222222222",
    operatorId: operator,
    fullName: "Test OWNER",
    phone: "+84900000001",
    role: "OWNER",
    mfaEnabled: true,
  },
};
test("operator accounts can sign in and only OWNER can fall back to legacy permissions", () => {
  assert.equal(assertOperatorSession(session), session);
  for (const role of [
    "ACCOUNTANT",
    "DISPATCHER",
    "SELLER",
    "ASSISTANT",
  ] as const) {
    const staff: Session = { ...session, user: { ...session.user, role } };
    assert.equal(assertOperatorSession(staff), staff);
    assert.equal(hasPermission(staff, "trip.read"), false);
    assert.equal(
      hasPermission({ ...staff, permissions: ["trip.read"] }, "trip.read"),
      true,
    );
  }
  assert.throws(
    () =>
      assertOperatorSession({
        ...session,
        user: { ...session.user, role: "PLATFORM_ADMIN" },
      }),
    (e: unknown) => e instanceof ApiError && e.code === "OPERATOR_REQUIRED",
  );
  assert.equal(hasPermission(session, "trip.read"), true);
  assert.equal(
    hasPermission({ ...session, permissions: [] }, "trip.read"),
    false,
  );
  assert.throws(() =>
    assertOperatorSession({
      ...session,
      user: { ...session.user, operatorId: null },
    }),
  );
  const setup: Session = {
    ...session,
    scope: "mfa_setup",
    user: { ...session.user, mfaEnabled: false },
  };
  assert.equal(assertOperatorSession(setup, true), setup);
  assert.throws(() => assertOperatorSession(setup));
  // 2FA tùy chọn: phiên đầy đủ chưa bật 2FA vẫn dùng được; API quyết định có bắt buộc hay không qua `scope`.
  const noMfa: Session = {
    ...session,
    user: { ...session.user, mfaEnabled: false },
  };
  assert.equal(assertOperatorSession(noMfa), noMfa);
});
test("read allowlist fixes tenant server-side and rejects extra filters and writes", () => {
  assert.equal(
    readPath("payments", operator, new URLSearchParams("review=NEEDS_REVIEW")),
    `/api/v1/admin/operators/${operator}/payments?review=NEEDS_REVIEW`,
  );
  for (const params of [
    "operatorId=other",
    "path=payments/manual",
    "review=bad",
  ])
    assert.throws(() =>
      readPath("payments", operator, new URLSearchParams(params)),
    );
  assert.throws(() =>
    readPath("manual" as never, operator, new URLSearchParams()),
  );
  assert.throws(() =>
    readPath("trips", operator, new URLSearchParams("date=2026-02-30")),
  );
  assert.throws(() => readPath("trips", operator, new URLSearchParams()));
  assert.ok(
    readPath(
      "trips",
      operator,
      new URLSearchParams("date=2026-11-09"),
    ).endsWith("date=2026-11-09"),
  );
});
test("cookie-authenticated mutations require configured same origin and JSON", () => {
  const request = (
    origin: string,
    site = "same-origin",
    type = "application/json",
  ) =>
    new Request("http://localhost:3002/api/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Sec-Fetch-Site": site, "Content-Type": type },
    });
  assert.doesNotThrow(() =>
    checkOrigin(request("http://localhost:3002"), "http://localhost:3002"),
  );
  assert.doesNotThrow(() =>
    checkOrigin(request("http://127.0.0.1:3002"), "http://localhost:3002"),
  );
  assert.throws(() =>
    checkOrigin(request("https://evil.example"), "http://localhost:3002"),
  );
  assert.throws(() =>
    checkOrigin(
      request("http://localhost:3002", "cross-site"),
      "http://localhost:3002",
    ),
  );
  assert.throws(() =>
    checkOrigin(
      request("http://localhost:3002", "same-origin", "text/plain"),
      "http://localhost:3002",
    ),
  );
  assert.throws(() =>
    checkOrigin(new Request("http://localhost:3002"), "http://localhost:3002"),
  );
});
test("public session schema strips secrets and validates tenant UUID", () => {
  const parsed = sessionSchema.parse({
    ...session,
    accessToken: "secret",
    user: { ...session.user, password_hash: "secret" },
  });
  assert.ok(!("accessToken" in parsed));
  assert.ok(!("password_hash" in parsed.user));
  assert.throws(() =>
    sessionSchema.parse({
      ...session,
      user: { ...session.user, operatorId: "../other" },
    }),
  );
});
test("payment amounts must be safe integer VND and actual review states", () => {
  const p = {
    id: session.user.id,
    method: "CASH",
    amount: 100000,
    allocatedAmount: 50000,
    unallocatedAmount: 50000,
    content: null,
    bankReference: null,
    transactionAt: "2026-11-09T01:00:00Z",
    receivedAt: "2026-11-09T01:01:00Z",
    matchedBookingCode: "TEST123",
    review: { status: "NONE", reason: null, note: null },
    recordedBy: null,
    allocations: [],
  };
  assert.equal(paymentSchema.parse(p).amount, 100000);
  assert.throws(() => paymentSchema.parse({ ...p, amount: 1.25 }));
  assert.throws(() =>
    paymentSchema.parse({ ...p, amount: Number.MAX_SAFE_INTEGER + 1 }),
  );
  assert.throws(() =>
    paymentSchema.parse({ ...p, review: { status: "completed" } }),
  );
});
