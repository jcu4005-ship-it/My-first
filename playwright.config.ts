import { defineConfig, devices } from "@playwright/test";

const appUrl = process.env.TEST_APP_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: appUrl, trace: "retain-on-failure", locale: "ko-KR" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    url: `${appUrl}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
