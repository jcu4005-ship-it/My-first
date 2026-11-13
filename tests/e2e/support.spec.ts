import type { Browser, Page } from "@playwright/test";

import { expect, newContext, test } from "./fixtures";

import { requireTestEnv } from "../support/env";
import { PASSWORD, createMember, grantRoleDirect } from "../support/fixtures";
import { totp } from "../support/totp";

test.beforeAll(requireTestEnv);
test.setTimeout(120_000);

async function loginPage(browser: Browser, email: string, next = ""): Promise<Page> {
  const page = await (await newContext(browser)).newPage();
  await page.goto(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

test("고객센터: FAQ → 1:1 문의(검사) → 다른 회원은 볼 수 없음 → 관리자 답변·해결 → 회원 알림 → 이어서 적으면 다시 대기", async ({ browser }) => {
  const subject = `환불 문의 ${Date.now() % 100000}`;

  // 비로그인: FAQ는 보이고, 문의하기는 로그인으로
  const guest = await (await newContext(browser)).newPage();
  await guest.goto("/help");
  await expect(guest.getByTestId("faq-item").first()).toBeVisible();
  await guest.getByTestId("help-contact").click();
  await expect(guest).toHaveURL(/\/login\?next=%2Fhelp%2Fcontact/);
  await guest.context().close();

  // 회원: 문의 남기기 (짧은 내용은 거부)
  const m = await createMember("e2esup");
  const member = await loginPage(browser, m.email, "/help/contact");
  await expect(member).toHaveURL(/\/help\/contact$/);
  const form = member.getByTestId("contact-form");
  await form.getByLabel("문의 분야").selectOption("refund");
  await form.getByLabel("제목").fill(subject);
  await form.getByLabel("내용").fill("짧음");
  await form.getByRole("button", { name: "문의 보내기" }).click();
  await expect(form.getByText("내용을 5자 이상 적어 주세요.")).toBeVisible();
  await form.getByLabel("문의 분야").selectOption("refund");
  await form.getByLabel("제목").fill(subject);
  await form.getByLabel("내용").fill("신청을 취소하면 환불은 언제 되나요?");
  await form.getByRole("button", { name: "문의 보내기" }).click();
  await expect(member).toHaveURL(/\/me\/support\/[0-9a-f-]{36}\?sent=1$/);
  await expect(member.getByTestId("ticket-sent")).toBeVisible();
  await expect(member.getByTestId("ticket-subject")).toHaveText(subject);
  const ticketPath = new URL(member.url()).pathname;

  // 다른 회원은 볼 수 없음 (404)
  const other = await createMember("e2esuo");
  const otherPage = await loginPage(browser, other.email);
  const res = await otherPage.goto(ticketPath);
  expect(res?.status()).toBe(404);
  await otherPage.context().close();

  // 관리자: 2단계 인증 → 문의함 → 답변 + 해결
  const a = await createMember("e2esua");
  await grantRoleDirect(a.id, "admin");
  const admin = await loginPage(browser, a.email);
  await admin.goto("/admin/support");
  await expect(admin).toHaveURL(/\/admin\/mfa/);
  const secret = (await admin.getByTestId("mfa-secret").textContent())!.trim();
  await admin.getByLabel(/6자리 코드/).fill(totp(secret));
  await admin.getByRole("button", { name: "확인" }).click();
  await expect(admin).toHaveURL(/\/admin\/support$/);
  await admin.locator(`[data-testid=admin-ticket-row][data-subject="${subject}"]`).click();
  const reply = admin.getByTestId("admin-reply-form");
  await reply.getByLabel("답변", { exact: true }).fill("취소하시면 결제 금액은 바로 환불 처리돼요. (테스트 결제)");
  await reply.getByLabel("답변하면서 해결됨으로 처리").check();
  await reply.getByRole("button", { name: "답변 보내기" }).click();
  await expect(reply.getByTestId("form-success")).toContainText("답변을 보냈어요");
  await expect(admin.getByTestId("admin-ticket")).toContainText("해결됨");
  await admin.context().close();

  // 회원: 알림 → 답변 확인 → 이어서 적기 → 다시 답변 대기
  await member.goto("/me/notifications");
  await member.getByTestId("notification").filter({ hasText: "문의에 답변이 도착했어요" }).first().click();
  await expect(member).toHaveURL(new RegExp(`${ticketPath}$`));
  await expect(member.locator("[data-testid=support-message][data-from=staff]")).toContainText("바로 환불 처리돼요");
  const more = member.getByTestId("support-reply-form");
  await more.getByLabel("이어서 적기").fill("감사합니다. 하나만 더 여쭤볼게요.");
  await more.getByRole("button", { name: "보내기" }).click();
  await expect(more.getByTestId("form-success")).toBeVisible();
  await member.goto("/me/support");
  await expect(member.getByTestId("ticket-row").filter({ hasText: subject })).toHaveAttribute("data-status", "open");
  await member.context().close();
});
