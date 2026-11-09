import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

import { isStaging, requireTestEnv } from "../support/env";
import { PASSWORD, createMember, makeApprovedHost } from "../support/fixtures";

test.beforeAll(requireTestEnv);
const samples = !isStaging || process.env.TEST_EXPECT_SAMPLES === "yes";

async function login(page: Page, email: string, next = "") {
  await page.goto(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

// 1x1 PNG (테스트용 사진)
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("호스트 상세: 이름 주소, 직업·작업 철학, 프로그램 구분, 예전 주소 연결", async ({ page }) => {
  test.skip(!samples, "샘플 데이터 없음");
  await page.goto("/hosts/a0000000-0000-4000-8000-000000000003"); // 예전 주소 (사용자 id)
  await expect(page).toHaveURL(/\/hosts\/minjae-guitar$/);
  await expect(page.getByTestId("host-name")).toHaveText("기타 선생 민재");
  await expect(page.getByTestId("host-occupation")).toContainText("세션 기타리스트");
  await expect(page.getByTestId("host-philosophy")).toContainText("첫 곡을 끝까지");
  const programs = page.getByTestId("host-programs");
  await expect(programs.getByTestId("meetup-card").first()).toBeVisible();
  // 곧 열리는(7일 이내) 또는 예정된 프로그램 중 하나 이상
  expect((await programs.getByTestId("host-programs-soon").count()) + (await programs.getByTestId("host-programs-later").count())).toBeGreaterThan(0);

  const res = await page.goto("/hosts/no-such-host-slug");
  expect(res?.status()).toBe(404);
});

test("호스트 프로필 관리: 직업·작업 철학 저장, 사진 올리기, 공개 페이지 반영", async ({ page }) => {
  const h = await createMember("e2epf");
  await makeApprovedHost(h.id, `프로필호스트${Date.now() % 10000}`);
  await login(page, h.email, "/host");
  await page.getByTestId("edit-profile-link").click();
  await expect(page).toHaveURL(/\/host\/profile$/);

  const form = page.getByTestId("host-profile-form");
  await form.getByLabel("직업·전문 분야 (한 줄)").fill("광고 사진가 · 스튜디오 운영");
  await form.getByLabel("호스트 소개").fill("10년간 브랜드 광고 사진을 찍었습니다. 빛을 읽는 법을 알려 드려요.");
  await form.getByLabel("작업 철학 (선택)").fill("장비보다 보는 눈을 먼저 기릅니다.");
  await form.getByLabel("경력").fill("광고 사진 스튜디오 포토그래퍼 10년, 브랜드 캠페인 다수");
  await form.getByTestId("avatar-input").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
  await expect(form.getByTestId("avatar-preview")).toBeVisible();
  await form.getByRole("button", { name: "프로필 저장" }).click();
  await expect(form.getByTestId("form-success")).toContainText("프로필을 저장했어요");

  // 다른 형식은 거절
  await form.getByTestId("avatar-input").setInputFiles({ name: "x.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await expect(form.getByRole("alert")).toContainText("jpg, png, webp");

  await page.goto("/host");
  await page.getByRole("link", { name: "공개 프로필 보기" }).click();
  await expect(page).toHaveURL(/\/hosts\/host-[0-9a-f]{8}$/);
  await expect(page.getByTestId("host-occupation")).toHaveText("광고 사진가 · 스튜디오 운영");
  await expect(page.getByTestId("host-philosophy")).toContainText("장비보다 보는 눈");
  await expect(page.getByTestId("host-avatar").locator("img")).toHaveAttribute("src", /host-avatars/);
});
