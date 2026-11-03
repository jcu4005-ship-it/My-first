import { expect, test } from "@playwright/test";

import { requireTestEnv } from "../support/env";
import { dbQuery } from "../support/fixtures";

test.beforeAll(requireTestEnv);

test("메인: 서비스 소개, 샘플 안내, 곧 열리는 모임, 호스트 소개", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("sample-notice")).toBeVisible();
  const cards = page.getByTestId("meetup-card");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThanOrEqual(6);
  await expect(page.getByRole("heading", { name: "모임을 여는 사람들" })).toBeVisible();
});

test("목록: 카테고리 필터, 비공개 모임 미노출, 빈 카테고리 안내", async ({ page }) => {
  await page.goto("/meetups");
  const all = await page.getByTestId("meetup-card").count();
  expect(all).toBeGreaterThanOrEqual(8);
  await expect(page.getByText("(검토 중)")).toHaveCount(0);

  await page.getByRole("link", { name: "사진", exact: true }).click();
  await expect(page).toHaveURL(/category=photo/);
  await expect(page.getByRole("heading", { level: 1, name: "사진" })).toBeVisible();
  const photoCards = page.getByTestId("meetup-card").filter({ visible: true });
  await expect(photoCards).toHaveCount(1);
  await expect(photoCards).toContainText("필름 카메라");

  await page.goto("/meetups?category=wine");
  await expect(page.getByTestId("empty-state")).toContainText("운영 검토");
});

test("상세: 일정·남은 자리·마감·호스트·샘플 신청 불가 표시", async ({ page }) => {
  await page.goto("/meetups?category=music");
  await page.getByTestId("meetup-card").first().click();
  await expect(page.getByTestId("meetup-title")).toContainText("LP 리스닝");
  // Next.js가 이전 화면을 숨겨 보관하므로 보이는 요소만 셉니다
  const sessions = page.getByTestId("booking-form").filter({ visible: true });
  await expect(sessions.getByTestId("session-row")).toHaveCount(2);
  await expect(sessions.getByTestId("seats-full")).toHaveCount(1); // 첫 회차 12/12 마감
  await expect(page.getByTestId("sample-badge").first()).toBeVisible();
  await expect(page.getByText("상세 주소는 참가 확정 후 안내됩니다")).toBeVisible();
  await expect(page.getByText("샘플 주소")).toHaveCount(0); // 비공개 상세 주소 미노출

  await page.getByTestId("host-link").click();
  await expect(page.getByTestId("host-name")).toHaveText("바이닐 수요일");
  await expect(page.getByTestId("meetup-card").filter({ visible: true })).toHaveCount(1);
});

test("모바일 상세: 하단 고정 신청 바, 가로 스크롤 없음", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("/meetups");
  await page.getByTestId("meetup-card").first().click();
  await expect(page.getByTestId("mobile-cta")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.close();
});

// 참고: 주소에 ID가 있는 화면은 화면 틀을 먼저 보내므로 HTTP 상태는 200이며, 404 안내와 검색 비노출(noindex)이 표시됩니다.
test("없는 모임·검토 중 모임은 '찾을 수 없음' 안내", async ({ page }) => {
  const [pending] = await dbQuery<{ id: string }>("select id from public.meetups where status = 'pending_review' limit 1");
  for (const path of ["/meetups/00000000-0000-4000-8000-000000000000", `/meetups/${pending.id}`, "/meetups/not-a-uuid", "/hosts/00000000-0000-4000-8000-000000000000"]) {
    await page.goto(path);
    await expect(page.getByTestId("not-found").filter({ visible: true }), path).toBeVisible();
    await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute("content", /noindex/);
    await expect(page.getByText("검토 중 테스트")).toHaveCount(0);
  }
});
