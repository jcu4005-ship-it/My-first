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

async function paidProgram(hostId: string, title: string, price: number) {
  const { data: m, error } = await adminApi()
    .from("meetups")
    .insert({ host_id: hostId, category_slug: "writing", title, summary: "정산 시험용 프로그램 요약입니다",
      description: "정산 시험용 프로그램의 상세 설명입니다. 충분히 길게 적습니다.", price, max_quantity_per_booking: 1,
      status: "published", published_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !m) throw new Error(`프로그램 준비 실패: ${error?.message}`);
  const start = new Date(Date.now() + 3 * 86400000);
  const { data: s, error: sErr } = await adminApi().from("meetup_sessions").insert({ meetup_id: m.id, starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 2 * 3600000).toISOString(), area: "용산", venue_name: "정산 시험 장소", address_detail: "시험 주소", capacity: 6 })
    .select("id").single();
  if (sErr || !s) throw new Error(`일정 준비 실패: ${sErr?.message}`);
  return { meetupId: m.id as string, sessionId: s.id as string };
}

test("정산: 결제는 플랫폼에서만 → 0% 기간이 지난 호스트는 수수료 20% 빼고 정산 → 관리자 확정·지급 기록(감사) → 호스트 알림", async ({ browser, page }) => {
  const h = await createMember("e2esth");
  await makeApprovedHost(h.id, `정산호스트${Date.now() % 10000}`);
  // 승인한 지 7개월 지난 호스트 (0% 기간 6개월이 끝남)
  await adminApi().from("host_profiles").update({ reviewed_at: new Date(Date.now() - 210 * 86400000).toISOString() }).eq("user_id", h.id);
  const title = `정산 시험 프로그램 ${Date.now() % 100000}`;
  const { meetupId, sessionId } = await paidProgram(h.id, title, 30000);

  // 참가자 화면: 플랫폼 결제 안내
  await page.goto(`/meetups/${meetupId}`);
  await expect(page.getByTestId("payment-safety")).toContainText("에서만 결제해요");

  // 결제(테스트) → 서버가 확정
  const p = await createMember("e2estp");
  const { data: bookingId, error } = await p.client.rpc("book_session", { p_session_id: sessionId, p_quantity: 1 });
  expect(error).toBeNull();
  const { error: payErr } = await adminApi().rpc("confirm_payment", { p_booking_id: bookingId, p_provider: "mock", p_payment_key: `e2e_${bookingId}`, p_amount: 30000 });
  expect(payErr).toBeNull();

  // 호스트: 수수료 20% 제외 금액
  const host = await loginPage(browser, h.email);
  await host.goto("/host/settlements");
  await expect(host.getByTestId("my-rate")).toHaveText("20%");
  const row = host.getByTestId("settlement-row").filter({ hasText: title });
  await expect(row).toContainText("30,000원");
  await expect(row).toContainText("6,000원");
  await expect(row).toContainText("24,000원");
  await expect(row).toContainText("정산 대기");

  // 프로그램이 끝나고 7일이 지난 것으로
  const past = new Date(Date.now() - 10 * 86400000);
  await adminApi().from("meetup_sessions").update({ starts_at: past.toISOString(), ends_at: new Date(past.getTime() + 7200000).toISOString() }).eq("id", sessionId);

  // 관리자: 확정 → 지급 완료 기록
  const a = await createMember("e2esta");
  await grantRoleDirect(a.id, "admin");
  const admin = await loginPage(browser, a.email);
  await admin.goto("/admin/settlements");
  await expect(admin).toHaveURL(/\/admin\/mfa/);
  await admin.waitForLoadState("networkidle"); // 화면 준비 후 입력 (느린 배포 서버)
  const secret = (await admin.getByTestId("mfa-secret").textContent())!.trim();
  await admin.getByLabel(/6자리 코드/).fill(totp(secret));
  await admin.getByRole("button", { name: "확인" }).click();
  await expect(admin).toHaveURL(/\/admin\/settlements$/, { timeout: 15_000 });
  await admin.waitForLoadState("networkidle");
  await expect(admin.getByTestId("current-rate")).toHaveText("20%");
  const ar = admin.getByTestId("admin-settlement-row").filter({ hasText: title });
  await ar.getByTestId("settlement-confirm").getByRole("textbox").fill("11월 정산 확정");
  await ar.getByTestId("settlement-confirm").getByRole("button").click();
  // 확정되면 그 자리가 "지급 완료 기록" 단계로 바뀜
  const ar2 = admin.getByTestId("admin-settlement-row").filter({ hasText: title });
  await expect(ar2.getByTestId("settlement-paid")).toBeVisible();
  await expect(ar2).toContainText("정산 확정");
  admin.once("dialog", (d) => d.accept());
  await ar2.getByTestId("settlement-paid").getByRole("textbox").fill("11/30 이체 완료(테스트)");
  await ar2.getByTestId("settlement-paid").getByRole("button").click();
  await expect(ar2).toContainText("지급 완료");
  await admin.goto("/admin/audit");
  await expect(admin.locator(`[data-testid="audit-row"][data-action="settlement.paid"]`).first()).toBeVisible();

  // 호스트: 지급 완료 + 알림
  await host.goto("/host/settlements");
  await expect(host.getByTestId("settlement-row").filter({ hasText: title })).toContainText("지급 완료");
  await host.goto("/me/notifications");
  await expect(host.getByText("정산금이 지급되었어요").first()).toBeVisible();
});

test("환불 기준: 프로그램 2일 전 참가자 취소 → 미리 보기 50% → 취소하면 절반 환불, 남은 금액은 호스트 정산", async ({ browser }) => {
  const h = await createMember("e2erfh");
  await makeApprovedHost(h.id, `환불호스트${Date.now() % 10000}`);
  await adminApi().from("host_profiles").update({ reviewed_at: new Date(Date.now() - 210 * 86400000).toISOString() }).eq("user_id", h.id);
  const title = `환불 기준 시험 ${Date.now() % 100000}`;
  const { sessionId } = await paidProgram(h.id, title, 30000);
  // 한국 날짜로 2일 뒤 저녁 7시
  const k = new Date(Date.now() + 9 * 3600000);
  const start = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + 2, 19 - 9, 0));
  await adminApi().from("meetup_sessions").update({ starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 7200000).toISOString() }).eq("id", sessionId);
  const p = await createMember("e2erfp");
  const { data: bookingId, error } = await p.client.rpc("book_session", { p_session_id: sessionId, p_quantity: 1 });
  expect(error).toBeNull();
  expect((await adminApi().rpc("confirm_payment", { p_booking_id: bookingId, p_provider: "mock", p_payment_key: `mock_rf_${bookingId}`, p_amount: 30000 })).error).toBeNull();

  const page = await loginPage(browser, p.email);
  await page.goto("/me/bookings");
  await page.waitForLoadState("networkidle");
  const card = page.getByTestId("booking-card").filter({ hasText: title });
  await expect(card.getByTestId("refund-quote")).toContainText("50% 환불 (15,000원)");
  page.once("dialog", (d) => { expect(d.message()).toContain("50% 환불(15,000원)"); void d.accept(); });
  await card.getByTestId("cancel-booking").getByRole("button").click();
  await expect(card).toContainText("15,000원 환불 완료");

  const host = await loginPage(browser, h.email);
  await host.goto("/host/settlements");
  const row = host.getByTestId("settlement-row").filter({ hasText: title });
  await expect(row).toContainText("15,000원"); // 남은 참가비
  await expect(row).toContainText("12,000원"); // 수수료 20% 뺀 정산액
});
