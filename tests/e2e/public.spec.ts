import { expect, newContext, test } from "./fixtures";

import { isStaging, requireTestEnv } from "../support/env";
import { adminApi } from "../support/fixtures";

test.beforeAll(requireTestEnv);
// 샘플 데이터가 필요한 검사: 로컬·CI는 항상, 스테이징은 샘플을 넣은 경우(TEST_EXPECT_SAMPLES=yes)만
const samples = !isStaging || process.env.TEST_EXPECT_SAMPLES === "yes";

test("메인: 서비스 소개, 샘플 안내, 곧 열리는 모임, 호스트 소개", async ({ page }) => {
  test.skip(!samples, "샘플 데이터 없음");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("sample-notice")).toBeVisible();
  const cards = page.getByTestId("meetup-card");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThanOrEqual(6);
  await expect(page.getByRole("heading", { name: "모임을 여는 사람들" })).toBeVisible();
});

test("목록: 카테고리 필터, 비공개 모임 미노출, 빈 카테고리 안내", async ({ page }) => {
  test.skip(!samples, "샘플 데이터 없음");
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
  test.skip(!samples, "샘플 데이터 없음");
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
  test.skip(!samples, "샘플 데이터 없음");
  const page = await (await newContext(browser, { viewport: { width: 390, height: 844 } })).newPage();
  await page.goto("/meetups");
  await page.getByTestId("meetup-card").first().click();
  await expect(page.getByTestId("mobile-cta")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.close();
});

test("없는 모임·검토 중 모임·없는 호스트는 HTTP 404", async ({ page }) => {
  const { data: pending } = await adminApi().from("meetups").select("id").eq("status", "pending_review").limit(1);
  const paths = ["/meetups/00000000-0000-4000-8000-000000000000", "/meetups/not-a-uuid", "/hosts/00000000-0000-4000-8000-000000000000"];
  if (pending?.[0]) paths.push(`/meetups/${pending[0].id}`);
  for (const path of paths) {
    const res = await page.goto(path);
    expect(res?.status(), `${path} HTTP 상태`).toBe(404);
    await expect(page.getByTestId("not-found").filter({ visible: true }), path).toBeVisible();
    await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute("content", /noindex/);
    await expect(page.getByText("검토 중 테스트")).toHaveCount(0);
  }
});
