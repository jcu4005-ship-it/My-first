import { expect, test } from "./fixtures";

import { testEnv } from "../support/env";

/** V2: 브라우저가 실제로 내려받은 JS에 비밀키가 없는지 확인 */
const SECRET_PATTERNS = [/sb_secret_[A-Za-z0-9_-]{8,}/, /test_sk_[A-Za-z0-9]/, /live_sk_[A-Za-z0-9]/, /SUPABASE_SECRET_KEY/];

test("브라우저로 전달되는 JS에 비밀키가 없다", async ({ page }) => {
  const bodies: { url: string; text: string }[] = [];
  page.on("response", async (res) => {
    const type = res.headers()["content-type"] ?? "";
    if (type.includes("javascript")) bodies.push({ url: res.url(), text: await res.text().catch(() => "") });
  });
  for (const path of ["/", "/signup", "/login", "/forgot-password"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  expect(bodies.length).toBeGreaterThan(0);
  for (const { url, text } of bodies) {
    for (const pattern of SECRET_PATTERNS) expect(pattern.test(text), `${pattern} in ${url}`).toBe(false);
    if (testEnv.secretKey) expect(text.includes(testEnv.secretKey), `secret value in ${url}`).toBe(false);
    if (testEnv.vercelBypass) expect(text.includes(testEnv.vercelBypass), `bypass value in ${url}`).toBe(false);
  }
});
