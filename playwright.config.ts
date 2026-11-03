import { defineConfig, devices } from "@playwright/test";

const staging = process.env.TEST_TARGET === "staging";
const appUrl = process.env.TEST_APP_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: staging ? 120_000 : 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // 스테이징: 요청 기록(trace)·화면 보고서를 남기지 않음 (접근 보호 우회 값이 기록에 남지 않도록)
  reporter: staging ? "list" : process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: appUrl,
    trace: staging ? "off" : "retain-on-failure",
    screenshot: "off",
    video: "off",
    locale: "ko-KR",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: staging
    ? undefined
    : {
        command: "npm run start",
        url: `${appUrl}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
