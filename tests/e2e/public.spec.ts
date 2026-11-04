import { expect, newContext, test } from "./fixtures";

import { isStaging, requireTestEnv } from "../support/env";
import { adminApi } from "../support/fixtures";

test.beforeAll(requireTestEnv);
// 샘플 데이터가 필요한 검사: 로컬·CI는 항상, 스테이징은 샘플을 넣은 경우(TEST_EXPECT_SAMPLES=yes)만
const samples = !isStaging || process.env.TEST_EXPECT_SAMPLES === "yes";

test("메인: 서비스 소개, 샘플 안내, 곧 열리는 클래스, 호스트 소개", async ({ page }) => {
  test.skip(!samples, "샘플 데이터 없음");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("sample-notice")).toBeVisible();
  const cards = page.getByTestId("meetup-card");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThanOrEqual(6);
  await expect(page.getByRole("heading", { name: "클래스를 여는 사람들" })).toBeVisible();
});

test("메인 갤러리: 작품 클릭·좌우 버튼·키보드·스와이프로 이동, 상세 보기 연결", async ({ page }) => {
  test.skip(!samples, "샘플 데이터 없음");
  await page.goto("/");
  const gallery = page.getByTestId("exhibition-gallery");
  await expect(gallery).toBeVisible();
  const items = gallery.getByTestId("gallery-item");
  const total = await items.count();
  expect(total).toBeGreaterThanOrEqual(3);
  const activeIndex = async () => {
    for (let i = 0; i < total; i++) if ((await items.nth(i).getAttribute("data-active")) === "true") return i;
    return -1;
  };
  const start = await activeIndex();
  expect(start).toBeGreaterThanOrEqual(0);

  // 1) 옆 작품 클릭 → 가운데로
  const target = start + 1;
  await items.nth(target).click();
  await expect(items.nth(target)).toHaveAttribute("data-active", "true");
  const title = (await items.nth(target).getAttribute("aria-label"))!.split(" · ").slice(1).join(" · ").replace(" (선택됨)", "");
  await expect(gallery.getByTestId("gallery-caption")).toContainText(title);

  // 2) 좌우 버튼
  await gallery.getByTestId("gallery-prev").click();
  await expect(items.nth(start)).toHaveAttribute("data-active", "true");
  await gallery.getByTestId("gallery-next").click();
  await expect(items.nth(target)).toHaveAttribute("data-active", "true");

  // 3) 키보드
  await items.nth(target).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(items.nth(start)).toHaveAttribute("data-active", "true");

  // 4) 마우스 드래그 (왼쪽으로 끌면 다음 작품)
  const box = (await gallery.boundingBox())!;
  const y = box.y + 200;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 120, y, { steps: 8 });
  await page.mouse.up();
  await expect(items.nth(start + 1)).toHaveAttribute("data-active", "true");

  // 5) 상세 보기 → 가운데 작품의 상세 페이지
  await gallery.getByTestId("gallery-detail").click();
  await expect(page).toHaveURL(/\/meetups\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("meetup-title")).toBeVisible();
});

test("목록: 클래스 카테고리 필터, 비공개·비활성 카테고리 미노출, 빈 카테고리 안내", async ({ page }) => {
  test.skip(!samples, "샘플 데이터 없음");
  await page.goto("/meetups");
  const all = await page.getByTestId("meetup-card").count();
  expect(all).toBeGreaterThanOrEqual(8);
  await expect(page.getByText("(검토 중)")).toHaveCount(0);

  // 친목형 카테고리는 더 이상 보이지 않음
  await expect(page.getByRole("link", { name: "아웃도어", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "독서", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "사진·영상", exact: true }).click();
  await expect(page).toHaveURL(/category=photo/);
  await expect(page.getByRole("heading", { level: 1, name: "사진·영상" })).toBeVisible();
  const photoCards = page.getByTestId("meetup-card").filter({ visible: true });
  await expect(photoCards).toHaveCount(1);
  await expect(photoCards).toContainText("필름 카메라");

  await page.goto("/meetups?category=wellness");
  await expect(page.getByTestId("empty-state")).toContainText("호스트로 신청");
});

test("상세: 난이도·배우는 것·일정·남은 자리·마감·호스트 경력·샘플 신청 불가 표시", async ({ page }) => {
  test.skip(!samples, "샘플 데이터 없음");
  await page.goto("/meetups?category=music");
  await page.getByTestId("meetup-card").first().click();
  await expect(page.getByTestId("meetup-title")).toContainText("통기타");
  await expect(page.getByTestId("class-level")).toHaveText("입문");
  await expect(page.getByTestId("learning-outcomes")).toContainText("C·G·Am·F");
  // Next.js가 이전 화면을 숨겨 보관하므로 보이는 요소만 셉니다
  const sessions = page.getByTestId("booking-form").filter({ visible: true });
  await expect(sessions.getByTestId("session-row")).toHaveCount(2);
  await expect(sessions.getByTestId("seats-full")).toHaveCount(1); // 첫 회차 6/6 마감
  await expect(page.getByTestId("sample-badge").first()).toBeVisible();
  await expect(page.getByText("상세 주소는 참가 확정 후 안내됩니다")).toBeVisible();
  await expect(page.getByText("샘플 주소")).toHaveCount(0); // 비공개 상세 주소 미노출

  await page.getByTestId("host-link").click();
  await expect(page.getByTestId("host-name")).toHaveText("기타 선생 민재");
  await expect(page.getByTestId("host-credentials")).toContainText("세션 기타리스트");
  await expect(page.getByTestId("meetup-card").filter({ visible: true })).toHaveCount(1);
});

test("모바일: 메인 가로 밀림 없음, 상세 하단 고정 신청 바, 가로 스크롤 없음", async ({ browser }) => {
  test.skip(!samples, "샘플 데이터 없음");
  const page = await (await newContext(browser, { viewport: { width: 390, height: 844 } })).newPage();
  // 메인: 옆으로 넘기는 줄이 있어도 페이지 자체는 가로로 밀리지 않아야 함
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(5000, 0));
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  await page.goto("/meetups");
  await page.getByTestId("meetup-card").first().click();
  await expect(page.getByTestId("mobile-cta")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.close();
});

test("없는 클래스·검토 중 클래스·없는 호스트는 HTTP 404", async ({ page }) => {
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
