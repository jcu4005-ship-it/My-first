import type { Browser, Page } from "@playwright/test";

import { expect, newContext, test } from "./fixtures";

import { isStaging, requireTestEnv } from "../support/env";
import { PASSWORD, createMember, grantRoleDirect, revokeRoleDirect, uniqueNickname } from "../support/fixtures";
import { totp } from "../support/totp";

test.beforeAll(requireTestEnv);
test.setTimeout(180_000);

async function loginPage(browser: Browser, email: string): Promise<Page> {
  const page = await (await newContext(browser)).newPage();
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

test("호스트 지원서(임시 저장·수정 요청·재제출) → 승인 → 프로그램 등록·일정 → 검수 → 공개 → 참가 신청 → 호스트 확인 → 취소", async ({ browser }) => {
  const hostUser = await createMember("flowh");
  const adminUser = await createMember("flowa");
  await grantRoleDirect(adminUser.id, "admin");
  try {
  const participant = await createMember("flowp");
  const hostName = `호스트${uniqueNickname("").slice(0, 6)}`;
  const title = `흐름 테스트 글쓰기 프로그램 ${Date.now() % 100000}`;

  // 1. 호스트 지원: 임시 저장 → 필수 항목 검사 → 제출
  const host = await loginPage(browser, hostUser.email);
  await host.goto("/host");
  await expect(host).toHaveURL(/\/become-a-host\/apply$/);
  const appForm = host.getByTestId("host-application-form");
  await appForm.getByLabel("호스트 이름", { exact: true }).fill(hostName);
  await appForm.getByLabel("휴대폰 번호", { exact: true }).fill("010-1234-5678");
  await appForm.getByLabel("지원 분류").selectOption("creators");
  await appForm.getByLabel("한 줄 소개").fill("출판사 편집자 출신 글쓰기 코치");
  await appForm.getByLabel("전문성과 경력").fill("짧음");
  await appForm.getByLabel("포트폴리오·활동 링크 (선택)").fill("http://not-secure.example");
  await appForm.getByRole("button", { name: "지원서 제출하기" }).click();
  await expect(appForm.getByText("https:// 로 시작하는 링크")).toBeVisible();
  await expect(appForm.getByText("가르칠 분야의 경력을 20자 이상")).toBeVisible();
  await expect(appForm.getByText("동의해 주세요")).toBeVisible();
  await appForm.getByLabel("포트폴리오·활동 링크 (선택)").fill("https://example.com/portfolio");
  await appForm.getByLabel("전문성과 경력").fill("출판사 에세이 편집자 10년, 글쓰기 원데이 프로그램 3년 진행");
  await appForm.getByRole("button", { name: "임시 저장" }).click();
  await expect(appForm.getByTestId("form-success")).toContainText("임시 저장");
  await host.reload();
  await expect(host.getByTestId("application-status")).toHaveAttribute("data-status", "draft");
  await expect(host.getByTestId("host-application-form").getByLabel("전문성과 경력")).toHaveValue(/출판사 에세이 편집자 10년/);
  const form2 = host.getByTestId("host-application-form");
  await form2.getByLabel("자기소개").fill("에세이 한 편을 처음부터 끝까지 완성하는 소수 정예 글쓰기 프로그램을 열고 싶어요.");
  await form2.getByLabel("프로그램 기획안").fill("대상: 글쓰기 입문 직장인 / 2시간 / 구조 배우기 → 한 편 쓰기 → 현장 첨삭 / 4만 원");
  await form2.getByLabel("참가자에게 줄 가치").fill("에세이 한 편을 완성해 가요");
  await form2.getByTestId("consent").getByRole("checkbox").check();
  await form2.getByRole("button", { name: "지원서 제출하기" }).click();
  await expect(host.getByTestId("application-status")).toHaveAttribute("data-status", "submitted");
  await host.reload();
  await expect(host.getByTestId("application-status")).toHaveAttribute("data-status", "submitted");
  await expect(host.getByTestId("application-summary")).toBeVisible(); // 심사 중에는 읽기 전용
  await host.goto("/me");
  await expect(host.getByTestId("me-application")).toHaveAttribute("data-status", "submitted"); // 마이페이지에서도 지원 상태 확인

  // 2. 관리자: 수정 요청 → 지원자 보완·재제출 → 승인 (2단계 인증)
  const admin = await loginPage(browser, adminUser.email);
  await admin.goto("/admin/hosts");
  await expect(admin).toHaveURL(/\/admin\/mfa/);
  const secret = (await admin.getByTestId("mfa-secret").textContent())!.trim();
  await admin.getByLabel(/6자리 코드/).fill(totp(secret));
  await admin.getByRole("button", { name: "확인" }).click();
  await expect(admin).toHaveURL(/\/admin\/hosts$/);
  await admin.locator(`[data-testid=host-application][data-name="${hostName}"]`).click();
  const detail = admin.getByTestId("application-detail");
  // 연락처는 기본으로 가려져 있고, 사유를 적어야 원문이 보여요 (감사 기록)
  const contact = detail.getByTestId("contact-reveal");
  await expect(contact.getByTestId("contact-reveal-value")).toHaveText("010-****-5678");
  await contact.getByRole("button", { name: "휴대폰 번호 보기" }).click();
  await expect(contact.getByRole("alert")).toContainText("5자 이상");
  await contact.getByRole("textbox").fill("심사 결과 안내 통화");
  await contact.getByRole("button", { name: "휴대폰 번호 보기" }).click();
  await expect(contact.getByTestId("contact-reveal-value")).toHaveText("010-1234-5678");
  await expect(detail).toContainText("https://example.com/portfolio");
  await detail.getByTestId("start-review").getByRole("button").click();
  await expect(detail.getByTestId("start-review")).toHaveCount(0);
  await detail.getByTestId("request-revision").getByRole("textbox").fill("기획안에 준비물을 추가해 주세요");
  await detail.getByTestId("request-revision").getByRole("button").click();
  await expect(admin.getByTestId("application-detail")).toHaveAttribute("data-status", "revision_requested");

  await host.goto("/become-a-host/apply");
  await expect(host.getByTestId("revision-note")).toContainText("준비물을 추가");
  const form3 = host.getByTestId("host-application-form");
  await form3.getByLabel("프로그램 기획안").fill("대상: 글쓰기 입문 직장인 / 2시간 / 준비물: 노트북 / 구조 배우기 → 한 편 쓰기 → 현장 첨삭 / 4만 원");
  await form3.getByRole("button", { name: "지원서 제출하기" }).click();
  await expect(host.getByTestId("application-status")).toHaveAttribute("data-status", "submitted");

  await admin.reload();
  await admin.getByTestId("application-detail").getByTestId("approve-host").getByRole("button", { name: "승인" }).click();
  await expect(admin.getByTestId("application-detail")).toHaveAttribute("data-status", "approved");
  await expect(admin.getByTestId("application-history")).toContainText("수정 요청");

  // 3. 호스트: 프로그램 만들기 → 일정 추가 → 검수 요청
  await host.goto("/host");
  await expect(host.getByTestId("host-home")).toBeVisible();
  await host.getByRole("link", { name: "새 프로그램 만들기" }).click();
  await host.getByLabel("프로그램 제목").fill(title);
  await host.getByLabel("카테고리").selectOption("writing");
  await host.getByLabel("난이도").selectOption("beginner");
  await host.getByLabel("한 줄 요약").fill("에세이 한 편을 구조부터 퇴고까지 완성해요");
  await host.getByLabel("프로그램 소개").fill("좋은 에세이의 구조를 배우고, 각자 한 편을 써서 현장에서 첨삭받습니다.");
  await host.getByLabel("수업이 끝나면 할 수 있는 것").fill("에세이 한 편을 도입-전개-마무리 구조로 쓸 수 있어요.\n내 문장을 스스로 퇴고할 수 있어요.");
  await host.getByLabel("재료·도구 제공 안내 (선택)").fill("첨삭 양식 제공, 노트북 필요");
  await host.getByLabel("참가비 (원)").fill("15,000");
  await host.getByLabel("가격 근거 (유료 프로그램은 필수)").fill("2시간 첨삭 포함, 4명 정원, 첨삭 양식 제공");
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
  const guest = await (await newContext(browser)).newPage();
  await guest.goto("/meetups");
  await expect(guest.getByText(title)).toHaveCount(0);

  // 4. 관리자 공개
  await admin.goto("/admin/meetups");
  const review = admin.locator(`[data-testid=review-meetup][data-title="${title}"]`);
  await expect(review.getByTestId("price-rationale")).toContainText("2시간 첨삭 포함"); // 운영팀이 가격 근거를 함께 검수
  await review.getByTestId("publish-meetup").getByRole("button").click();
  await expect(review).toHaveCount(0); // 공개되면 검수 대기 목록에서 빠짐

  // 5. 참가자: 목록에서 찾아 신청 (비로그인은 로그인 유도)
  await guest.goto("/meetups?category=writing");
  await guest.getByText(title).first().click();
  await expect(guest.getByRole("link", { name: "로그인하고 초대 수락하기" })).toBeVisible();
  const meetupUrl = guest.url();

  const p = await loginPage(browser, participant.email);
  await p.goto(meetupUrl);
  await expect(p.getByTestId("class-level")).toHaveText("입문");
  await expect(p.getByTestId("learning-outcomes")).toContainText("내 문장을 스스로 퇴고할 수 있어요.");
  await expect(p.getByTestId("host-career")).toContainText("출판사 에세이 편집자 10년");
  await p.getByLabel("신청 인원").selectOption("2");
  await p.getByTestId("book-submit").click();
  // 유료 모임 → 테스트 결제 화면 (실제 청구 없음)
  await expect(p).toHaveURL(/\/checkout\//);
  await expect(p.getByTestId("test-payment-notice")).toBeVisible();
  await expect(p.getByTestId("checkout")).toContainText("30,000원");
  await p.getByTestId("pay-test").click();
  await expect(p).toHaveURL(/\/me\/bookings\?booked=/);
  await expect(p.getByTestId("booked-notice")).toBeVisible();
  const card = p.getByTestId("booking-card").filter({ hasText: title });
  await expect(card).toContainText("참가 확정");
  await expect(card).toContainText("2명 · 호스트");
  await expect(card).toContainText("30,000원");
  await expect(card).toContainText("결제 완료 (테스트)");
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

  // 호스트에게 새 신청 알림
  const manageUrl = host.url();
  await host.goto("/me/notifications");
  await expect(host.getByTestId("notification").filter({ hasText: "새 참가 신청" }).first()).toBeVisible();

  // 7. 참가자 취소 → 전액 환불(테스트) → 자리 반환
  await p.goto("/me/bookings");
  await p.getByTestId("booking-card").filter({ hasText: title }).getByTestId("cancel-booking").getByRole("button").click();
  const cancelled = p.getByTestId("booking-card").filter({ hasText: title });
  await expect(cancelled).toContainText("취소함");
  await expect(cancelled).toContainText("30,000원 환불 완료");
  await host.goto(manageUrl);
  await expect(host.getByTestId("session-seats")).toHaveText("신청 0 / 4명");

  // 8. 다시 신청·결제 후 호스트가 일정 취소 → 참가자 전액 환불·알림
  await p.goto(meetupUrl);
  await p.getByTestId("book-submit").click();
  await p.getByTestId("pay-test").click();
  await expect(p).toHaveURL(/\/me\/bookings\?booked=/);
  await host.goto(manageUrl);
  await expect(host.getByTestId("session-seats")).toHaveText("신청 1 / 4명");
  const cancelForm = host.getByTestId("cancel-session");
  await cancelForm.getByPlaceholder("취소 사유 (신청자에게 전달)").fill("호스트 개인 사정으로 취소합니다");
  await cancelForm.getByRole("button").click();
  await expect(host.getByTestId("host-session")).toContainText("취소됨");
  await p.goto("/me/bookings");
  const byHost = p.getByTestId("booking-card").filter({ hasText: "호스트 취소" });
  await expect(byHost.first()).toContainText("15,000원 환불 완료");
  await p.goto("/me/notifications");
  await expect(p.getByTestId("notification").filter({ hasText: "호스트가 일정을 취소" }).first()).toContainText("호스트 개인 사정");
  } finally {
    // 테스트용 관리자 권한은 남기지 않음
    await revokeRoleDirect(adminUser.id, "admin");
  }
});

test("샘플 프로그램과 내 프로그램은 신청할 수 없다", async ({ browser }) => {
  test.skip(isStaging && process.env.TEST_EXPECT_SAMPLES !== "yes", "샘플 데이터 없음");
  const u = await createMember("flows");
  const page = await loginPage(browser, u.email);
  await page.goto("/meetups?category=music");
  await page.getByTestId("meetup-card").filter({ visible: true }).first().click();
  await expect(page.getByRole("button", { name: "샘플 프로그램은 신청할 수 없어요" })).toBeDisabled();
});
