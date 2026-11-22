import test from "node:test";
import assert from "node:assert/strict";
import {
  ApiError,
  assertOperatorSession,
  assertPlatformSession,
  assertSignedInSession,
} from "./access-policy";
import type { Session } from "./live-contracts";
import {
  createOperatorInput,
  createOwnerInput,
  randomTemporaryPassword,
  temporaryPasswordInput,
} from "./platform";

const owner: Session = {
  scope: "full",
  user: {
    id: "22222222-2222-4222-8222-222222222222",
    operatorId: "11111111-1111-4111-8111-111111111111",
    fullName: "Chủ xe",
    phone: "+84900000001",
    role: "OWNER",
    mfaEnabled: false,
  },
};
const platform: Session = {
  ...owner,
  user: { ...owner.user, role: "PLATFORM_ADMIN", operatorId: null },
};
const code = (c: string) => (e: unknown) =>
  e instanceof ApiError && e.code === c;

test("platform admins may sign in but stay out of operator routes, and vice versa", () => {
  assert.equal(assertSignedInSession(platform), platform);
  assert.equal(assertSignedInSession(owner), owner);
  assert.equal(assertPlatformSession(platform), platform);
  assert.throws(
    () => assertOperatorSession(platform),
    code("OPERATOR_REQUIRED"),
  );
  assert.throws(() => assertPlatformSession(owner), code("PLATFORM_REQUIRED"));
  // Vai trò nền tảng nhưng gắn nhà xe, hoặc vai trò nhà xe không có nhà xe: không hợp lệ ở cả hai khu.
  const mixed = {
    ...owner,
    user: { ...owner.user, role: "PLATFORM_ADMIN" as const },
  };
  assert.throws(() => assertPlatformSession(mixed), code("PLATFORM_REQUIRED"));
  const orphan = { ...owner, user: { ...owner.user, operatorId: null } };
  assert.throws(() => assertSignedInSession(orphan), code("OPERATOR_REQUIRED"));
  assert.throws(
    () => assertPlatformSession({ ...platform, scope: "mfa_setup" }),
    code("MFA_SETUP_REQUIRED"),
  );
});

test("temporary password input is strict and random passwords avoid look-alike characters", () => {
  assert.ok(
    temporaryPasswordInput.safeParse({
      password: "0123456789",
      adminPassword: "x",
    }).success,
  );
  for (const bad of [
    { password: "short", adminPassword: "x" },
    { password: "0123456789", adminPassword: "" },
    { password: "0123456789", adminPassword: "x", otp: "12345" },
    { password: "0123456789", adminPassword: "x", extra: 1 },
  ])
    assert.equal(temporaryPasswordInput.safeParse(bad).success, false);
  const fixed = randomTemporaryPassword((n) => new Uint8Array(n).fill(0));
  assert.equal(fixed, "a".repeat(16));
  const pw = randomTemporaryPassword();
  assert.equal(pw.length, 16);
  assert.match(pw, /^[a-km-np-zA-HJ-NP-Z2-9]{16}$/);
});

test("operator code is 2–4 uppercase letters (prefix of booking and vehicle codes)", () => {
  for (const code of ["VHA", "PN", "ABCD"])
    assert.equal(
      createOperatorInput.safeParse({ code, name: "Nhà xe" }).success,
      true,
      code,
    );
  for (const code of ["VHA01", "vha", "A", "ABCDE", "VH-A", ""])
    assert.equal(
      createOperatorInput.safeParse({ code, name: "Nhà xe" }).success,
      false,
      code,
    );
  assert.equal(
    createOperatorInput.safeParse({ code: "VHA", name: "  " }).success,
    false,
  );
  assert.equal(
    createOperatorInput.safeParse({ code: "VHA", name: "X", extra: 1 }).success,
    false,
  );
});

test("owner creation never accepts a client-chosen password or role", () => {
  const base = { fullName: "Chủ", phone: "0909", adminPassword: "x" };
  assert.equal(createOwnerInput.safeParse(base).success, true);
  assert.equal(
    createOwnerInput.safeParse({ ...base, password: "Client-Pass-123" })
      .success,
    false,
  );
  assert.equal(
    createOwnerInput.safeParse({ ...base, role: "PLATFORM_ADMIN" }).success,
    false,
  );
  assert.equal(
    createOwnerInput.safeParse({ ...base, otp: "12345" }).success,
    false,
  );
});
