import type { Browser, Page } from "@playwright/test";

import { expect, newContext, test } from "./fixtures";

import { requireTestEnv } from "../support/env";
import { PASSWORD, adminApi, createMember, grantRoleDirect, makeApprovedHost } from "../support/fixtures";
import { totp } from "../support/totp";

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

async function publishedProgram(hostId: string, title: string, price: number) {
  const { data: m, error } = await adminApi()
    .from("meetups")
    .insert({ host_id: hostId, category_slug: "writing", title, summary: "베타 테스트용 프로그램 요약입니다",
      description: "베타 테스트용 프로그램의 상세 설명입니다. 충분히 길게 적습니다.", price, max_quantity_per_booking: 1,
      status: "published", published_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !m) throw new Error(`프로그램 준비 실패: ${error?.message}`);
  const start = new Date(Date.now() + 6 * 86400000);
  const { error: sErr } = await adminApi().from("meetup_sessions").insert({ meetup_id: m.id, starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 2 * 3600000).toISOString(), area: "연남동", venue_name: "테스트 장소", address_detail: "테스트 주소", capacity: 8 });
  if (sErr) throw new Error(`일정 준비 실패: ${sErr.message}`);
  return m.id as string;
}

/** 시험용 값으로 되돌림 (초대제 끔·유료 허용) — 실패해도 다른 검사에 영향이 없도록 */
async function restoreTestSettings() {
  await adminApi().from("app_settings").update({ invite_only: false, paid_bookings_enabled: true }).eq("id", true);
}

test("비공개 베타: 관리자 설정(사유·감사 기록) → 초대 코드 발급 → 코드 없이 가입 불가·코드로 가입 → 유료 신청 막힘·무료는 가능", async ({ browser }) => {
  const code = `BETA-${Date.now() % 1000000}`;
  try {
    // 0. 준비: 초대제를 켜기 전에 필요한 계정·프로그램을 만듦 (켠 뒤에는 코드 없이 계정을 만들 수 없음)
    const h = await createMember("e2ebth");
    await makeApprovedHost(h.id, `베타호스트${Date.now() % 10000}`);
    const paidId = await publishedProgram(h.id, `베타 유료 프로그램 ${Date.now() % 100000}`, 30000);
    const freeId = await publishedProgram(h.id, `베타 무료 프로그램 ${Date.now() % 100000}`, 0);
    const p = await createMember("e2ebtp");

    // 1. 관리자: 2단계 인증 → 운영 설정
    const a = await createMember("e2ebta");
    await grantRoleDirect(a.id, "admin");
    const admin = await loginPage(browser, a.email);
    await admin.goto("/admin/launch");
    await expect(admin).toHaveURL(/\/admin\/mfa/);
    const secret = (await admin.getByTestId("mfa-secret").textContent())!.trim();
    await admin.getByLabel(/6자리 코드/).fill(totp(secret));
    await admin.getByRole("button", { name: "확인" }).click();
    await expect(admin).toHaveURL(/\/admin\/launch$/);

    const settings = admin.getByTestId("settings-form");
    await settings.getByLabel("가입 방식").selectOption("true");
    await settings.getByLabel("유료 프로그램 신청").selectOption("false");
    await settings.getByLabel("변경 사유").fill("짧음");
    await settings.getByRole("button", { name: "설정 저장" }).click();
    await expect(settings.getByText("변경 사유를 5자 이상 입력해 주세요.")).toBeVisible();
    await settings.getByLabel("가입 방식").selectOption("true");
    await settings.getByLabel("유료 프로그램 신청").selectOption("false");
    await settings.getByLabel("변경 사유").fill("E2E 비공개 베타 시험");
    await settings.getByRole("button", { name: "설정 저장" }).click();
    await expect(admin.getByTestId("settings-state")).toContainText("비공개 베타");
    await expect(admin.getByTestId("settings-state")).toContainText("무료 프로그램만");
    const { data: logs } = await adminApi().from("audit_logs").select("id").eq("action", "settings.update").eq("reason", "E2E 비공개 베타 시험");
    expect(logs?.length).toBeGreaterThan(0);

    const invite = admin.getByTestId("invite-form");
    await invite.getByLabel("초대 코드").fill(code.toLowerCase());
    await invite.getByLabel("사용 가능 횟수").fill("1");
    await invite.getByRole("button", { name: "초대 코드 만들기" }).click();
    await expect(invite.getByTestId("form-success")).toContainText(code);
    const row = admin.locator(`[data-testid=invite-row][data-code="${code}"]`);
    await expect(row.getByTestId("invite-usage")).toContainText("가입 0 / 1명");

    // 2. 가입 화면: 초대 코드 칸, 틀린 코드는 거부 (메일 발송 전 단계에서 막힘)
    const guest = await (await newContext(browser)).newPage();
    await guest.goto("/signup");
    await expect(guest.getByTestId("beta-badge")).toBeVisible();
    await guest.getByLabel("초대 코드").fill("WRONG-0000");
    await guest.getByLabel("이메일").fill(`beta-wrong-${Date.now()}@test.local`);
    await guest.getByLabel("닉네임").fill(`베타${Date.now() % 100000}`);
    await guest.getByLabel("비밀번호", { exact: true }).fill("Betapass1234");
    await guest.getByLabel("비밀번호 확인").fill("Betapass1234");
    for (const box of await guest.locator('input[type=checkbox][name^="agree"], input[type=checkbox][name="confirmAge14"]').all()) await box.check();
    await guest.getByRole("button", { name: "가입하기" }).click();
    await expect(guest.getByText("사용할 수 없는 초대 코드예요")).toBeVisible();
    await expect(guest).toHaveURL(/\/signup$/);
    await guest.context().close();

    // 3. DB 가입 트리거: 코드 없으면 거부, 코드로 가입하면 사용 횟수 증가 (메일 없이 확인)
    const consents = { terms_version: "e2e", privacy_version: "e2e", age_14_plus: true };
    // 거부되면 라이브러리가 오류를 돌려주거나 던짐 — 둘 다 "가입 실패"
    const noCodeFailed = await adminApi().auth.admin
      .createUser({ email: `beta-nocode-${Date.now()}@test.local`, password: "Betapass1234",
        email_confirm: true, user_metadata: { nickname: `무코드${Date.now() % 100000}`, consents } })
      .then((r) => r.error !== null, () => true);
    expect(noCodeFailed).toBe(true);
    const ok = await adminApi().auth.admin.createUser({ email: `beta-ok-${Date.now()}@test.local`, password: "Betapass1234",
      email_confirm: true, user_metadata: { nickname: `초대${Date.now() % 100000}`, consents, invite_code: code } });
    expect(ok.error).toBeNull();
    await admin.reload();
    await expect(row.getByTestId("invite-usage")).toContainText("가입 1 / 1명");

    // 4. 유료 프로그램은 신청 막힘, 무료는 가능
    const participant = await loginPage(browser, p.email);
    await participant.goto(`/meetups/${paidId}`);
    await expect(participant.getByTestId("beta-paid-notice")).toContainText("무료 프로그램만");
    await expect(participant.getByTestId("book-submit")).toHaveCount(0);
    await participant.goto(`/meetups/${freeId}`);
    await expect(participant.getByTestId("book-submit")).toBeEnabled();
    await participant.context().close();
    await admin.context().close();
  } finally {
    await restoreTestSettings();
  }
});
