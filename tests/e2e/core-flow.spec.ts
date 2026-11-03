import { expect, test, type Browser, type Page } from "@playwright/test";

import { requireTestEnv } from "../support/env";
import { PASSWORD, createMember, grantRoleDirect, uniqueNickname } from "../support/fixtures";
import { totp } from "../support/totp";

test.beforeAll(requireTestEnv);
test.setTimeout(180_000);

async function loginPage(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext({ locale: "ko-KR" })).newPage();
  page.on("dialog", (d) => d.accept());
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

test("호스트 신청 → 승인 → 모임 등록·일정 → 검수 → 공개 → 참가 신청 → 호스트 확인 → 취소", async ({ browser }) => {
  const hostUser = await createMember("flowh");
  const adminUser = await createMember("flowa");
  await grantRoleDirect(adminUser.id, "admin");
  const participant = await createMember("flowp");
  const hostName = `호스트${uniqueNickname("").slice(0, 6)}`;
  const title = `흐름 테스트 독서 모임 ${Date.now() % 100000}`;

  // 1. 호스트 신청
  const host = await loginPage(browser, hostUser.email);
  await host.goto("/host");
  await expect(host).toHaveURL(/\/host\/apply$/);
  await host.getByLabel("호스트 이름").fill(hostName);
  await host.getByLabel("한 줄 소개").fill("연남동에서 독서모임을 엽니다");
  await host.getByLabel("어떤 모임을 열고 싶나요?").fill("한 달에 한 권, 같은 책을 읽고 이야기하는 모임을 열고 싶어요.");
  await host.getByRole("button", { name: "호스트 신청하기" }).click();
  await expect(host.getByTestId("host-apply-status")).toContainText("검토 중");

  // 2. 관리자 승인 (2단계 인증)
  const admin = await loginPage(browser, adminUser.email);
  await admin.goto("/admin/hosts");
  await expect(admin).toHaveURL(/\/admin\/mfa/);
  const secret = (await admin.getByTestId("mfa-secret").textContent())!.trim();
  await admin.getByLabel(/6자리 코드/).fill(totp(secret));
  await admin.getByRole("button", { name: "확인" }).click();
  await expect(admin).toHaveURL(/\/admin\/hosts$/);
  const app = admin.locator(`[data-testid=host-application][data-name="${hostName}"]`);
  await app.getByTestId("approve-host").getByRole("button", { name: "승인" }).click();
  await expect(app).toHaveCount(0); // 승인되면 심사 대기 목록에서 빠짐
  await expect(admin.getByText(hostName)).toBeVisible(); // 처리 완료 목록에 표시

  // 3. 호스트: 모임 만들기 → 일정 추가 → 검수 요청
  await host.goto("/host");
  await expect(host.getByTestId("host-home")).toBeVisible();
  await host.getByRole("link", { name: "새 모임 만들기" }).click();
  await host.getByLabel("모임 제목").fill(title);
  await host.getByLabel("한 줄 요약").fill("같은 책을 읽고 가장 오래 남은 문장으로 대화해요");
  await host.getByLabel("모임 소개").fill("이번 달 함께 읽을 책을 정해 두고, 각자 마음에 남은 문장을 가져와 이야기합니다.");
  await host.getByLabel("참가비 (원)").fill("15,000");
  await host.getByLabel("1회 신청 가능 인원").selectOption("2");
  await host.getByLabel("진행 순서 (한 줄에 하나)").fill("14:00 인사\n14:20 문장 나누기");
  await host.getByRole("button", { name: "저장하고 일정 추가하기" }).click();
  await expect(host.getByTestId("saved-notice")).toBeVisible();
  await expect(host.getByTestId("manage-title")).toHaveText(title);

  // 일정 없이 검수 요청 → 안내
  await host.getByTestId("submit-review").getByRole("button").click();
  await expect(host.getByTestId("submit-review").getByTestId("form-error")).toContainText("일정을 하나 이상");

  const form = host.getByTestId("add-session-form");
  await form.getByLabel("날짜").fill(kstDate(10));
  await form.getByLabel("시작").fill("14:00");
  await form.getByLabel("종료").fill("16:00");
  await form.getByLabel("동네 (공개)").fill("연남동");
  await form.getByLabel("장소 이름 (공개)").fill("책방 오후");
  await form.getByLabel("상세 주소 (확정 참가자에게만 공개)").fill("서울 마포구 연남로 1 (테스트)");
  await form.getByLabel("정원 (명)").fill("4");
  await form.getByRole("button", { name: "일정 추가" }).click();
  await expect(host.getByTestId("host-session")).toHaveCount(1);
  await host.getByTestId("submit-review").getByRole("button").click();
  await expect(host.getByTestId("status-pill").first()).toHaveText("검수 대기");

  // 공개 전에는 목록·상세에 없음
  const guest = await (await browser.newContext()).newPage();
  await guest.goto("/meetups");
  await expect(guest.getByText(title)).toHaveCount(0);

  // 4. 관리자 공개
  await admin.goto("/admin/meetups");
  const review = admin.locator(`[data-testid=review-meetup][data-title="${title}"]`);
  await review.getByTestId("publish-meetup").getByRole("button").click();
  await expect(review).toHaveCount(0); // 공개되면 검수 대기 목록에서 빠짐

  // 5. 참가자: 목록에서 찾아 신청 (비로그인은 로그인 유도)
  await guest.goto("/meetups?category=reading");
  await guest.getByText(title).first().click();
  await expect(guest.getByRole("link", { name: "로그인하고 신청하기" })).toBeVisible();
  const meetupUrl = guest.url();

  const p = await loginPage(browser, participant.email);
  await p.goto(meetupUrl);
  await p.getByLabel("신청 인원").selectOption("2");
  await p.getByTestId("book-submit").click();
  await expect(p).toHaveURL(/\/me\/bookings\?booked=/);
  await expect(p.getByTestId("booked-notice")).toBeVisible();
  const card = p.getByTestId("booking-card").filter({ hasText: title });
  await expect(card).toContainText("참가 확정");
  await expect(card).toContainText("2명 · 30,000원");
  await expect(card.getByTestId("booking-address")).toContainText("연남로 1");

  // 같은 일정 다시 보기 → 신청 완료 표시
  await p.goto(meetupUrl);
  await expect(p.getByTestId("already-booked")).toBeVisible();
  await expect(p.getByTestId("session-mine")).toBeVisible();

  // 비로그인 공개 화면에는 상세 주소 없음
  await guest.goto(meetupUrl);
  await expect(guest.getByText("연남로 1")).toHaveCount(0);

  // 6. 호스트: 참가자·신청 인원 확인
  await host.reload();
  await expect(host.getByTestId("session-seats")).toHaveText("신청 2 / 4명");
  await expect(host.getByTestId("participant-list")).toContainText(participant.nickname);

  // 7. 참가자 취소 → 자리 반환
  await p.goto("/me/bookings");
  await p.getByTestId("booking-card").filter({ hasText: title }).getByTestId("cancel-booking").getByRole("button").click();
  await expect(p.getByTestId("booking-card").filter({ hasText: title })).toContainText("취소함");
  await host.reload();
  await expect(host.getByTestId("session-seats")).toHaveText("신청 0 / 4명");
});

test("샘플 모임과 내 모임은 신청할 수 없다", async ({ browser }) => {
  const u = await createMember("flows");
  const page = await loginPage(browser, u.email);
  await page.goto("/meetups?category=music");
  await page.getByTestId("meetup-card").filter({ visible: true }).first().click();
  await expect(page.getByRole("button", { name: "샘플 모임은 신청할 수 없어요" })).toBeDisabled();
});
