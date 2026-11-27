import type { Browser, Page } from "@playwright/test";

import { expect, newContext, test } from "./fixtures";

import { requireTestEnv } from "../support/env";
import { PASSWORD, adminApi, createMember, grantRoleDirect, makeApprovedHost } from "../support/fixtures";
import { totp } from "../support/totp";

/*
 * 쿠폰 기능은 2026-11-27 대표 결정으로 "일단 끔" (src/config/platform-policy.ts 의 COUPONS_ENABLED=false).
 * DB 표·함수는 그대로 두고 화면·서버 동작만 막았으므로, 여기서는 "어디에도 쿠폰이 보이지 않는다"를 확인합니다.
 * 다시 켜면(COUPONS_ENABLED=true) 이 시험은 예전 흐름(발급 → 호스트 동의 → 적용)으로 되돌려 써야 합니다.
 */
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

test("쿠폰 끔: 호스트가 동의했던 프로그램이어도 신청 화면·호스트 화면·관리자 메뉴 어디에도 쿠폰이 없다", async ({ browser }) => {
  const h = await createMember("e2ecph");
  await makeApprovedHost(h.id, `쿠폰끔호스트${Date.now() % 10000}`);
  const title = `쿠폰 끔 프로그램 ${Date.now() % 100000}`;
  const { data: m, error } = await adminApi()
    .from("meetups")
    .insert({ host_id: h.id, category_slug: "writing", title, summary: "쿠폰이 꺼져 있는지 확인하는 프로그램 요약입니다",
      description: "쿠폰이 꺼져 있는지 확인하는 프로그램의 상세 설명입니다. 충분히 길게 적습니다.", price: 40000, max_quantity_per_booking: 2,
      status: "published", published_at: new Date().toISOString(), accept_coupons: true, coupons_consented_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !m) throw new Error(`프로그램 준비 실패: ${error?.message}`);
  const start = new Date(Date.now() + 6 * 86400000);
  const { error: sErr } = await adminApi().from("meetup_sessions").insert({ meetup_id: m.id, starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 2 * 3600000).toISOString(), area: "연남동", venue_name: "테스트 장소", address_detail: "테스트 주소", capacity: 8 });
  if (sErr) throw new Error(`일정 준비 실패: ${sErr.message}`);

  // 참가자: DB에는 쿠폰 허용으로 남아 있어도 신청 화면에 쿠폰 입력칸이 없다
  const p = await createMember("e2ecpp");
  const part = await loginPage(browser, p.email);
  await part.goto(`/meetups/${m.id}`);
  await expect(part.getByTestId("booking-form")).toBeVisible();
  await expect(part.getByTestId("coupon")).toHaveCount(0);

  // 호스트: 프로그램 관리 화면에 쿠폰 동의 칸이 없다
  const host = await loginPage(browser, h.email);
  await host.goto(`/host/meetups/${m.id}`);
  await expect(host.getByTestId("coupon-consent")).toHaveCount(0);

  // 관리자: 쿠폰 메뉴가 없고 쿠폰 화면은 열리지 않는다 (2단계 인증을 마친 뒤에도)
  const a = await createMember("e2ecpa");
  await grantRoleDirect(a.id, "admin");
  const admin = await loginPage(browser, a.email);
  await admin.goto("/admin/mfa");
  await admin.waitForLoadState("networkidle");
  const secret = (await admin.getByTestId("mfa-secret").textContent())!.trim();
  await admin.getByLabel(/6자리 코드/).fill(totp(secret));
  await admin.getByRole("button", { name: "확인" }).click();
  await admin.waitForURL(/\/admin(?!\/mfa)/, { timeout: 15_000 });
  await expect(admin.getByRole("link", { name: "쿠폰", exact: true })).toHaveCount(0);
  await admin.goto("/admin/coupons");
  await expect(admin.getByText("페이지를 찾을 수 없어요")).toBeVisible(); // 쿠폰 화면은 열리지 않음
  await expect(admin.getByTestId("coupon-form")).toHaveCount(0);
});
