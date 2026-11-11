import test from "node:test";
import assert from "node:assert/strict";
import { ApiError, checkOrigin } from "./access-policy";
import { LOGO_TYPES, logoUrl } from "./brand";

const origin = "https://dashboard.example";
const req = (type: string | null, from = origin) =>
  new Request(`${origin}/api/operations/logo`, {
    method: "PUT",
    headers: { Origin: from, ...(type ? { "Content-Type": type } : {}) },
  });
const code = (c: string) => (e: unknown) =>
  e instanceof ApiError && e.code === c;

test("logo uploads accept only the listed image types from the dashboard origin", () => {
  checkOrigin(req("image/png"), origin, LOGO_TYPES);
  checkOrigin(req("image/webp; charset=binary"), origin, LOGO_TYPES);
  for (const t of ["image/svg+xml", "text/plain", "multipart/form-data", null])
    assert.throws(
      () => checkOrigin(req(t), origin, LOGO_TYPES),
      code("INVALID_CONTENT_TYPE"),
    );
  assert.throws(
    () =>
      checkOrigin(req("image/png", "https://evil.example"), origin, LOGO_TYPES),
    code("ORIGIN_REJECTED"),
  );
  // Mặc định vẫn chỉ nhận JSON.
  assert.throws(
    () => checkOrigin(req("image/png"), origin),
    code("INVALID_CONTENT_TYPE"),
  );
});

test("logo URL only exists when a logo version is set", () => {
  assert.equal(logoUrl("PN", null), null);
  assert.equal(logoUrl("PN", "123"), "/api/brand/logo/PN?v=123");
});
