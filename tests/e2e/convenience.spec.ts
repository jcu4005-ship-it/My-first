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

function kstDate(daysAhead: number) {
  const d = new Date(Date.now() + daysAhead * 86400000 + 9 * 3600000);
  return d.toISOString().slice(0, 10);
}

test("참가자 편의: 확정 신청에 길찾기·내 캘린더(상세 주소 포함), 남의 신청 캘린더는 안 열림", async ({ browser }) => {
  const h = await createMember("e2ebth");
  await makeApprovedHost(h.id, `도구호스트${Date.now() % 10000}`);
  const title = `도구 시험 ${Date.now() % 100000}`;
  const { sessionId } = await freeProgram(h.id, title, 4);
  const p = await createMember("e2ebtp");
  const { data: bookingId } = await p.client.rpc("book_session", { p_session_id: sessionId, p_quantity: 1 });
  const page = await loginPage(browser, p.email);
  await page.goto("/me/bookings");
  const card = page.getByTestId("booking-card").filter({ hasText: title });
  await expect(card.getByTestId("map-naver")).toHaveAttribute("href", /map\.naver\.com/);
  await expect(card.getByTestId("map-kakao")).toHaveAttribute("href", /map\.kakao\.com/);
  await expect(card.getByTestId("booking-calendar")).toHaveAttribute("href", `/me/bookings/${bookingId}/calendar`);
  const ics = await page.evaluate(async (u) => { const r = await fetch(u); return { status: r.status, text: await r.text() }; }, `/me/bookings/${bookingId}/calendar`);
  expect(ics.status).toBe(200);
  expect(ics.text).toContain("BEGIN:VEVENT");
  expect(ics.text).toContain("TRIGGER:-PT2H");
  const other = await loginPage(browser, (await createMember("e2ebto")).email);
  const denied = await other.evaluate(async (u) => (await fetch(u)).status, `/me/bookings/${bookingId}/calendar`);
  expect(denied).toBe(404);
});

test("호스트 편의: 프로그램 복제 → 반복 일정 3회 한 번에 → 앞으로 7일·출석부 → 저장 수", async ({ browser }) => {
  const h = await createMember("e2ehth");
  await makeApprovedHost(h.id, `편의호스트${Date.now() % 10000}`);
  const title = `편의 시험 ${Date.now() % 100000}`;
  const { meetupId, sessionId } = await freeProgram(h.id, title, 6);
  const p = await createMember("e2ehtp");
  await p.client.rpc("book_session", { p_session_id: sessionId, p_quantity: 1 });

  const host = await loginPage(browser, h.email);
  // 앞으로 7일 + 출석부
  await host.goto("/host");
  const row = host.getByTestId("host-week-row").filter({ hasText: title });
  await expect(row).toContainText("1/6명");
  await row.getByTestId("roster-link").click();
  await expect(host.getByTestId("roster-row")).toHaveCount(1);
  await expect(host.getByTestId("roster-row")).toContainText(p.nickname);

  // 반복 일정: 매주 3회
  await host.goto(`/host/meetups/${meetupId}`);
  await host.waitForLoadState("networkidle");
  const form = host.getByTestId("add-session-form");
  await form.getByLabel("날짜").fill(kstDate(9));
  await form.getByLabel("시작").fill("19:00");
  await form.getByLabel("종료").fill("21:00");
  await form.getByLabel("동네 (공개)").fill("용산");
  await form.getByLabel("장소 이름 (공개)").fill("반복 시험 장소");
  await form.getByLabel("반복").selectOption("weekly");
  await form.getByLabel("모두 몇 번").selectOption("3");
  await form.getByRole("button", { name: "일정 추가" }).click();
  await expect(host.getByText("일정 3개를 추가했어요.")).toBeVisible();
  await expect(host.getByTestId("host-session")).toHaveCount(4);

  // 복제
  await host.getByTestId("duplicate-meetup").getByRole("button").click();
  await expect(host).toHaveURL(/copied=1/);
  await host.reload();
  await expect(host.getByTestId("manage-title")).toHaveText(`${title} (복사본)`);
  await expect(host.getByTestId("saved-notice")).toContainText("복제했어요");
  await expect(host.getByTestId("host-session")).toHaveCount(0);

  // 참가자가 저장 → 호스트에게 저장 수
  const viewer = await loginPage(browser, p.email);
  await viewer.goto(`/meetups/${meetupId}`);
  await viewer.waitForLoadState("networkidle");
  await viewer.getByTestId("save-button").first().click();
  // 저장은 버튼을 누른 뒤 서버에 기록됨 → 호스트 홈을 새로 열며 확인 (요소가 없으면 기다리지 않고 다음 번에 다시)
  await expect.poll(async () => {
    await host.goto("/host");
    const saves = host.getByTestId("host-meetup-row").filter({ hasText: title }).filter({ hasNotText: "복사본" }).getByTestId("meetup-saves");
    return (await saves.count()) ? ((await saves.first().innerText()) ?? "") : "";
  }, { timeout: 30_000, intervals: [1_000, 2_000, 3_000] }).toContain("저장한 사람 1명");

  // 다른 기기(새 브라우저)에서도 저장 목록이 보임
  const other = await loginPage(browser, p.email);
  await other.goto("/");
  await other.waitForLoadState("networkidle");
  await other.goto("/saved");
  await expect(other.getByTestId("saved-scope")).toContainText("계정에 저장돼요");
  await expect(other.getByTestId("saved-list")).toContainText(title);
});

test("크리에이터의 다른 프로그램 · 호스트 프로필 체크리스트", async ({ browser, page }) => {
  const h = await createMember("e2eoph");
  await makeApprovedHost(h.id, `다른프로호스트${Date.now() % 10000}`);
  const a = await freeProgram(h.id, `첫 번째 프로그램 ${Date.now() % 100000}`, 6);
  const bTitle = `두 번째 프로그램 ${Date.now() % 100000}`;
  await freeProgram(h.id, bTitle, 6);
  await page.goto(`/meetups/${a.meetupId}`);
  await expect(page.getByTestId("host-other-programs")).toContainText(bTitle);

  const host = await loginPage(browser, h.email);
  await host.goto("/host");
  const list = host.getByTestId("profile-checklist");
  await expect(list).toBeVisible();
  await expect(list.getByTestId("checklist-item").filter({ hasText: "첫 프로그램 공개" })).toHaveAttribute("data-done", "true");
  await expect(list.getByTestId("checklist-item").filter({ hasText: "작업 철학" })).toHaveAttribute("data-done", "false");
});
