import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSessionEvent } from "./session-sync";

test("accepts well-formed events from objects and JSON strings", () => {
  const e = { type: "logout", at: 1, id: "a" };
  assert.deepEqual(parseSessionEvent(e), e);
  assert.deepEqual(parseSessionEvent(JSON.stringify(e)), e);
});

test("rejects unknown types, extra fields (e.g. a token) and garbage", () => {
  assert.equal(parseSessionEvent({ type: "hack", at: 1, id: "a" }), null);
  assert.equal(
    parseSessionEvent({ type: "login", at: 1, id: "a", token: "x" }),
    null,
  );
  assert.equal(parseSessionEvent("{not json"), null);
  assert.equal(parseSessionEvent(null), null);
  assert.equal(parseSessionEvent({ type: "login", at: "1", id: "a" }), null);
});
