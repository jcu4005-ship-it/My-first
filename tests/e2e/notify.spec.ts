import type { Browser, Page } from "@playwright/test";

import { expect, newContext, test } from "./fixtures";

import { requireTestEnv } from "../support/env";
import { PASSWORD, adminApi, createMember, makeApprovedHost } from "../support/fixtures";

test.beforeAll(requireTestEnv);
test.setTimeout(120_000);

async function loginPage(browser: Browser, email: string): Promise<Page> {
  const page = await (await newContext(browser)).newPage();
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

test("팔로우 알림·안내: 팔로우한 크리에이터의 새 프로그램이 처음 공개되면 알림, 일정이 지난 공개 프로그램은 호스트에게 '목록에 안 보여요' 안내", async ({ browser }) => {
  const h = await createMember("e2enfh");
  const hostName = `알림호스트${Date.now() % 10000}`;
  await makeApprovedHost(h.id, hostName);
  const fan = await createMember("e2enff");
  const { error: fErr } = await adminApi().from("host_follows").insert({ follower_id: fan.id, host_id: h.id });
  expect(fErr).toBeNull();

  const title = `팔로우 알림 프로그램 ${Date.now() % 100000}`;
  const { data: m, error } = await adminApi()
    .from("meetups")
    .insert({ host_id: h.id, category_slug: "writing", title, summary: "팔로우 알림 시험용 요약입니다",
      description: "팔로우 알림 시험용 프로그램 설명입니다. 충분히 길게 적습니다.", price: 0, max_quantity_per_booking: 1, status: "pending_review" })
    .select("id").single();
  expect(error).toBeNull();
  const past = new Date(Date.now() - 2 * 86400000);
  await adminApi().from("meetup_sessions").insert({ meetup_id: m!.id, starts_at: past.toISOString(),
    ends_at: new Date(past.getTime() + 7200000).toISOString(), area: "용산", venue_name: "알림 시험 장소", address_detail: "", capacity: 4 });
  // 운영팀 공개 승인(서비스 키로 상태만 바꿈 — 승인 화면 흐름은 core-flow에서 검사)
  const { error: pErr } = await adminApi().from("meetups").update({ status: "published", published_at: new Date().toISOString() }).eq("id", m!.id);
  expect(pErr).toBeNull();

  const fp = await loginPage(browser, fan.email);
  await fp.goto("/me/notifications");
  await expect(fp.getByText(`${hostName}님의 새 프로그램`)).toBeVisible();
  await expect(fp.getByText(title)).toBeVisible();

  const hp = await loginPage(browser, h.email);
  await hp.goto("/host");
  await expect(hp.getByTestId("host-meetup-row").filter({ hasText: title }).getByTestId("no-upcoming-warning")).toBeVisible();
  await hp.goto(`/host/meetups/${m!.id}`);
  await expect(hp.getByTestId("no-upcoming-warning")).toContainText("일정을 추가해 주세요");
});
