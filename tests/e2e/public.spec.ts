import { expect, newContext, test } from "./fixtures";

import { isStaging, requireTestEnv } from "../support/env";
import { adminApi } from "../support/fixtures";

test.beforeAll(requireTestEnv);
// 샘플 데이터가 필요한 검사: 로컬·CI는 항상, 스테이징은 샘플을 넣은 경우(TEST_EXPECT_SAMPLES=yes)만
const samples = !isStaging || process.env.TEST_EXPECT_SAMPLES === "yes";

test("홈(모닥불 원): 크리에이터 얼굴 원 · 먼저 앉은 사람 · 당신 자리 → 상세, 잡지형 소개는 /about", async ({ page }) => {
  await page.goto("/");
  const hero = page.getByTestId("home-circle");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const cta = page.getByTestId("home-cta").filter({ visible: true });
  test.skip((await cta.count()) === 0, "열린 원이 없음");
  await expect(hero.getByTestId("seat-table")).toBeVisible();
  // 실제 예약 수로 쓴 한 줄
  await expect(page.getByTestId("home-seat-line").filter({ visible: true })).toContainText(/(명 신청|첫 번째 자리예요) · \d+자리 남음/);
  await expect(cta).toHaveAttribute("href", /^\/meetups\/[0-9a-f-]{36}#booking$/);
  await page.getByTestId("home-about").click();
  await expect(page).toHaveURL(/\/about$/);
  // 홈에도 같은 제호가 있어 이전 화면이 숨겨진 채 남아 있음 → 보이는 것만 확인
  await expect(page.getByTestId("wordmark-chair").filter({ visible: true })).toBeVisible();
});

test("라운디 이야기(예전 메인) 제호와 표지: O 자리에 의자 로고, 크리에이터 사진이 2초마다 바뀌고 점으로 넘길 수 있다", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByTestId("wordmark-chair")).toBeVisible();
  const cover = page.getByTestId("cover-story");
  await expect(cover).toHaveAttribute("href", /^\/hosts\//);
  const dots = page.getByTestId("cover-dots").getByRole("button");
  test.skip((await dots.count()) < 2, "사진 있는 크리에이터가 1명 이하");
  const first = await cover.getAttribute("href");
  // 저절로 바뀜 (2초 간격, 여유 4초)
  await expect(cover).not.toHaveAttribute("href", first!, { timeout: 4000 });
  // 점을 누르면 그 사람으로
  await dots.first().click();
  await expect(cover).toHaveAttribute("href", first!);
});

