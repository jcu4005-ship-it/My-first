import { expect, test } from "@playwright/test";

/**
 * 임시 공개 모드(SITE_MODE=coming_soon) 검사.
 * 이 모드로 빌드·실행한 서버에서만 돌립니다: TEST_COMING_SOON=1 (운영 DB 없는 모드는 TEST_COMING_SOON_DB 를 비워 둠)
 *   예) SITE_MODE=coming_soon NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npx next build && … next start
 *       TEST_COMING_SOON=1 npx playwright test tests/e2e/coming-soon.spec.ts
 */
test.skip(!process.env.TEST_COMING_SOON, "임시 공개 모드 서버에서만 실행");
const hasDb = Boolean(process.env.TEST_COMING_SOON_DB);

test("임시 공개 페이지: 메인에 소개·사업자 정보·약관 링크, 신청·결제는 아직이라고 안내", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  const main = page.getByTestId("coming-soon");
  await expect(main.getByRole("heading", { level: 1 })).toContainText("곧 문을 엽니다");
  await expect(main.getByTestId("wordmark-chair")).toBeVisible(); // 로고 O는 의자 (대표 지시)
  await expect(page.getByTestId("coming-soon-notice")).toContainText("신청과 결제는 아직 열리지 않았어요");
  const footer = page.getByTestId("coming-soon-footer");
  for (const name of ["이용약관", "개인정보 처리방침", "취소·환불 정책"]) await expect(footer.getByRole("link", { name })).toBeVisible();
  await expect(footer.getByTestId("footer-business-info")).toContainText("사업자등록번호");
  // 열려 있지 않은 메뉴·로그인 링크는 없다
  await expect(page.getByRole("link", { name: "회원가입" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "프로그램", exact: true })).toHaveCount(0);
  // 정식 오픈 전에는 검색에 올리지 않음
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("열려 있지 않은 화면은 소개 페이지로 돌아가고, 약관·방침·환불은 열린다", async ({ page }) => {
  for (const path of ["/meetups", "/signup", "/checkout/00000000-0000-0000-0000-000000000000", "/hosts/someone", "/host", "/me", "/become-a-host"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/$/);
    await expect(page.getByTestId("coming-soon")).toBeVisible();
  }
  for (const [path, id] of [["/terms", "terms"], ["/privacy", "privacy-policy"], ["/refund", "refund-policy"]] as const) {
    await page.goto(path);
    await expect(page, path).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByTestId(id)).toBeVisible();
    // 약관 화면의 머리글·바닥글도 임시 공개용 (열려 있지 않은 메뉴 없음)
    await expect(page.getByTestId("coming-soon-header")).toBeVisible();
    await expect(page.getByTestId("coming-soon-footer")).toBeVisible();
  }
});

test("운영 DB 연결 여부에 따라 크리에이터 지원이 열리거나 이메일 문의로 안내된다", async ({ page }) => {
  await page.goto("/");
  if (hasDb) {
    await expect(page.getByTestId("coming-soon-cta").getByRole("link", { name: "크리에이터 지원하기" })).toHaveAttribute("href", "/apply");
    await page.goto("/apply");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("당신의 가능성을 발견합니다.");
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/signup"); // 회원가입은 계속 막힘
    await expect(page).toHaveURL(/\/$/);
  } else {
    await expect(page.getByTestId("coming-soon-cta").getByRole("link", { name: "크리에이터 문의하기" })).toHaveAttribute("href", /^mailto:/);
    await page.goto("/apply");
    await expect(page).toHaveURL(/\/$/); // 저장할 DB가 없으므로 지원 접수는 닫혀 있음
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/$/);
  }
});
