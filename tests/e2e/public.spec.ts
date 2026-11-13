import { expect, newContext, test } from "./fixtures";

import { isStaging, requireTestEnv } from "../support/env";
import { adminApi } from "../support/fixtures";

test.beforeAll(requireTestEnv);
// 샘플 데이터가 필요한 검사: 로컬·CI는 항상, 스테이징은 샘플을 넣은 경우(TEST_EXPECT_SAMPLES=yes)만
const samples = !isStaging || process.env.TEST_EXPECT_SAMPLES === "yes";

test("메인: 세 갈래 분류, 이번 주 프로그램, 호스트, 저널, 큐레이션 기준, 멤버십 준비 중", async ({ page }) => {
  test.skip(!samples, "샘플 데이터 없음");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("home-pillars").getByTestId("pillar-tile")).toHaveCount(3);
  await expect(page.getByTestId("sample-notice")).toBeVisible();
  const cards = page.getByTestId("home-this-week").getByTestId("meetup-card");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThanOrEqual(6);
  await expect(page.getByRole("heading", { name: "프로그램을 여는 사람들" })).toBeVisible();
  await expect(page.getByTestId("home-journal").getByTestId("content-card").first()).toBeVisible();
  await expect(page.getByTestId("home-curation")).toContainText("공개 전 검수");
  // 멤버십은 준비 중 표시만 — 가입·결제 버튼 없음
  const membership = page.getByTestId("membership-soon");
  await expect(membership).toContainText("준비 중");
  await expect(membership.getByRole("button")).toHaveCount(0);
  await expect(membership.getByRole("link")).toHaveCount(0);

  await page.getByTestId("home-pillars").getByTestId("pillar-tile").filter({ hasText: "Knowledge" }).click();
  await expect(page).toHaveURL(/\/meetups\?pillar=knowledge$/);
});

test("메인 추천 카드: 둥근 테이블(남은 자리)·참가비가 보이고, 누르면 상세로", async ({ page }) => {
  test.skip(!samples, "샘플 데이터 없음");
  await page.goto("/");
  const card = page.getByTestId("home-this-week").getByTestId("meetup-card").first();
  await expect(card.getByTestId("seat-table")).toBeVisible(); // 둥근 테이블과 의자 (남은 자리)
  await expect(card.getByTestId("seat-table")).toHaveAttribute("aria-label", /정원 \d+명/);
  await expect(card).toContainText("원");
  const title = (await card.getByRole("heading").textContent())!.trim();
  await card.click();
  await expect(page).toHaveURL(/\/meetups\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("meetup-title")).toHaveText(title);
});

test("호스트 안내: 정책·과정·약속·로드맵, 지원하기 연결, 메뉴에서 진입", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "주요 메뉴" }).or(page.getByRole("navigation", { name: "주요 메뉴 (모바일)" }))
    .getByRole("link", { name: "호스트 지원", exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/become-a-host$/);
  const main = page.getByTestId("for-hosts");
  await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(main.getByRole("heading", { name: "입장료는 없습니다" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "프로그램이 판매될 때만" })).toBeVisible();
  await expect(main.getByTestId("commission-note")).toContainText("정식 오픈 전");
  await expect(main.getByTestId("roadmap")).toContainText("앞으로의 계획");
  await main.getByRole("link", { name: "호스트 지원하기" }).first().click();
  await expect(page).toHaveURL(/\/login\?next=%2Fbecome-a-host%2Fapply/); // 비로그인은 로그인으로
  await page.goto("/for-hosts"); // 예전 주소
  await expect(page).toHaveURL(/\/become-a-host$/);
});

