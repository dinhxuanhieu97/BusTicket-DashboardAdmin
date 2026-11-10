import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACCESS_COOKIE,
  accessExpiryMs,
  cookieWrites,
  needsRefresh,
  REFRESH_COOKIE,
  requiresLogin,
} from "./session-tokens";

const jwt = (payload: object) =>
  `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
const NOW = Date.parse("2027-01-20T03:00:00Z");

test("reads exp from a JWT payload and rejects garbage", () => {
  assert.equal(accessExpiryMs(jwt({ exp: 100 })), 100_000);
  assert.equal(accessExpiryMs(undefined), null);
  assert.equal(accessExpiryMs("abc"), null);
  assert.equal(accessExpiryMs("a.!!!.c"), null);
  assert.equal(accessExpiryMs(jwt({ exp: "soon" })), null);
});

test("refreshes only with a refresh token, when access is missing, unreadable or about to expire", () => {
  const fresh = jwt({ exp: (NOW + 10 * 60_000) / 1000 });
  const closing = jwt({ exp: (NOW + 10_000) / 1000 });
  assert.equal(needsRefresh(fresh, "r", NOW), false);
  assert.equal(needsRefresh(closing, "r", NOW), true);
  assert.equal(needsRefresh(undefined, "r", NOW), true);
  assert.equal(needsRefresh("junk", "r", NOW), true);
  assert.equal(needsRefresh(undefined, undefined, NOW), false);
  assert.equal(needsRefresh(closing, "", NOW), false);
});

const base = {
  accessToken: "acc",
  expiresAt: "2027-01-20T03:15:00.000Z",
};

test("remember me: both cookies persist until the session ends", () => {
  const w = cookieWrites({
    ...base,
    refreshToken: "ref",
    sessionExpiresAt: "2027-02-19T03:00:00.000Z",
    remember: true,
  });
  assert.deepEqual(w, [
    {
      name: ACCESS_COOKIE,
      value: "acc",
      expires: new Date("2027-02-19T03:00:00.000Z"),
    },
    {
      name: REFRESH_COOKIE,
      value: "ref",
      expires: new Date("2027-02-19T03:00:00.000Z"),
    },
  ]);
});

test("without remember me: browser-session cookies (closing the browser logs out)", () => {
  const w = cookieWrites({
    ...base,
    refreshToken: "ref",
    sessionExpiresAt: "2027-01-20T15:00:00.000Z",
    remember: false,
  });
  assert.deepEqual(w, [
    { name: ACCESS_COOKIE, value: "acc" },
    { name: REFRESH_COOKIE, value: "ref" },
  ]);
});

test("refresh inside the grace window keeps the current refresh cookie", () => {
  const w = cookieWrites({
    ...base,
    refreshToken: null,
    sessionExpiresAt: "2027-02-19T03:00:00.000Z",
    remember: true,
  });
  assert.equal(w.length, 1);
  assert.equal(w[0]!.name, ACCESS_COOKIE);
});

test("2FA setup token (no session, or an old API) clears any stale refresh cookie", () => {
  for (const issued of [
    { ...base, refreshToken: null, sessionExpiresAt: null },
    base,
  ]) {
    assert.deepEqual(cookieWrites(issued), [
      { name: ACCESS_COOKIE, value: "acc", expires: new Date(base.expiresAt) },
      { name: REFRESH_COOKIE, value: "", maxAge: 0 },
    ]);
  }
});

test("only admin and 2FA pages require a session", () => {
  for (const p of ["/admin", "/admin/trips", "/mfa"])
    assert.equal(requiresLogin(p), true, p);
  for (const p of [
    "/login",
    "/",
    "/api/auth/session",
    "/administrator",
    "/mfa-help",
  ])
    assert.equal(requiresLogin(p), false, p);
});
