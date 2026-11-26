import type { Browser, Page } from "@playwright/test";

import { expect, newContext, test } from "./fixtures";

import { requireTestEnv } from "../support/env";
import { PASSWORD, adminApi, createMember, makeApprovedHost } from "../support/fixtures";

test.beforeAll(requireTestEnv);
test.setTimeout(240_000);

async function loginPage(browser: Browser, email: string): Promise<Page> {
  const page = await (await newContext(browser)).newPage();
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

function kstDate(daysAhead: number) {
  const d = new Date(Date.now() + daysAhead * 86400000 + 9 * 3600000);
  return d.toISOString().slice(0, 10);
}

test("드롭: 호스트가 열림 시각을 정함 → 열리기 전 신청 불가(화면·DB) → 알림 신청 → 열리면 알림 → 신청", async ({ browser }) => {
  // 준비: 호스트 + 공개 프로그램 + 지금 바로 신청되는 일정 1개
  const h = await createMember("e2edph");
  await makeApprovedHost(h.id, `드롭호스트${Date.now() % 10000}`);
  const title = `드롭 시험 프로그램 ${Date.now() % 100000}`;
  const { data: m, error } = await adminApi().from("meetups")
    .insert({ host_id: h.id, category_slug: "writing", title, summary: "드롭 시험용 프로그램 요약입니다", description: "드롭 시험용 프로그램의 상세 설명입니다. 충분히 길게 적습니다.",
      price: 0, max_quantity_per_booking: 1, status: "published", published_at: new Date().toISOString() })
    .select("id").single();
  if (error || !m) throw new Error(`프로그램 준비 실패: ${error?.message}`);
  const meetupId = m.id as string;
  const start = new Date(Date.now() + 3 * 86400000);
  const { error: sErr } = await adminApi().from("meetup_sessions").insert({ meetup_id: meetupId, starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 2 * 3600000).toISOString(), area: "용산", venue_name: "드롭 시험 장소", address_detail: "시험 주소", capacity: 6 });
  if (sErr) throw new Error(`일정 준비 실패: ${sErr.message}`);

  const p = await createMember("e2edpp");
  const f = await createMember("e2edpf");
  await adminApi().from("host_follows").insert({ follower_id: f.id, host_id: h.id });

  // 1. 호스트: 열림 시각이 있는 일정 추가 (날짜만 쓰면 안내, 둘 다 쓰면 저장)
  const host = await loginPage(browser, h.email);
  await host.goto(`/host/meetups/${meetupId}`);
  await host.waitForLoadState("networkidle");
  const form = host.getByTestId("add-session-form");
  await form.getByLabel("날짜", { exact: true }).fill(kstDate(4));
  await form.getByLabel("시작").fill("19:00");
  await form.getByLabel("종료").fill("21:00");
  await form.getByLabel("동네 (공개)").fill("용산");
  await form.getByLabel("장소 이름 (공개)").fill("드롭 시험 장소 2");
  await form.getByLabel("오픈 일자").fill(kstDate(1));
  await form.getByRole("button", { name: "일정 추가" }).click();
  await expect(form.getByText("오픈 일자와 시각을 함께 입력하거나, 둘 다 비워 주세요.")).toBeVisible();
  await form.getByLabel("오픈 시각").fill("10:00");
  await form.getByRole("button", { name: "일정 추가" }).click();
  await expect(host.getByText("일정을 추가했어요.")).toBeVisible();
  await expect(host.getByTestId("session-opens-at")).toContainText("열리기 전");

  const { data: sess } = await adminApi().from("meetup_sessions").select("id, opens_at").eq("meetup_id", meetupId).not("opens_at", "is", null);
  expect(sess).toHaveLength(1);
  const dropSession = sess![0].id as string;

  // 2. 참가자: 열리기 전 화면 — 카운트다운·알림 버튼, 그 일정은 신청 불가, 바로 열린 일정은 신청 가능
  const part = await loginPage(browser, p.email);
  await part.goto(`/meetups/${meetupId}`);
  await part.waitForLoadState("networkidle");
  await expect(part.getByTestId("drop-panel")).toBeVisible();
  await expect(part.getByTestId("drop-opens-label")).toContainText("내일 10:00에 열려요");
  await expect(part.getByTestId("opens-countdown").first()).toBeVisible();
  await expect(part.getByTestId("session-not-open")).toHaveCount(1);
  await expect(part.getByTestId("book-submit")).toBeVisible();

  // DB도 열리기 전 신청을 막음
  const blocked = await p.client.rpc("book_session", { p_session_id: dropSession, p_quantity: 1 });
  expect(blocked.error?.message ?? "").toContain("아직 열리지 않은");

  // 3. 열리면 알림 받기 켜기·끄기·다시 켜기
  const on = part.getByTestId("open-alert-on").first();
  await on.getByRole("button").click();
  await expect(part.getByText("알림을 켰어요.")).toBeVisible();
  await part.reload();
  await part.waitForLoadState("networkidle");
  await expect(part.getByTestId("open-alert-off").first()).toBeVisible();
  await part.getByTestId("open-alert-off").first().getByRole("button").click();
  await expect(part.getByText("알림을 껐어요.")).toBeVisible();
  await part.reload();
  await part.waitForLoadState("networkidle");
  await part.getByTestId("open-alert-on").first().getByRole("button").click();
  await expect(part.getByText("알림을 켰어요.")).toBeVisible();

  // 4. 곧 열리는 원 화면에 보임
  await part.goto("/drops");
  const item = part.getByTestId("drop-item").filter({ hasText: title });
  await expect(item).toBeVisible();
  await expect(item).toContainText("10:00"); // 열림 시각 (날짜는 위 묶음 제목 "내일")
  await expect(part.getByTestId("drop-day").filter({ has: item }).getByRole("heading").first()).toContainText("내일");
  await expect(part.getByTestId("my-open-alerts")).toContainText(title);

  // 5. 열림 시각이 되면 (서버 비밀키로 시각만 당김) → 화면에서 신청 가능, 예약 작업이 알림을 보냄
  const { error: moveErr } = await adminApi().from("meetup_sessions").update({ opens_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", dropSession);
  expect(moveErr).toBeNull();
  await part.goto(`/meetups/${meetupId}`);
  await part.waitForLoadState("networkidle");
  await expect(part.getByTestId("drop-panel")).toHaveCount(0);
  await expect(part.getByTestId("session-not-open")).toHaveCount(0);

  // 알림은 DB 예약 작업(매분)이 보냄: 알림 신청자·팔로워에게 각 1번, 호스트에게는 없음
  await expect.poll(async () => {
    const { data } = await adminApi().from("notifications").select("user_id").eq("kind", "drop.opened").in("user_id", [p.id, f.id, h.id]).like("link", `/meetups/${meetupId}%`);
    return (data ?? []).map((r) => r.user_id as string).sort().join(",");
  }, { timeout: 120_000, intervals: [3_000, 5_000, 5_000, 10_000] }).toBe([p.id, f.id].sort().join(","));
  await part.goto("/me/notifications");
  await expect(part.locator('[data-kind="drop.opened"]').filter({ hasText: title })).toHaveCount(1);

  // 6. 열린 뒤에는 신청됨
  const ok = await p.client.rpc("book_session", { p_session_id: dropSession, p_quantity: 1 });
  expect(ok.error).toBeNull();
});