test("호스트 목록: 옛 주소 연결, 운영팀 추천, 3대 분류 필터, 검색, 빈 결과", async ({ page }) => {
  test.skip(!samples, "샘플 데이터 없음");
  await page.goto("/experts");
  await expect(page).toHaveURL(/\/hosts$/);
  const featured = page.getByTestId("featured-hosts");
  await expect(featured).toBeVisible();
  await expect(featured.getByTestId("host-card").first()).toBeVisible();

  await page.getByTestId("pillar-tab").filter({ hasText: "Knowledge" }).click();
  await expect(page).toHaveURL(/pillar=knowledge/);
  await expect(page.getByTestId("featured-hosts")).toHaveCount(0); // 필터 중에는 추천 영역 숨김
  const cards = page.getByTestId("host-card").filter({ visible: true });
  await expect(cards.filter({ hasText: "생각 연구소 윤재" })).toHaveCount(1);
  await expect(cards.filter({ hasText: "기타 선생 민재" })).toHaveCount(0);

  await page.goto("/hosts");
  await page.getByTestId("host-search").getByRole("textbox", { name: "호스트 검색" }).fill("기타");
  await page.getByTestId("host-search").getByRole("button", { name: "검색" }).click();
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByTestId("host-card").filter({ visible: true })).toHaveCount(1);
  await expect(page.getByTestId("host-card").filter({ visible: true })).toContainText("기타 선생 민재");

  await page.goto("/hosts?q=" + encodeURIComponent("없는호스트이름xyz"));
  await expect(page.getByTestId("empty-state")).toContainText("찾는 호스트가 없어요");
});

test("프로그램 목록: 3대 분류 탭과 세부 분야", async ({ page }) => {
  test.skip(!samples, "샘플 데이터 없음");
  await page.goto("/meetups");
  await page.getByTestId("pillar-tab").filter({ hasText: "Knowledge" }).click();
  await expect(page).toHaveURL(/pillar=knowledge/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("지식·관점");
  await expect(page.getByTestId("meetup-card").filter({ hasText: "철학자의 질문" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "사진·영상", exact: true })).toHaveCount(0); // 다른 분류의 세부 분야는 숨김
  await page.getByRole("link", { name: "철학·인문", exact: true }).click();
  await expect(page).toHaveURL(/category=philosophy/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("철학·인문");
});

test("목록: 프로그램 카테고리 필터, 비공개·비활성 카테고리 미노출, 빈 카테고리 안내", async ({ page }) => {
  test.skip(!samples, "샘플 데이터 없음");
  // 기대값은 DB에서 직접 계산: 공개 상태 + 활성 카테고리 + 앞으로 열리는(취소되지 않은) 일정이 있는 프로그램 수.
  // (샘플 일정은 시간이 지나면 지나가므로 고정 숫자 대신 DB 기준으로 비교)
  const db = adminApi();
  const { data: active } = await db.from("categories").select("slug").eq("is_active", true);
  const { data: rows } = await db
    .from("meetups")
    .select("id, sessions:meetup_sessions(starts_at, status)")
    .eq("status", "published")
    .in("category_slug", (active ?? []).map((c) => c.slug));
  const now = Date.now();
  const expected = (rows ?? []).filter((m) =>
    (m.sessions as { starts_at: string; status: string }[]).some((s) => s.status !== "cancelled" && new Date(s.starts_at).getTime() > now),
  ).length;
  expect(expected, "목록에 보일 프로그램이 1개 이상 있어야 검사 가능").toBeGreaterThan(0);
  await page.goto("/meetups");
  await expect(page.getByTestId("result-count")).toHaveText(`${expected}개의 프로그램`);
  await expect(page.getByTestId("meetup-card")).toHaveCount(expected);
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
  // 샘플 호스트도 팔로우 가능 (비로그인은 로그인 안내 + 팔로워 수)
  await expect(page).toHaveURL(/\/hosts\/minjae-guitar$/);
  await expect(page.locator('[data-testid=follow-login][href="/login?next=%2Fhosts%2Fminjae-guitar"]')).toBeVisible();
  await expect(page.getByTestId("follower-count")).toContainText("팔로워");
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

test("없는 프로그램·검토 중 프로그램·없는 호스트는 HTTP 404", async ({ page }) => {
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

test("개인정보 처리방침: 바닥글·가입 화면에서 연결, 초안 표시, 보호 장치 안내", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByTestId("privacy-summary")).toContainText("수집 항목");
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "개인정보 처리방침" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  const policy = page.getByTestId("privacy-policy");
  await expect(policy.getByRole("heading", { level: 1 })).toHaveText("개인정보 처리방침");
  await expect(policy.getByTestId("privacy-draft-note")).toContainText("초안");
  await expect(policy).toContainText("촬영 위치(GPS)");
});
