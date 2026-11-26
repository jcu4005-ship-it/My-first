import type { Browser, Page } from "@playwright/test";

import { expect, newContext, test } from "./fixtures";

import { localOnly, requireTestEnv } from "../support/env";
import { PASSWORD, adminApi, createMember, dbQuery, grantRoleDirect, revokeRoleDirect } from "../support/fixtures";
import { totp } from "../support/totp";

test.beforeAll(requireTestEnv);
test.setTimeout(180_000);

// 시험으로 접수된 지원은 끝나면 지움 (스테이징에 시험 지원이 쌓이지 않게)
let createdName = "";
test.afterEach(async () => {
  if (createdName) await adminApi().from("creator_applications").delete().like("name", `${createdName}%`);
});

async function loginPage(browser: Browser, email: string): Promise<Page> {
  const page = await (await newContext(browser)).newPage();
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

test("크리에이터 지원: 로그인 없이 1분 지원 → 검증·중복 방지 → 접수 완료, 관리자만 열람·상태 변경·인터뷰 메모, 연락처는 사유를 적어야 보임", async ({ browser }) => {
  const stamp = `${Date.now() % 1000000}`.padStart(6, "0");
  const phone = `010-${stamp.slice(0, 4)}-${stamp.slice(2, 6)}`;
  const name = `지원자${stamp}`;
  createdName = name;

  // 1. 비로그인 방문자가 지원
  const guest = await (await newContext(browser)).newPage();
  await guest.goto("/apply");
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("당신의 가능성을 발견합니다.");
  const form = guest.getByTestId("creator-apply-form");
  await expect(form.getByText("필수 질문 · 5개")).toBeVisible();
  await expect(form.getByText("선택 질문 · 비워 두셔도 돼요")).toBeVisible();

  // 필수 항목 검사: 빈 채로 제출하면 항목마다 안내
  await form.getByRole("button", { name: "지원하기" }).click();
  await expect(form.getByText("이름 또는 활동명을 2자 이상")).toBeVisible();
  await expect(form.getByText("관심 분야를 선택해 주세요.")).toBeVisible();
  await expect(form.getByText("잘하거나 자신 있는 것을 5자 이상")).toBeVisible();
  await expect(form.getByText("동의해 주세요")).toBeVisible();

  await form.getByLabel("1. 이름 또는 활동명").fill(name);
  await form.getByLabel("예술·문화·창작").check();
  await form.getByLabel("3. 본인이 다른 사람보다 잘하거나 자신 있는 것은 무엇인가요?").fill("골목의 오래된 가게를 사진으로 잘 남겨요");
  await form.getByLabel("4. 지금까지 관련해서 해본 활동이나 경험이 있나요?").fill("동네 사진 모임을 2년 동안 운영했어요");
  await form.getByLabel("5. ROUNDI와 함께해 보고 싶은 이유는 무엇인가요?").fill("내 경험을 사람들과 나누고 싶어요");
  await form.getByLabel("연락받을 휴대폰 번호").fill("12345");
  await form.getByLabel("6. 운영 중인 SNS 또는 포트폴리오가 있나요?").fill("http://not-secure.example");
  await form.getByTestId("consent").getByRole("checkbox").check();
  await form.getByRole("button", { name: "지원하기" }).click();
  await expect(form.getByText("휴대폰 번호 형식을 확인")).toBeVisible();
  await expect(form.getByText("https:// 로 시작하는 링크")).toBeVisible();
  // 오류가 나도 쓴 내용은 그대로
  await expect(form.getByLabel("1. 이름 또는 활동명")).toHaveValue(name);
  await expect(form.getByLabel("예술·문화·창작")).toBeChecked();

  await form.getByLabel("연락받을 휴대폰 번호").fill(phone);
  await form.getByLabel("6. 운영 중인 SNS 또는 포트폴리오가 있나요?").fill("https://example.com/portfolio");
  await form.getByRole("button", { name: "지원하기" }).click();
  const done = guest.getByTestId("apply-done");
  await expect(done).toContainText("지원이 접수되었습니다.");
  await expect(done).toContainText("ROUNDI 운영팀이 지원 내용을 확인한 후 연락드리겠습니다.");
  await expect(done).toContainText("짧은 대화를 통해 당신만의 가능성을 함께 발견해 보겠습니다.");

  // 2. 같은 번호로 다시 지원하면 중복 접수 안 됨
  await guest.goto("/apply");
  const again = guest.getByTestId("creator-apply-form");
  await again.getByLabel("1. 이름 또는 활동명").fill(`${name}중복`);
  await again.getByLabel("지식·교육·인문").check();
  await again.getByLabel("3. 본인이 다른 사람보다 잘하거나 자신 있는 것은 무엇인가요?").fill("글을 쓰고 다듬는 일을 잘해요");
  await again.getByLabel("4. 지금까지 관련해서 해본 활동이나 경험이 있나요?").fill("출판사에서 편집을 했어요");
  await again.getByLabel("5. ROUNDI와 함께해 보고 싶은 이유는 무엇인가요?").fill("새로운 활동을 해보고 싶어요");
  await again.getByLabel("연락받을 휴대폰 번호").fill(phone.replace(/-/g, ""));
  await again.getByTestId("consent").getByRole("checkbox").check();
  await again.getByRole("button", { name: "지원하기" }).click();
  await expect(again.getByText("이미 접수된 지원이 있어요")).toBeVisible();
  await expect(guest.getByTestId("apply-done")).toHaveCount(0);

  // 3. 일반 회원은 관리자 화면에 못 들어가고, 지원 정보도 못 본다 (로컬에서는 DB로도 확인)
  const member = await createMember("capm");
  const mp = await loginPage(browser, member.email);
  const res = await mp.goto("/admin/creators");
  expect(res?.status()).toBe(403);
  const { data: leaked } = await member.client.from("creator_applications").select("id");
  expect(leaked ?? []).toHaveLength(0);
  if (localOnly()) {
    const rows = await dbQuery<{ n: string }>("select count(*)::text as n from public.creator_applications where name = $1", [name]);
    expect(rows[0].n).toBe("1"); // 실제로 저장됨, 중복은 저장 안 됨
  }

  // 4. 관리자(2단계 인증): 목록 → 상세 → 연락처(사유 필요) → 상태 변경 → 메모
  const adminUser = await createMember("capa");
  await grantRoleDirect(adminUser.id, "admin");
  try {
    const admin = await loginPage(browser, adminUser.email);
    await admin.goto("/admin/creators");
    await expect(admin).toHaveURL(/\/admin\/mfa/);
    await admin.waitForLoadState("networkidle");
    const secret = (await admin.getByTestId("mfa-secret").textContent())!.trim();
    await admin.getByLabel(/6자리 코드/).fill(totp(secret));
    await admin.getByRole("button", { name: "확인" }).click();
    await expect(admin).toHaveURL(/\/admin\/creators$/, { timeout: 15_000 });
    await admin.waitForLoadState("networkidle");

    const row = admin.locator(`[data-testid=creator-row][data-name="${name}"]`);
    await expect(row).toContainText("신규 지원");
    await row.click();
    const detail = admin.getByTestId("creator-detail");
    await expect(detail).toHaveAttribute("data-status", "new");
    await expect(detail).toContainText("골목의 오래된 가게를 사진으로 잘 남겨요");
    await expect(detail).toContainText("https://example.com/portfolio");
    await expect(detail).toContainText("예술·문화·창작");

    const contact = detail.getByTestId("creator-contact");
    await expect(contact.getByTestId("creator-contact-value")).toContainText("****");
    await contact.getByRole("button", { name: "휴대폰 번호 보기" }).click();
    await expect(contact.getByRole("alert")).toContainText("5자 이상");
    await contact.getByRole("textbox").fill("전화 인터뷰 일정 안내");
    await contact.getByRole("button", { name: "휴대폰 번호 보기" }).click();
    await expect(contact.getByTestId("creator-contact-value")).toHaveText(phone.replace(/-/g, ""));

    await detail.getByTestId("creator-status-form").getByLabel("지원 상태").selectOption("interview_scheduled");
    await detail.getByTestId("creator-status-form").getByRole("button", { name: "상태 저장" }).click();
    await expect(detail.getByTestId("creator-status-form")).toContainText("상태를 바꿨어요");
    await admin.reload();
    await expect(admin.getByTestId("creator-detail")).toHaveAttribute("data-status", "interview_scheduled");

    await admin.getByTestId("creator-note-form").getByLabel("인터뷰 메모 내용").fill("전화 인터뷰: 골목 이야기를 할 때 눈이 반짝였다.");
    await admin.getByTestId("creator-note-form").getByRole("button", { name: "메모 저장" }).click();
    await expect(admin.getByTestId("creator-notes")).toContainText("골목 이야기를 할 때 눈이 반짝였다", { timeout: 10_000 });

    // 목록에서도 새 상태로 보인다
    await admin.goto("/admin/creators?tab=interview_scheduled");
    await expect(admin.locator(`[data-testid=creator-row][data-name="${name}"]`)).toContainText("전화 인터뷰 예정");
  } finally {
    await revokeRoleDirect(adminUser.id, "admin");
  }
});
