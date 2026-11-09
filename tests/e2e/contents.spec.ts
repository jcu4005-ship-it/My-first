import type { Browser, Page } from "@playwright/test";

import { expect, newContext, test } from "./fixtures";

import { isStaging, requireTestEnv } from "../support/env";
import { PASSWORD, createMember, grantRoleDirect, makeApprovedHost } from "../support/fixtures";
import { totp } from "../support/totp";

test.beforeAll(requireTestEnv);
const samples = !isStaging || process.env.TEST_EXPECT_SAMPLES === "yes";

async function loginPage(browser: Browser, email: string, next = ""): Promise<Page> {
  const page = await (await newContext(browser)).newPage();
  await page.goto(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

const BODY = [
  "같은 카메라로 찍어도 결과가 달라지는 이유는 대부분 빛에 있습니다.",
  "",
  "셔터를 누르기 전에 빛이 어디서 오는지, 그림자가 어느 쪽으로 지는지 먼저 살펴보세요. 이 짧은 습관이 사진을 바꿉니다. 이번 글에서는 그 연습 방법을 소개합니다.",
].join("\n");

test("저널: 목록·종류 탭·상세(본문·호스트·관련 프로그램)·없는 글 404·최근 본 글", async ({ page }) => {
  test.skip(!samples, "샘플 데이터 없음");
  await page.goto("/journal");
  await expect(page.getByTestId("content-card").first()).toBeVisible();
  await page.getByTestId("content-type-tab").filter({ hasText: "Portfolio" }).click();
  await expect(page).toHaveURL(/\/journal\?type=portfolio$/);
  await expect(page.locator('[data-testid=content-card][data-title="을지로, 오후 네 시의 필름"]')).toBeVisible();
  await expect(page.locator('[data-testid=content-card][data-title="사진은 빛을 읽는 일에서 시작됩니다"]')).toHaveCount(0);

  await page.goto("/journal/sample-filmlog-light");
  await expect(page.getByTestId("content-title")).toHaveText("사진은 빛을 읽는 일에서 시작됩니다");
  await expect(page.getByTestId("content-body")).toContainText("빛이 어디서 오는지");
  await expect(page.getByTestId("content-host")).toHaveAttribute("href", "/hosts/filmlog-dohyun");
  await expect(page.getByTestId("content-related")).toBeVisible();

  // 호스트 페이지에 포트폴리오·글 표시
  await page.goto("/hosts/filmlog-dohyun");
  await expect(page.getByTestId("host-portfolio").getByTestId("content-card")).toHaveCount(1);
  await expect(page.getByTestId("host-journal").getByTestId("content-card")).toHaveCount(1);

  const res = await page.goto("/journal/no-such-article");
  expect(res?.status()).toBe(404);

  // 최근 본 글은 이 브라우저에만 저장 → 마이페이지에 표시
  const m = await createMember("e2erv");
  await page.goto("/journal/sample-think-lab-interview");
  await expect(page.getByTestId("content-title")).toBeVisible();
  await page.goto(`/login?next=${encodeURIComponent("/me")}`);
  await page.getByLabel("이메일").fill(m.email);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/me$/);
  const recent = page.getByTestId("recently-viewed").getByTestId("recent-item");
  await expect(recent.first()).toContainText("답보다 질문을 가져가는 시간");
  await page.getByTestId("recently-viewed").getByRole("button", { name: "기록 지우기" }).click();
  await expect(recent).toHaveCount(0);
});

test("콘텐츠: 호스트 작성 → 필수 항목 검사 → 검토 요청 → 관리자 보완 요청 → 재요청 → 공개 → 수정 시 재검토", async ({ browser }) => {
  test.setTimeout(120_000);
  const h = await createMember("e2ech");
  const hostName = `글쓰는호스트${Date.now() % 10000}`;
  await makeApprovedHost(h.id, hostName);
  const adminUser = await createMember("e2eca");
  await grantRoleDirect(adminUser.id, "admin");
  const title = `빛을 읽는 연습 ${Date.now() % 100000}`;

  const host = await loginPage(browser, h.email, "/host");
  await host.getByTestId("host-contents-link").click();
  await expect(host).toHaveURL(/\/host\/contents$/);
  await host.getByRole("link", { name: "새 글 쓰기" }).click();
  const form = host.getByTestId("content-form");
  await form.getByLabel("제목").fill(title);
  await form.getByLabel("종류").selectOption("article");
  await form.getByRole("button", { name: "검토 요청하기" }).click();
  await expect(form.getByText("요약을 10자 이상")).toBeVisible();
  await expect(form.getByText("본문을 100자 이상")).toBeVisible();
  await expect(form.getByLabel("제목")).toHaveValue(title); // 오류 뒤에도 입력값 유지
  await form.getByRole("button", { name: "임시 저장" }).click();
  await expect(host).toHaveURL(/\/host\/contents\/[0-9a-f-]{36}\?saved=1$/);
  const contentUrl = host.url().replace(/\?.*$/, "");
  const form2 = host.getByTestId("content-form");
  await form2.getByLabel("요약").fill("빛의 방향을 먼저 보는 습관에 대하여");
  await form2.getByLabel("본문").fill(BODY);
  await form2.getByRole("button", { name: "검토 요청하기" }).click();
  await expect(host.getByTestId("host-content")).toHaveAttribute("data-status", "submitted");

  // 공개 전에는 저널에 없음
  const guest = await (await newContext(browser)).newPage();
  await guest.goto("/journal");
  await expect(guest.locator(`[data-testid=content-card][data-title="${title}"]`)).toHaveCount(0);

  // 관리자 (2단계 인증)
  const admin = await loginPage(browser, adminUser.email);
  await admin.goto("/admin/contents");
  await expect(admin).toHaveURL(/\/admin\/mfa/);
  const secret = (await admin.getByTestId("mfa-secret").textContent())!.trim();
  await admin.getByLabel(/6자리 코드/).fill(totp(secret));
  await admin.getByRole("button", { name: "확인" }).click();
  await expect(admin).toHaveURL(/\/admin\/contents$/);
  await admin.locator(`[data-testid=admin-content-row][data-title="${title}"]`).click();
  const detail = admin.getByTestId("content-detail");
  await expect(detail.getByTestId("content-body")).toContainText("빛이 어디서 오는지");
  await detail.getByTestId("reject-content").getByRole("textbox").fill("사진 출처를 본문 끝에 적어 주세요");
  await detail.getByTestId("reject-content").getByRole("button").click();
  await expect(admin.getByTestId("content-detail")).toHaveAttribute("data-status", "rejected");

  await host.goto(contentUrl);
  await expect(host.getByTestId("content-review-note")).toContainText("사진 출처");
  await host.getByTestId("content-form").getByLabel("본문").fill(`${BODY}\n\n사진: 직접 촬영`);
  await host.getByTestId("content-form").getByRole("button", { name: "검토 요청하기" }).click();
  await expect(host.getByTestId("host-content")).toHaveAttribute("data-status", "submitted");

  await admin.reload();
  await admin.getByTestId("content-detail").getByTestId("publish-content").getByRole("button").click();
  await expect(admin.getByTestId("content-detail")).toHaveAttribute("data-status", "published");

  // 공개: 저널 목록·상세·호스트 페이지
  await guest.goto("/journal");
  await guest.locator(`[data-testid=content-card][data-title="${title}"]`).click();
  await expect(guest.getByTestId("content-title")).toHaveText(title);
  await expect(guest.getByTestId("content-body")).toContainText("사진: 직접 촬영");
  await guest.getByTestId("content-host").click();
  await expect(guest.getByTestId("host-journal").locator(`[data-testid=content-card][data-title="${title}"]`)).toBeVisible();
  const publicUrl = (await guest.getByTestId("host-journal").locator(`[data-testid=content-card][data-title="${title}"]`).getAttribute("href"))!;

  // 호스트가 공개 글을 고치면 다시 검토 필요 → 공개 화면에서 내려감
  await host.goto(contentUrl);
  await expect(host.getByTestId("view-published")).toBeVisible();
  await host.getByTestId("content-form").getByLabel("요약").fill("빛의 방향을 먼저 보는 습관에 대하여 (수정)");
  await host.getByTestId("content-form").getByRole("button", { name: "임시 저장" }).click();
  await expect(host.getByTestId("host-content")).toHaveAttribute("data-status", "draft");
  const res = await guest.goto(publicUrl);
  expect(res?.status()).toBe(404);

  // 알림
  await host.goto("/me/notifications");
  await expect(host.getByText("콘텐츠가 공개되었어요")).toBeVisible();
});
