import assert from "node:assert/strict";
import { test } from "node:test";
import { listPlaces } from "./routes";

test("listPlaces counts each place as origin and destination, sorted by Vietnamese name", () => {
  assert.deepEqual(
    listPlaces([
      { origin: "Sài Gòn", destination: "Đà Lạt" },
      { origin: "Đà Lạt", destination: "Sài Gòn" },
      { origin: "Sài Gòn", destination: "Bảo Lộc" },
    ]),
    [
      { name: "Bảo Lộc", asOrigin: 0, asDestination: 1 },
      { name: "Đà Lạt", asOrigin: 1, asDestination: 1 },
      { name: "Sài Gòn", asOrigin: 2, asDestination: 1 },
    ],
  );
  assert.deepEqual(listPlaces([]), []);
});
