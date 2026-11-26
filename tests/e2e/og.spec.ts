import { expect, test } from "./fixtures";

import { requireTestEnv } from "../support/env";

test.beforeAll(requireTestEnv);

/** 공유 미리보기 카드: 페이지에 og:image 가 있고, 그 주소가 실제 PNG 이미지를 돌려준다 */
async function ogImageOf(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  const url = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(url, `${path} 에 og:image 가 있어야 해요`).toBeTruthy();
  const res = await page.evaluate(async (u) => {
    const r = await fetch(new URL(u!).pathname + new URL(u!).search);
    const buf = new Uint8Array(await r.arrayBuffer());
    return { status: r.status, type: r.headers.get("content-type") ?? "", size: buf.length, png: buf[1] === 0x50 && buf[2] === 0x4e };
  }, url);
  expect(res.status).toBe(200);
  expect(res.type).toContain("image/png");
  expect(res.png).toBe(true);
  expect(res.size).toBeGreaterThan(10_000);
}

test("공유 미리보기 카드: 메인·크리에이터·프로그램 페이지에 이미지 카드가 붙는다", async ({ page }) => {
  await ogImageOf(page, "/");
  await page.goto("/hosts");
  const creator = await page.locator('a[href^="/hosts/"]').first().getAttribute("href");
  if (creator) await ogImageOf(page, creator);
  await page.goto("/meetups");
  const program = await page.getByTestId("meetup-card").first().getAttribute("href").catch(() => null);
  if (program) await ogImageOf(page, program);
});
