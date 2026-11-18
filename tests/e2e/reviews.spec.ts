import type { Browser, Page } from "@playwright/test";

import { expect, newContext, test } from "./fixtures";

import { requireTestEnv } from "../support/env";
import { PASSWORD, adminApi, createMember, grantRoleDirect, makeApprovedHost } from "../support/fixtures";
import { totp } from "../support/totp";

test.beforeAll(requireTestEnv);
test.setTimeout(150_000);

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
async function freeProgram(hostId: string, title: string) {
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
    ends_at: new Date(start.getTime() + 2 * 3600000).toISOString(), area: "용산", venue_name: "후기 시험 장소", address_detail: "시험 주소", capacity: 6 })
    .select("id").single();
  if (sErr || !s) throw new Error(`일정 준비 실패: ${sErr?.message}`);
  return { meetupId: m.id as string, sessionId: s.id as string };
}

test("다가오는 일정: 공유하기·캘린더 파일(상세 주소 없음), 호스트 공지 → 참가자 알림", async ({ browser, page }) => {
  const h = await createMember("e2ervh");
  await makeApprovedHost(h.id, `공지호스트${Date.now() % 10000}`);
  const { meetupId, sessionId } = await freeProgram(h.id, `공지 시험 프로그램 ${Date.now() % 100000}`);
  const p = await createMember("e2ervp");
  const { error } = await p.client.rpc("book_session", { p_session_id: sessionId, p_quantity: 1 });
  expect(error).toBeNull();

  await page.goto(`/meetups/${meetupId}`);
  await expect(page.getByTestId("share-button")).toBeVisible();
  const cal = page.getByTestId("calendar-link");
  await expect(cal).toHaveAttribute("href", `/meetups/${meetupId}/calendar?session=${sessionId}`);
  // 브라우저 안에서 받음 (스테이징 접근 보호 우회 값이 브라우저 요청에만 붙기 때문)
  const fetchIn = (url: string) =>
    page.evaluate(async (u) => {
      const r = await fetch(u);
      return { status: r.status, type: r.headers.get("content-type") ?? "", text: await r.text() };
    }, url);
  const res = await fetchIn(`/meetups/${meetupId}/calendar?session=${sessionId}`);
  expect(res.status).toBe(200);
  expect(res.type).toContain("text/calendar");
  expect(res.text).toContain("BEGIN:VEVENT");
  expect(res.text).toContain("후기 시험 장소");
  expect(res.text).not.toContain("시험 주소"); // 상세 주소는 참가 확정자에게만
  // 없는 일정은 404
  expect((await fetchIn(`/meetups/${meetupId}/calendar?session=00000000-0000-0000-0000-000000000000`)).status).toBe(404);
  // 아직 후기 없음 표시 (지어낸 후기 없음)
  await expect(page.getByTestId("reviews-empty")).toBeVisible();

  // 호스트 공지
  const host = await loginPage(browser, h.email);
  await host.goto(`/host/meetups/${meetupId}`);
  await host.waitForLoadState("networkidle");
  const notice = host.getByTestId("notice-form");
  await notice.getByRole("textbox").fill("짧");
  await notice.getByRole("button", { name: "공지 보내기" }).click();
  await expect(notice.getByText("공지는 5자 이상 적어 주세요.")).toBeVisible();
  await expect(notice.getByRole("textbox")).toHaveValue("짧"); // 오류가 나도 쓴 내용은 그대로
  await notice.getByRole("textbox").fill("입구는 건물 뒤편이에요. 5분 일찍 와 주세요.");
  await notice.getByRole("button", { name: "공지 보내기" }).click();
  await expect(notice.getByText("참가자 1명에게 공지를 보냈어요.")).toBeVisible();
  await expect(notice.getByRole("textbox")).toHaveValue(""); // 보내고 나면 비움

  const part = await loginPage(browser, p.email);
  await part.goto("/me/notifications");
  await expect(part.getByText("입구는 건물 뒤편이에요. 5분 일찍 와 주세요.")).toBeVisible();
});

