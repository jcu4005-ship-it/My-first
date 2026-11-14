import type { Page } from "@playwright/test";

import { expect, newContext, test } from "./fixtures";

import { isStaging, requireTestEnv } from "../support/env";
import { PASSWORD, adminApi, createMember, grantRoleDirect, makeApprovedHost } from "../support/fixtures";
import { totp } from "../support/totp";

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

test("호스트 팔로우: 비로그인 안내 → 로그인 후 팔로우 → 마이페이지 목록 → 취소", async ({ page, browser }) => {
  const h = await createMember("e2efh");
  const hostName = `팔로우호스트${Date.now() % 10000}`;
  await makeApprovedHost(h.id, hostName);
  const { data } = await adminApi().from("host_profiles").select("slug").eq("user_id", h.id).single();
  const path = `/hosts/${data!.slug}`;

  // 비로그인: 로그인 안내 링크
  const guest = await (await newContext(browser)).newPage();
  await guest.goto(path);
  await expect(guest.getByTestId("follow-login")).toHaveAttribute("href", `/login?next=${encodeURIComponent(path)}`);
  await expect(guest.getByTestId("follower-count")).toHaveText("팔로워 0명");
  await guest.context().close();

  // 회원: 마이페이지 빈 상태 → 팔로우 → 목록
  const m = await createMember("e2efm");
  await login(page, m.email, "/me");
  await expect(page.getByTestId("me-following")).toContainText("아직 팔로우한 호스트가 없어요");
  await page.goto(path);
  await page.getByTestId("follow-button").click();
  await expect(page.getByTestId("follow-button")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("follower-count")).toHaveText("팔로워 1명");
  await page.goto("/me");
  const item = page.locator(`[data-testid=followed-host][data-name="${hostName}"]`);
  await expect(item).toBeVisible();
  await expect(item).toContainText("지금 모집 중인 프로그램이 없어요");

  // 취소
  await item.getByRole("link", { name: hostName }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await page.getByTestId("follow-button").click();
  await expect(page.getByTestId("follow-button")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("follower-count")).toHaveText("팔로워 0명");

  // 호스트 본인 페이지에는 팔로우 버튼 없음
  const self = await (await newContext(browser)).newPage();
  await login(self, h.email, path);
  await expect(self.getByTestId("host-name")).toHaveText(hostName);
  await expect(self.getByTestId("follow")).toHaveCount(0);
  await self.context().close();
});

test("관리자 호스트 관리: 주소 변경 → 활동 중지(공개 화면에서 사라짐) → 재개 → 이력", async ({ page, browser }) => {
  const h = await createMember("e2emh");
  const hostName = `관리호스트${Date.now() % 10000}`;
  await makeApprovedHost(h.id, hostName);
  const a = await createMember("e2ema");
  await grantRoleDirect(a.id, "admin");
  const newSlug = `managed-${Date.now() % 1000000}`;

  await login(page, a.email);
  await page.goto("/admin/hosts?tab=approved");
  await expect(page).toHaveURL(/\/admin\/mfa/);
  const secret = (await page.getByTestId("mfa-secret").textContent())!.trim();
  await page.getByLabel(/6자리 코드/).fill(totp(secret));
  await page.getByRole("button", { name: "확인" }).click();
  await expect(page).toHaveURL(/\/admin\/hosts/);
  await page.locator(`[data-testid=host-row][data-name="${hostName}"]`).getByTestId("manage-host").click();
  await expect(page.getByTestId("admin-host")).toHaveAttribute("data-status", "approved");

  // 주소 변경
  await page.getByTestId("host-slug-form").getByRole("textbox").fill(newSlug);
  await page.getByTestId("host-slug-form").getByRole("button").click();
  await expect(page.getByTestId("current-slug")).toHaveText(`/hosts/${newSlug}`);
  const guest = await (await newContext(browser)).newPage();
  await guest.goto(`/hosts/${newSlug}`);
  await expect(guest.getByTestId("host-name")).toHaveText(hostName);

  // 활동 중지: 사유 필수 → 중지 → 공개 페이지 404
  page.on("dialog", (d) => d.accept());
  const deactivate = page.getByTestId("deactivate-host");
  await deactivate.getByRole("textbox").fill("짧음");
  await deactivate.getByRole("button").click();
  await expect(deactivate.getByTestId("form-error")).toContainText("5자 이상");
  await deactivate.getByRole("textbox").fill("운영 정책 확인을 위해 일시 중지");
  await deactivate.getByRole("button").click();
  await expect(page.getByTestId("admin-host")).toHaveAttribute("data-status", "suspended");
  expect((await guest.goto(`/hosts/${newSlug}`))?.status()).toBe(404);

  // 재개
  await page.getByTestId("reactivate-host").getByRole("textbox").fill("확인 완료, 활동 재개");
  await page.getByTestId("reactivate-host").getByRole("button").click();
  await expect(page.getByTestId("admin-host")).toHaveAttribute("data-status", "approved");
  expect((await guest.goto(`/hosts/${newSlug}`))?.status()).toBe(200);

  const history = page.getByTestId("host-history");
  await expect(history).toContainText("주소 변경");
  await expect(history).toContainText("활동 중지");
  await expect(history).toContainText("활동 재개");
});

test("프로그램 대표 사진: 호스트가 올리면 상세 화면에 보이고, 공개 중 변경은 감사 기록", async ({ page }) => {
  const h = await createMember("e2ecov");
  await makeApprovedHost(h.id, `사진호스트${Date.now() % 10000}`);
  const { data: m, error } = await adminApi().from("meetups").insert({ host_id: h.id, category_slug: "writing", title: `사진 테스트 프로그램 ${Date.now() % 100000}`,
    summary: "대표 사진 테스트용 프로그램입니다", description: "대표 사진 테스트용 프로그램의 상세 설명입니다. 충분히 길게 적습니다.",
    price: 0, max_quantity_per_booking: 1, learning_outcomes: "사진을 올릴 수 있어요.", status: "published", published_at: new Date().toISOString() }).select("id").single();
  if (error || !m) throw new Error(`프로그램 준비 실패: ${error?.message}`);
  const start = new Date(Date.now() + 5 * 86400000);
  await adminApi().from("meetup_sessions").insert({ meetup_id: m.id, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 7200000).toISOString(),
    area: "연남동", venue_name: "테스트 장소", address_detail: "테스트 주소", capacity: 6 });

  await login(page, h.email, `/host/meetups/${m.id}/edit`);
  const form = page.getByTestId("meetup-form");
  await form.getByTestId("meetup-cover-input").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: PNG });
  await expect(form.getByTestId("meetup-cover-preview")).toBeVisible();
  await form.getByRole("button", { name: "변경 내용 저장" }).click();
  await expect.poll(async () => (await adminApi().from("meetups").select("cover_path").eq("id", m.id).single()).data?.cover_path ?? "").toMatch(new RegExp(`^${h.id}/`));
  const { data: logs } = await adminApi().from("audit_logs").select("id").eq("action", "meetup.cover_change").eq("target_id", m.id);
  expect(logs?.length).toBeGreaterThan(0);

  await page.goto(`/meetups/${m.id}`);
  await expect(page.locator(`img[src*="meetup-covers"]`).first()).toBeVisible();
});

test("자동 테스트 호스트 숨김: is_test 이면 목록·검색에서 빠지고, 주소로는 그대로 열린다 (기록 유지)", async ({ page }) => {
  const m = await createMember("hidden");
  const name = `숨김호스트${m.id.slice(0, 6)}`;
  await makeApprovedHost(m.id, name);
  const search = `/hosts?q=${encodeURIComponent(name)}`;

  await page.goto(search);
  await expect(page.getByTestId("host-card").filter({ visible: true })).toHaveCount(1);

  const { error } = await adminApi().from("host_profiles").update({ is_test: true }).eq("user_id", m.id);
  expect(error).toBeNull();

  await page.goto(search);
  await expect(page.getByTestId("empty-state")).toContainText("찾는 호스트가 없어요");
  await page.goto(`/hosts/${m.id}`);
  await expect(page.getByTestId("host-name")).toHaveText(name);
  // 계정·프로필은 지워지지 않음
  const { data } = await adminApi().from("host_profiles").select("user_id, status").eq("user_id", m.id).single();
  expect(data?.status).toBe("approved");
});