test("라운디 이야기(잡지 표지): 카피·표지, 이번 호의 사람들, 그 사람을 만나는 방법, 세 분야, 저널, 심사 기준", async ({ page }) => {
  test.skip(!samples, "샘플 데이터 없음");
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("새로운 세계가 됩니다");
  await expect(page.getByText("Make time")).toHaveCount(0);
  await expect(page.getByTestId("hero-cta")).toHaveAttribute("href", "/hosts");
  // 표지: 사진이 있는 크리에이터가 표지 인물, 누르면 그 사람의 페이지로
  await expect(page.getByTestId("cover-story")).toHaveAttribute("href", /^\/hosts\//);
  await expect(page.getByTestId("home-pillars").getByTestId("pillar-tile")).toHaveCount(3);
  await expect(page.getByTestId("sample-notice")).toBeVisible();
  const cards = page.getByTestId("home-this-week").getByTestId("meetup-card");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThanOrEqual(8);
  // 다른 참가자의 얼굴은 보여 주지 않고 남은 자리는 글자로
  await expect(cards.first().getByTestId("card-seats")).toContainText(/(\d+자리 남음|마감)/);
  const creators = page.getByTestId("home-creators").getByTestId("creator-tile");
  await expect(creators.first()).toBeVisible();
  expect(await creators.count()).toBeLessThanOrEqual(3);
  await expect(page.getByTestId("home-journal").getByTestId("content-card").first()).toBeVisible();
  await expect(page.getByTestId("home-curation")).toContainText("공개 전 검수");
  // 아직 없는 기능(멤버십)은 메인에 보이지 않음
  await expect(page.getByText("멤버십")).toHaveCount(0);

  await page.getByTestId("home-pillars").getByTestId("pillar-tile").filter({ hasText: "Knowledge" }).click();
  await expect(page).toHaveURL(/\/meetups\?pillar=knowledge$/);
});

test("라운디 이야기 추천 카드: 남은 자리(글자)·참가비가 보이고, 누르면 상세로 (의자 그림은 상세에서만)", async ({ page }) => {
  test.skip(!samples, "샘플 데이터 없음");
  await page.goto("/about");
  const card = page.getByTestId("home-this-week").getByTestId("meetup-card").first();
  await expect(card.getByTestId("card-seats")).toContainText(/(\d+자리 남음|마감) · 정원 \d+명/); // 남은 자리는 글자로
  await expect(card.getByTestId("seat-table")).toHaveCount(0); // 의자 그림은 상세에서만
  await expect(card).toContainText("원");
  const title = (await card.getByRole("heading").textContent())!.trim();
  await card.click();
  await expect(page).toHaveURL(/\/meetups\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("meetup-title")).toHaveText(title);
  // 원(의자 그림)은 휴대폰·PC 자리가 따로 있어 보이는 것만 확인
  await expect(page.getByTestId("seat-table").filter({ visible: true }).first()).toBeVisible();
});

test("호스트 안내: 정책·과정·약속·로드맵, 지원하기 연결, 메뉴에서 진입", async ({ page }) => {
  await page.goto("/");
  // 홈 맨 아래에 크리에이터 모집 안내(지원 3분)가 있고 바로 지원서로 연결된다
  await expect(page.getByTestId("home-host-cta").filter({ visible: true }).getByRole("link", { name: "크리에이터 지원하기" })).toHaveAttribute("href", "/apply");
  await page.getByRole("navigation", { name: "주요 메뉴" }).or(page.getByRole("navigation", { name: "주요 메뉴 (모바일)" }))
    .getByRole("link", { name: "크리에이터 지원", exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/become-a-host$/);
  const main = page.getByTestId("for-hosts");
  await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(main.getByRole("heading", { name: "입장료는 없습니다" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "프로그램이 판매될 때만" })).toBeVisible();
  await expect(main.getByTestId("commission-note")).toContainText("결제로만 받아요");
  await expect(main.getByTestId("commission-note")).toContainText("수수료 20% 제외");
  await expect(main.getByTestId("roadmap")).toContainText("앞으로의 계획");
  await main.getByRole("link", { name: "크리에이터 지원하기" }).first().click();
  await expect(page).toHaveURL(/\/apply$/); // 로그인 없이 바로 지원서
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
  await page.getByTestId("host-search").getByRole("textbox", { name: "크리에이터 검색" }).fill("기타");
  await page.getByTestId("host-search").getByRole("button", { name: "검색" }).click();
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByTestId("host-card").filter({ visible: true })).toHaveCount(1);
  await expect(page.getByTestId("host-card").filter({ visible: true })).toContainText("기타 선생 민재");

  await page.goto("/hosts?q=" + encodeURIComponent("없는호스트이름xyz"));
  await expect(page.getByTestId("empty-state")).toContainText("찾는 크리에이터가 없어요");
});

test("저장: 카드의 북마크를 누르면 저장 화면에 모이고, 다시 누르면 빠진다 (이 기기에만 저장)", async ({ page }) => {
  await page.goto("/meetups");
  const card = page.getByTestId("meetup-card").first();
  const title = (await card.getByRole("heading").textContent())!.trim();
  const save = page.getByTestId("save-button").first();
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await page.goto("/saved");
  await expect(page.getByTestId("saved-list")).toContainText(title);
  await page.getByTestId("saved-list").getByTestId("save-button").first().click();
  await expect(page.getByTestId("saved-empty")).toBeVisible();
});

test("첫 호스트(이름·분야만): 목록과 상세에 '소개 준비 중'(가상 소개를 넣은 스테이징에서는 '가상 소개' 안내), 호스트에 샘플 표시 없음, 예시 프로그램은 샘플·신청 불가", async ({ page }) => {
  await page.goto("/hosts?q=" + encodeURIComponent("홍지완"));
  const card = page.getByTestId("host-card").filter({ visible: true });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("스피치 강사");
  // 스테이징은 시연용 가상 소개가 들어가 있을 수 있음(2-3g 단계). 그 경우 "소개 준비 중" 대신 가상 소개 안내가 보여야 함
  const demo = (await card.getByTestId("host-pending").count()) === 0;
  if (!demo) await expect(card.getByTestId("host-pending")).toHaveText("소개 준비 중");
  await expect(card).not.toContainText("샘플");

  await page.goto("/hosts/hong-jiwan");
  await expect(page.getByTestId("host-name")).toHaveText("홍지완");
  await expect(page.getByTestId("host-occupation")).toHaveText("스피치 강사");
  if (demo) await expect(page.getByTestId("demo-profile-notice")).toBeVisible();
  else await expect(page.getByTestId("host-intro-pending")).toContainText("소개 준비 중");
  // 아직 지원·심사를 거치지 않았으므로 "심사 통과" 표시를 하지 않는다
  await expect(page.getByText("심사통과")).toHaveCount(0);
  await expect(page.getByLabel("운영팀 심사를 통과한 호스트")).toHaveCount(0);
  // 예시 프로그램은 실제 이름이 붙으므로 반드시 "샘플" 표시, 신청 불가
  const programs = page.getByTestId("host-programs");
  await expect(programs.getByTestId("meetup-card")).toHaveCount(1);
  await expect(programs.getByTestId("meetup-card")).toContainText("자기소개 스피치");
  await expect(programs.getByTestId("meetup-card")).toContainText("샘플");
  await programs.getByTestId("meetup-card").click();
  await expect(page.getByRole("button", { name: "샘플 프로그램은 신청할 수 없어요" })).toBeDisabled();
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
  // 사진·영상: 샘플 1개 + 첫 호스트(양승효) 예시 1개
  await expect(photoCards).toHaveCount(2);
  await expect(photoCards.filter({ hasText: "필름 카메라" })).toHaveCount(1);
  await expect(photoCards.filter({ hasText: "골목 사진" })).toHaveCount(1);

  await page.goto("/meetups?category=wellness");
  await expect(page.getByTestId("empty-state")).toContainText("지원해 주세요");
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

test("화면을 옮겨도 글자가 보인다: 홈(네이비)에서 약관(밝은 화면)으로 이동해도 바탕·글자 대비 4.5 이상 (이전 화면이 숨겨져 남아도)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "이용약관" }).click();
  await expect(page).toHaveURL(/\/terms$/);
  const ratio = await page.evaluate(() => {
    const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const h1 = document.querySelector("main h1:not([hidden])") as HTMLElement;
    const text = rgb(getComputedStyle(h1).color);
    const bg = rgb(getComputedStyle(document.body).backgroundColor);
    const [a, b] = [lum(text), lum(bg)];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test("사업자 정보·정책 링크: 모든 공개 화면 바닥글(홈·로그인·가입·고객센터)에 약관·개인정보·환불 링크와 사업자 정보 자리, 입력 전에는 '입력 필요' 표시", async ({ page }) => {
  for (const url of ["/", "/login", "/signup", "/help", "/about"]) {
    await page.goto(url);
    const footer = page.getByRole("contentinfo").filter({ visible: true });
    for (const name of ["이용약관", "개인정보 처리방침", "취소·환불 정책"]) {
      await expect(footer.getByRole("link", { name, exact: true })).toBeVisible();
    }
    const info = footer.getByTestId("footer-business-info");
    await expect(info).toContainText("상호");
    await expect(info).toContainText("사업자등록번호");
    await expect(info).toContainText("통신판매업 신고번호");
    await expect(info).toContainText("개인정보 보호책임자");
    // 아직 전달받지 않은 정보는 지어내지 않고 입력 필요로 표시
    await expect(info.getByTestId("footer-business-info-pending")).toBeVisible();
  }
});

test("약관·방침 문서 구조: 개정일·시행일·버전 표시(확정 전에는 임의 날짜 없음), 법률 검토 필요 표시, 개인정보 외부 서비스 표", async ({ page }) => {
  for (const [url, id] of [["/terms", "terms"], ["/privacy", "privacy-policy"], ["/refund", "refund-policy"]] as const) {
    await page.goto(url);
    const doc = page.getByTestId(id);
    const meta = doc.getByTestId("legal-meta");
    await expect(meta).toContainText("개정일");
    await expect(meta).toContainText("시행일");
    await expect(meta).toContainText("draft-");
    await expect(meta.getByTestId("legal-revised")).toContainText("확정 후 표시");
    await expect(meta.getByTestId("legal-effective")).toContainText("확정 후 표시");
    await expect(doc.getByTestId("review-note").first()).toContainText("법률 검토 필요");
  }
  await page.goto("/terms");
  await expect(page.getByTestId("terms")).toContainText("참가자 취소");
  await expect(page.getByTestId("terms")).toContainText("크리에이터 사정으로 취소");
  await expect(page.getByTestId("terms").getByTestId("business-info")).toContainText("통신판매 관련 고지");
  await page.goto("/privacy");
  const services = page.getByTestId("privacy-services");
  for (const name of ["Supabase", "Vercel", "결제대행사", "카카오톡", "AI 분석 도구"]) await expect(services).toContainText(name);
  await expect(page.getByTestId("privacy-policy")).toContainText("크리에이터 지원 접수");
  await expect(page.getByTestId("privacy-officer")).toContainText("입력 필요");
  await page.goto("/refund");
  await expect(page.getByTestId("refund-policy")).toContainText("참가자의 취소와 크리에이터의 취소는 환불 기준이 달라요");
});

test("가입 화면: 필수 약관 동의 칸마다 약관·방침 보기 링크", async ({ page }) => {
  await page.goto("/signup");
  const consents = page.getByRole("group", { name: "약관 동의" });
  await expect(consents.getByRole("link", { name: "보기" })).toHaveCount(2);
  await expect(consents.getByRole("link", { name: "보기" }).first()).toHaveAttribute("href", "/terms");
  await expect(consents.getByRole("link", { name: "보기" }).nth(1)).toHaveAttribute("href", "/privacy");
});

test("약관·환불 정책: 바닥글에서 연결, 초안 표시, 환불 기준 3단계, 프로그램 상세에 같은 기준", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "이용약관" }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByTestId("terms-draft-note")).toContainText("초안");
  await expect(page.getByTestId("business-info-pending")).toBeVisible();
  await page.getByRole("contentinfo").getByRole("link", { name: "취소·환불 정책" }).click();
  await expect(page).toHaveURL(/\/refund$/);
  const table = page.getByTestId("refund-table");
  await expect(table).toContainText("3일 전까지");
  await expect(table).toContainText("50%");
  await expect(table).toContainText("환불 없음");
  await page.goto("/meetups");
  const program = await page.getByTestId("meetup-card").first().getAttribute("href").catch(() => null);
  if (program) {
    await page.goto(program);
    await expect(page.getByTestId("refund-summary")).toContainText("50% 환불");
  }
});

test("프로그램 검색: 머리글 돋보기 → 검색창, 제목·크리에이터로 찾기, 결과 없음 안내, 검색 지우기", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "프로그램 검색" }).click();
  await expect(page).toHaveURL(/\/meetups#search$/);
  const form = page.getByTestId("program-search");
  const first = page.getByTestId("meetup-card").first();
  const title = (await first.getByRole("heading").first().textContent().catch(() => null))?.trim();
  test.skip(!title, "공개 프로그램이 없음");
  const word = title!.split(/\s+/)[0];
  await form.getByRole("searchbox").fill(word);
  await form.getByRole("button", { name: "검색" }).click();
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(word).replace(/%20/g, "\\+")}`));
  await expect(page.getByTestId("result-count")).toContainText(`“${word}” 검색 결과`);
  await expect(page.getByTestId("meetup-card").first()).toBeVisible();
  await form.getByRole("searchbox").fill("절대없는검색어zz");
  await form.getByRole("button", { name: "검색" }).click();
  await expect(page.getByTestId("search-empty")).toContainText("맞는 프로그램이 없어요");
  await page.goto("/meetups?q=abc");
  await page.getByTestId("clear-search").click();
  await expect(page).toHaveURL(/\/meetups$/);
});

test("로고 규칙(대표 지시): 머리글의 ROUNDI 글자 O는 시그니처 의자 모양 (일반 글자 O 금지)", async ({ page }) => {
  for (const url of ["/meetups", "/hosts", "/drops"]) {
    await page.goto(url);
    const logo = page.getByTestId("site-logo").filter({ visible: true }).first().getByTestId("header-wordmark");
    await expect(logo).toBeVisible();
    // 의자 심볼이 O 자리에 들어간 제호는 선이 글자(R·U·N·D·I) 외에 의자 조각을 함께 그린다 → path 개수로 확인
    expect(await logo.locator("path").count()).toBeGreaterThan(10);
  }
});

test("가상 소개(시연용): 가상임이 드러나고 '운영팀 확인' 표시·체크리스트·본인 서명은 켜지지 않는다", async ({ page }) => {
  test.skip(isStaging, "로컬 전용 (호스트 소개를 잠시 바꿨다가 되돌림)");
  const admin = adminApi();
  const { data: before } = await admin.from("host_profiles").select("headline, bio, career, philosophy").eq("slug", "hong-jiwan").single();
  test.skip(!before || before.headline !== "" || before.bio !== "", "이미 소개가 채워져 있어 건너뜀");
  try {
    await admin.from("host_profiles").update({ headline: "스피치 강사 (가상)", bio: "(가상 소개 · 시연용) 예시 소개입니다.", philosophy: "예시 한 줄 (가상 소개 · 시연용)" }).eq("slug", "hong-jiwan");
    await page.goto("/hosts/hong-jiwan");
    await expect(page.getByTestId("demo-profile-notice")).toBeVisible();
    await expect(page.getByTestId("verified-checklist")).toHaveCount(0);
    await expect(page.getByLabel("운영팀 심사를 통과한 호스트")).toHaveCount(0);
    await expect(page.getByText("드림")).toHaveCount(0); // 본인 서명 없음
  } finally {
    await admin.from("host_profiles").update({ headline: "", bio: "", career: before?.career ?? "", philosophy: "" }).eq("slug", "hong-jiwan");
  }
});

test("홈 맨 위: ROUNDI 제호 바로 아래 프로그램 슬라이드, 크리에이터 사진이 2초마다 돌아가며 바뀐다", async ({ page }) => {
  await page.goto("/");
  const slider = page.getByTestId("home-slider");
  await expect(slider).toBeVisible();
  // 제호 바로 아래: 제호보다 아래, 첫 화면 안에서 사진이 보임
  const wordmark = await page.getByTestId("wordmark-chair").boundingBox();
  const box = await slider.boundingBox();
  expect(box!.y).toBeGreaterThan(wordmark!.y);
  expect(box!.y).toBeLessThan((page.viewportSize()?.height ?? 720) * 0.7);
  const dots = page.getByTestId("home-slider-dots").getByRole("button");
  test.skip((await dots.count()) < 2, "슬라이드가 1개뿐");
  const first = await page.getByTestId("slider-title").textContent();
  await expect.poll(async () => page.getByTestId("slider-title").textContent(), { timeout: 6000 }).not.toBe(first);
  // 점을 누르면 그 프로그램으로
  await dots.nth(0).click();
  await expect(page.getByTestId("slider-title")).toHaveText(first!);
  await expect(page.getByTestId("slider-cta")).toHaveAttribute("href", /^\/meetups\/[0-9a-f-]{36}$/);
});
