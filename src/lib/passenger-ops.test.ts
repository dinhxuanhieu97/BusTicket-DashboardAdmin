import test from "node:test";
import assert from "node:assert/strict";
import { boardingInput, boardingTarget, cancelInput } from "./passenger-ops";

const proof = "A".repeat(43);

test("boardingTarget sends the QR URL as is and a typed code upper-cased", () => {
  const url = `https://api.x.vn/api/v1/tickets/PNAB12CD/verify?proof=${proof}`;
  assert.deepEqual(boardingTarget(` ${url} `), { qr: url });
  assert.deepEqual(boardingTarget("pnab12cd"), { bookingCode: "PNAB12CD" });
  assert.equal(boardingTarget(""), null);
  assert.equal(boardingTarget("PN-12"), null);
  assert.equal(boardingTarget("https://evil.example/x"), null);
});

test("boardingInput needs exactly one of qr or bookingCode", () => {
  assert.ok(boardingInput.safeParse({ bookingCode: "pnab12cd" }).success);
  assert.equal(
    boardingInput.parse({ bookingCode: "pnab12cd" }).bookingCode,
    "PNAB12CD",
  );
  assert.ok(!boardingInput.safeParse({}).success);
  assert.ok(
    !boardingInput.safeParse({ bookingCode: "PNAB12CD", qr: "x" }).success,
  );
  assert.ok(
    !boardingInput.safeParse({ bookingCode: "PNAB12CD", extra: 1 }).success,
  );
});

test("cancelInput requires a 3–300 character reason", () => {
  assert.ok(!cancelInput.safeParse({ reason: " ab " }).success);
  assert.ok(!cancelInput.safeParse({ reason: "x".repeat(301) }).success);
  assert.deepEqual(cancelInput.parse({ reason: " Khách bận " }), {
    reason: "Khách bận",
    notifyCustomer: true,
  });
});
