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

/** 무료 프로그램 + 일정 1개 (처음에는 미래 일정) */
async function freeProgram(hostId: string, title: string, capacity = 6) {
  const { data: m, error } = await adminApi()
    .from("meetups")
    .insert({ host_id: hostId, category_slug: "writing", title, summary: "후기 시험용 프로그램 요약입니다",
      description: "후기 시험용 프로그램의 상세 설명입니다. 충분히 길게 적습니다.", price: 0, max_quantity_per_booking: 1,
      status: "published", published_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !m) throw new Error(`프로그램 준비 실패: ${error?.message}`);
  const start = new Date(Date.now() + 3 * 86400000);
  const { data: s, error: sErr } = await adminApi().from("meetup_sessions").insert({ meetup_id: m.id, starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 2 * 3600000).toISOString(), area: "용산", venue_name: "후기 시험 장소", address_detail: "시험 주소", capacity })
    .select("id").single();
  if (sErr || !s) throw new Error(`일정 준비 실패: ${sErr?.message}`);
  return { meetupId: m.id as string, sessionId: s.id as string };
}

test("대기 신청: 마감된 일정 → 대기 신청(내 예약에 표시, 호스트는 인원 수만) → 취소로 자리가 나면 알림 → 바로 신청 가능", async ({ browser }) => {
  const h = await createMember("e2ewlh");
  await makeApprovedHost(h.id, `대기호스트${Date.now() % 10000}`);
  const title = `대기 시험 프로그램 ${Date.now() % 100000}`;
  const { meetupId, sessionId } = await freeProgram(h.id, title, 1);
  const first = await createMember("e2ewl1");
  const { data: bookingId, error } = await first.client.rpc("book_session", { p_session_id: sessionId, p_quantity: 1 });
  expect(error).toBeNull();

  const p = await createMember("e2ewl2");
  const page = await loginPage(browser, p.email);
  await page.goto(`/meetups/${meetupId}`);
  await page.waitForLoadState("networkidle");
  const row = page.getByTestId("waitlist-row");
  await expect(row).toHaveCount(1);
  await row.getByTestId("waitlist-join").getByRole("button").click();
  await expect(page.getByText("대기 신청했어요.", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("waitlist-on")).toBeVisible();

  await page.goto("/me/bookings");
  await expect(page.getByTestId("my-waitlist")).toContainText(title);

  const host = await loginPage(browser, h.email);
  await host.goto(`/host/meetups/${meetupId}`);
  await expect(host.getByTestId("session-waitlist")).toContainText("대기 1명");
  await expect(host.getByText(p.nickname)).toHaveCount(0); // 누가 기다리는지는 보이지 않음

  // 먼저 신청한 사람이 취소 → 대기자에게 알림
  const { error: cErr } = await first.client.rpc("cancel_booking", { p_booking_id: bookingId });
  expect(cErr).toBeNull();
  await page.goto("/me/notifications");
  await expect(page.getByText("대기하던 일정에 자리가 났어요")).toBeVisible();
  await page.goto("/me/bookings");
  await expect(page.getByTestId("my-waitlist")).toContainText("자리 1개 생김");

  await page.goto(`/meetups/${meetupId}`);
  await page.waitForLoadState("networkidle");
  // 자리가 생겼으니 대기 목록 대신 바로 신청할 수 있음
  await expect(page.getByTestId("waitlist-row")).toHaveCount(0);
  await expect(page.getByTestId("book-submit")).toBeEnabled();
  await page.goto("/me/bookings");
  await expect(page.getByTestId("my-waitlist")).toHaveCount(1);
});

test("무료 신청 취소: 내 예약에서 취소하면 참가자 본인 알림에 '신청을 취소했어요'", async ({ browser }) => {
  const h = await createMember("e2ecnh");
  await makeApprovedHost(h.id, `취소알림호스트${Date.now() % 10000}`);
  const title = `취소 알림 시험 ${Date.now() % 100000}`;
  const { sessionId } = await freeProgram(h.id, title, 4);
  const p = await createMember("e2ecnp");
  expect((await p.client.rpc("book_session", { p_session_id: sessionId, p_quantity: 1 })).error).toBeNull();
  const page = await loginPage(browser, p.email);
  await page.goto("/me/bookings");
  await page.waitForLoadState("networkidle");
  page.once("dialog", (d) => void d.accept());
  await page.getByTestId("booking-card").filter({ hasText: title }).getByTestId("cancel-booking").getByRole("button").click();
  await expect(page.getByTestId("booking-card").filter({ hasText: title })).toContainText("취소함");
  await page.goto("/me/notifications");
  await expect(page.getByTestId("notification").filter({ hasText: "신청을 취소했어요" }).filter({ hasText: title })).toBeVisible();
});
