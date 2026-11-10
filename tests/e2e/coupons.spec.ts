import type { Browser, Page } from "@playwright/test";

import { expect, newContext, test } from "./fixtures";

import { requireTestEnv } from "../support/env";
import { PASSWORD, adminApi, createMember, grantRoleDirect, makeApprovedHost } from "../support/fixtures";
import { totp } from "../support/totp";

test.beforeAll(requireTestEnv);
test.setTimeout(120_000);

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

test("쿠폰: 관리자 발급(10% 한도) → 호스트 동의 → 참가자 적용 → 결제 금액에 할인 반영", async ({ browser }) => {
  const h = await createMember("e2ecph");
  await makeApprovedHost(h.id, `쿠폰호스트${Date.now() % 10000}`);
  const title = `쿠폰 테스트 프로그램 ${Date.now() % 100000}`;
  const { data: m, error } = await adminApi()
    .from("meetups")
    .insert({ host_id: h.id, category_slug: "writing", title, summary: "쿠폰 테스트용 프로그램 요약입니다",
      description: "쿠폰 테스트용 프로그램의 상세 설명입니다. 충분히 길게 적습니다.", price: 40000, max_quantity_per_booking: 2,
      status: "published", published_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !m) throw new Error(`프로그램 준비 실패: ${error?.message}`);
  const start = new Date(Date.now() + 6 * 86400000);
  const { error: sErr } = await adminApi().from("meetup_sessions").insert({ meetup_id: m.id, starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 2 * 3600000).toISOString(), area: "연남동", venue_name: "테스트 장소", address_detail: "테스트 주소", capacity: 8 });
  if (sErr) throw new Error(`일정 준비 실패: ${sErr.message}`);
  const code = `E2E${Date.now() % 1000000}`;

  // 1. 관리자: 쿠폰 발급
  const a = await createMember("e2ecpa");
  await grantRoleDirect(a.id, "admin");
  const admin = await loginPage(browser, a.email);
  await admin.goto("/admin/coupons");
  await expect(admin).toHaveURL(/\/admin\/mfa/);
  const secret = (await admin.getByTestId("mfa-secret").textContent())!.trim();
  await admin.getByLabel(/6자리 코드/).fill(totp(secret));
  await admin.getByRole("button", { name: "확인" }).click();
  await expect(admin).toHaveURL(/\/admin\/coupons$/);
  const form = admin.getByTestId("coupon-form");
  await form.getByLabel("쿠폰 코드").fill(code.toLowerCase());
  await form.getByLabel("쿠폰 이름").fill("E2E 환영 쿠폰");
  await form.getByLabel("할인율").selectOption("10");
  await form.getByRole("button", { name: "쿠폰 만들기" }).click();
  await expect(form.getByTestId("form-success")).toContainText(code);
  await expect(admin.locator(`[data-testid=coupon-row][data-code="${code}"]`)).toContainText("10% 할인");

  // 2. 참가자: 동의 전에는 쿠폰 입력칸이 없음
  const p = await createMember("e2ecpp");
  const part = await loginPage(browser, p.email);
  await part.goto(`/meetups/${m.id}`);
  await expect(part.getByTestId("booking-form")).toBeVisible();
  await expect(part.getByTestId("coupon")).toHaveCount(0);

  // 3. 호스트: 동의
  const host = await loginPage(browser, h.email);
  await host.goto(`/host/meetups/${m.id}`);
  await expect(host.getByTestId("coupon-consent")).toHaveAttribute("data-accept", "false");
  await host.getByTestId("coupon-accept").getByRole("button").click();
  await expect(host.getByTestId("coupon-consent")).toHaveAttribute("data-accept", "true");

  // 4. 참가자: 잘못된 코드 → 올바른 코드 → 할인된 금액으로 결제 화면
  await part.reload();
  const coupon = part.getByTestId("coupon");
  await coupon.getByLabel("할인 쿠폰 (선택)").fill("NOPE1234");
  await coupon.getByRole("button", { name: "적용" }).click();
  await expect(coupon.getByTestId("coupon-result")).toContainText("사용할 수 없는 쿠폰");
  await coupon.getByLabel("할인 쿠폰 (선택)").fill(code);
  await coupon.getByRole("button", { name: "적용" }).click();
  await expect(coupon.getByTestId("coupon-result")).toContainText("10% 할인 적용 · −4,000원");
  await expect(part.getByTestId("book-submit")).toContainText("36,000원");
  await part.getByTestId("book-submit").click();
  await expect(part).toHaveURL(/\/checkout\//);
  await expect(part.getByTestId("checkout-discount")).toContainText("−4,000원");
  await expect(part.getByTestId("pay-test")).toContainText("36,000원");
  await part.getByTestId("pay-test").click();
  await expect(part).toHaveURL(/\/me\/bookings/);

  // 5. 관리자: 사용 현황
  await admin.reload();
  await expect(admin.locator(`[data-testid=coupon-row][data-code="${code}"]`).getByTestId("coupon-usage")).toContainText("사용 1회 · 할인 합계 4,000원");
});