test("후기: 출석 체크 → 참가자 후기(별점·검사) → 공개 → 호스트 답글 → 관리자 가리기(사유·감사 기록) → 공개에서 빠짐", async ({ browser }) => {
  const h = await createMember("e2ervh2");
  const hostName = `후기호스트${Date.now() % 10000}`;
  await makeApprovedHost(h.id, hostName);
  const title = `후기 시험 프로그램 ${Date.now() % 100000}`;
  const { meetupId, sessionId } = await freeProgram(h.id, title);
  const p = await createMember("e2ervp2");
  const absent = await createMember("e2ervp3");
  for (const m of [p, absent]) {
    const { error } = await m.client.rpc("book_session", { p_session_id: sessionId, p_quantity: 1 });
    expect(error).toBeNull();
  }
  // 프로그램이 끝난 것으로 (서비스 키로 시간만 옮김)
  const past = new Date(Date.now() - 2 * 86400000);
  const { error: mvErr } = await adminApi().from("meetup_sessions")
    .update({ starts_at: past.toISOString(), ends_at: new Date(past.getTime() + 2 * 3600000).toISOString() }).eq("id", sessionId);
  expect(mvErr).toBeNull();

  // 1. 호스트: 출석 체크 (한 명 참석, 한 명 불참)
  const host = await loginPage(browser, h.email);
  await host.goto(`/host/meetups/${meetupId}`);
  await host.waitForLoadState("networkidle");
  const rowP = host.getByTestId("attendance-row").filter({ hasText: p.nickname });
  const rowA = host.getByTestId("attendance-row").filter({ hasText: absent.nickname });
  await rowP.getByTestId("mark-attended").getByRole("button").click();
  await expect(rowP.getByText("참석으로 체크했어요.")).toBeVisible();
  await rowA.getByTestId("mark-absent").getByRole("button").click();
  await expect(rowA.getByText("불참으로 체크했어요.")).toBeVisible();
  await host.reload();
  await expect(host.getByTestId("attendance-row").filter({ hasText: p.nickname }).getByTestId("attendance-state")).toHaveText("참석");
  await expect(host.getByTestId("session-state").first()).toHaveText("종료"); // 지난 일정은 "모집 중"이 아니라 "종료"

  // 2. 불참 처리된 사람은 후기를 쓸 수 없음
  const ab = await loginPage(browser, absent.email);
  await ab.goto("/me/reviews");
  await expect(ab.getByTestId("my-review-item").filter({ hasText: title }).getByTestId("review-form")).toHaveCount(0);

  // 3. 참가자 후기: 검사 → 저장
  const part = await loginPage(browser, p.email);
  await part.goto("/me/bookings");
  await part.getByTestId("write-review-link").click();
  await expect(part).toHaveURL(/\/me\/reviews$/);
  await part.waitForLoadState("networkidle");
  const item = part.getByTestId("my-review-item").filter({ hasText: title });
  const form = item.getByTestId("review-form");
  await form.getByRole("textbox").fill("짧은 후기");
  await form.getByRole("button", { name: "후기 남기기" }).click();
  await expect(form.getByText("별점을 골라 주세요.")).toBeVisible();
  await form.getByLabel("5점").check({ force: true });
  await form.getByRole("button", { name: "후기 남기기" }).click();
  await expect(form.getByText("후기는 10자 이상 적어 주세요.")).toBeVisible();
  await form.getByRole("textbox").fill("작은 자리라서 한 사람씩 깊게 이야기할 수 있었어요.");
  await form.getByRole("button", { name: "후기 남기기" }).click();
  // 저장되면 그 자리가 "후기를 남겼어요 ★" 로 바뀜 (새로고침해도 그대로)
  await expect(item.getByTestId("review-done")).toBeVisible();
  await part.reload();
  await expect(part.getByTestId("my-review-item").filter({ hasText: title }).getByTestId("review-done")).toBeVisible();

  // 4. 공개: 프로그램 상세·크리에이터 페이지 (닉네임만)
  await part.goto(`/meetups/${meetupId}`);
  const pub = part.getByTestId("reviews").getByTestId("review-item");
  await expect(pub).toHaveCount(1);
  await expect(pub).toContainText(p.nickname);
  await expect(part.getByTestId("review-summary")).toContainText("5.0");

  // 5. 호스트: 활동 요약 + 답글
  await host.goto("/host");
  await expect(host.getByTestId("host-stats")).toContainText("5.0");
  await host.getByTestId("host-reviews-link").click();
  await host.waitForLoadState("networkidle");
  const hr = host.getByTestId("host-review-item").filter({ hasText: title });
  await hr.getByTestId("reply-form").getByRole("textbox").fill("와 주셔서 고마워요! 다음에도 만나요.");
  await hr.getByTestId("reply-form").getByRole("button").click();
  await expect(hr.getByText("답글을 남겼어요.", { exact: false })).toBeVisible();
  await part.goto(`/meetups/${meetupId}`);
  await expect(part.getByTestId("review-reply")).toContainText("다음에도 만나요");

  // 6. 관리자: 신청 현황·후기 가리기 (2단계 인증, 사유, 감사 기록)
  const a = await createMember("e2erva");
  await grantRoleDirect(a.id, "admin");
  const admin = await loginPage(browser, a.email);
  await admin.goto("/admin/reviews");
  await expect(admin).toHaveURL(/\/admin\/mfa/);
  const secret = (await admin.getByTestId("mfa-secret").textContent())!.trim();
  await admin.getByLabel(/6자리 코드/).fill(totp(secret));
  await admin.getByRole("button", { name: "확인" }).click();
  await expect(admin).toHaveURL(/\/admin\/reviews$/);
  await admin.waitForLoadState("networkidle");
  const ar = admin.getByTestId("admin-review-item").filter({ hasText: title });
  await ar.getByTestId("review-hide-form").getByRole("textbox").fill("짧음");
  await ar.getByTestId("review-hide-form").getByRole("button", { name: "가리기" }).click();
  await expect(ar.getByText("사유를 5자 이상 입력해 주세요.")).toBeVisible();
  await ar.getByTestId("review-hide-form").getByRole("textbox").fill("E2E 가리기 시험");
  await ar.getByTestId("review-hide-form").getByRole("button", { name: "가리기" }).click();
  await expect(ar.getByText("후기를 가렸어요.")).toBeVisible();
  await admin.goto("/admin/audit");
  await expect(admin.locator(`[data-testid="audit-row"][data-action="review.hide"]`).first()).toBeVisible();
  await admin.goto("/admin");
  await expect(admin.getByTestId("admin-overview")).toBeVisible();
  await admin.goto("/admin/bookings");
  await expect(admin.getByTestId("admin-booking-row").filter({ hasText: title }).first()).toBeVisible();

  // 7. 가린 후기는 공개 화면에서 빠짐
  await part.goto(`/meetups/${meetupId}`);
  await expect(part.getByTestId("reviews-empty")).toBeVisible();
});
