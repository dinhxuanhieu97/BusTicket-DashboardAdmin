import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3102",
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/fixture-api.mjs",
      url: "http://127.0.0.1:3101/__test/state",
      reuseExistingServer: false,
    },
    {
      command:
        "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3102",
      url: "http://127.0.0.1:3102/login",
      reuseExistingServer: false,
      env: {
        PNTICKET_API_URL: "http://127.0.0.1:3101",
        APP_ORIGIN: "http://127.0.0.1:3102",
        PNTICKET_TRIP_WRITE_OPERATOR_ID: "11111111-1111-4111-8111-111111111111",
      },
      timeout: 60000,
    },
  ],
});
