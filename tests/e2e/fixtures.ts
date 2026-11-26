import { test as base, expect, type Browser, type BrowserContext, type BrowserContextOptions } from "@playwright/test";

import { testEnv } from "../support/env";

/**
 * 스테이징(Vercel 접근 보호) 우회 값은 스테이징 앱 주소로 가는 요청에만 붙입니다.
 * Supabase 등 다른 주소로 가는 요청에는 붙지 않으며, 값은 출력하지 않습니다.
 */
export async function applyBypass(context: BrowserContext) {
  if (!testEnv.vercelBypass) return;
  const origin = new URL(testEnv.appUrl).origin;
  await context.route(`${origin}/**`, (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-vercel-protection-bypass": testEnv.vercelBypass } }),
  );
}

export async function newContext(browser: Browser, options: BrowserContextOptions = {}) {
  const ctx = await browser.newContext({ locale: "ko-KR", ...options });
  await applyBypass(ctx);
  return ctx;
}

export const test = base.extend({
  context: async ({ context }, provide) => {
    await applyBypass(context);
    await provide(context);
  },
});

export { expect };
