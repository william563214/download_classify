import { defineConfig, devices } from "@playwright/test";

const mock_port = 18765;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    headless: true,
    trace: "on-first-retry",
  },
  webServer: {
    command: `node tests/helpers/serve_mock_sites.mjs ${mock_port}`,
    url: `http://127.0.0.1:${mock_port}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
