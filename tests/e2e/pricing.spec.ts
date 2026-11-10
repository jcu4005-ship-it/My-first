import { expect, newContext, test } from "./fixtures";

import { requireTestEnv } from "../support/env";
import { PASSWORD, adminApi, createMember, makeApprovedHost } from "../support/fixtures";

test.beforeAll(requireTestEnv);

test("참가비: 공개 후 내리면 바로 반영, 올리면 다시 검수(공개 목록에서 내려감)", async ({ page, browser }) => {
  const h = await createMember("e2eprh");
  await makeApprovedHost(h.id, `가격호스트${Date.now() % 10000}`);
  const title = `가격 테스트 프로그램 ${Date.now() % 100000}`;
  const { data: m, error } = await adminApi()
    .from("meetups")
    .insert({ host_id: h.id, category_slug: "writing", title, summary: "가격 테스트용 프로그램 요약입니다",
      description: "가격 테스트용 프로그램의 상세 설명입니다. 충분히 길게 적습니다.", price: 30000,
      learning_outcomes: "에세이 한 편을 처음부터 끝까지 완성할 수 있어요.",
      price_rationale: "2시간 실습, 재료비 포함, 6명 정원", status: "published", published_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !m) throw new Error(`프로그램 준비 실패: ${error?.message}`);
  const start = new Date(Date.now() + 6 * 86400000);
  await adminApi().from("meetup_sessions").insert({ meetup_id: m.id, starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 2 * 3600000).toISOString(), area: "연남동", venue_name: "테스트 장소", address_detail: "테스트 주소", capacity: 6 });

  await page.goto(`/login?next=${encodeURIComponent(`/host/meetups/${m.id}/edit`)}`);
  await page.getByLabel("이메일").fill(h.email);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(new RegExp(`/host/meetups/${m.id}/edit$`));
  await expect(page.getByLabel("가격 근거 (유료 프로그램은 필수)")).toHaveValue("2시간 실습, 재료비 포함, 6명 정원");

  // 내리기: 공개 유지
  await page.getByLabel("참가비 (원)").fill("25000");
  await page.getByTestId("meetup-form").getByRole("button").last().click();
  await expect(page.getByTestId("saved-notice")).toBeVisible();
  await expect(page.getByTestId("repriced-notice")).toHaveCount(0);
  await expect(page.getByTestId("status-pill").first()).toHaveText("공개 중");

  // 올리기: 검수 대기 + 공개 페이지 404
  await page.goto(`/host/meetups/${m.id}/edit`);
  await page.getByLabel("참가비 (원)").fill("300000");
  await page.getByTestId("meetup-form").getByRole("button").last().click();
  await expect(page.getByTestId("repriced-notice")).toBeVisible();
  await expect(page.getByTestId("status-pill").first()).toHaveText("검수 대기");
  const guest = await (await newContext(browser)).newPage();
  expect((await guest.goto(`/meetups/${m.id}`))?.status()).toBe(404);
});
