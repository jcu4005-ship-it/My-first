import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

import { requireTestEnv } from "../support/env";
import { PASSWORD, createMember, grantRoleDirect, makeApprovedHost, revokeRoleDirect } from "../support/fixtures";
import { totp } from "../support/totp";

test.beforeAll(requireTestEnv);

async function login(page: Page, email: string, next = "") {
  await page.goto(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("비로그인: 보호 화면은 로그인으로 이동", async ({ page }) => {
  for (const path of ["/me", "/host", "/admin", "/admin/members", "/admin/mfa"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/%/g, "%")}`));
  }
});

test("참가자: 관리자 화면 403, 호스트 화면은 호스트 신청으로 안내", async ({ page }) => {
  const p = await createMember("e2ep");
  await login(page, p.email);
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole("link", { name: "관리자" })).toHaveCount(0);
  await page.goto("/host");
  await expect(page).toHaveURL(/\/host\/apply$/);
  for (const path of ["/host/meetups/new", "/admin", "/admin/members", "/admin/audit", "/admin/mfa", "/admin/meetups", "/admin/hosts"]) {
    const res = await page.goto(path);
    expect(res?.status(), `${path} HTTP 상태`).toBe(403);
    await expect(page.getByTestId("forbidden").filter({ visible: true }), path).toBeVisible();
    await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute("content", /noindex/);
    await expect(page.getByTestId("admin-dashboard")).toHaveCount(0);
    await expect(page.getByTestId("member-list")).toHaveCount(0);
  }
});

test("열린 리디렉트 차단: 외부 주소 next는 /me로 대체", async ({ page }) => {
  const p = await createMember("e2eredir");
  await login(page, p.email, "//evil.example.com/steal");
  await expect(page).toHaveURL(/localhost:3000\/me$/);
});

test("호스트: 호스트 화면 가능, 관리자 화면 403", async ({ page }) => {
  const h = await createMember("e2eh");
  await makeApprovedHost(h.id);
  await login(page, h.email);
  await page.goto("/host");
  await expect(page.getByTestId("host-home")).toBeVisible();
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(403);
  await expect(page.getByTestId("forbidden").filter({ visible: true })).toBeVisible();
});

test("관리자: 2단계 인증 전에는 관리자 화면 불가 → OTP 등록 → 역할 부여 → 감사 기록 확인", async ({ page }) => {
  const admin = await createMember("e2ea");
  await grantRoleDirect(admin.id, "admin");
  const target = await createMember("e2et");
  try {

  await login(page, admin.email);
  await page.goto("/admin/members");
  await expect(page).toHaveURL(/\/admin\/mfa\?next=%2Fadmin%2Fmembers/);

  const secret = (await page.getByTestId("mfa-secret").textContent())!.trim();
  await page.getByLabel(/6자리 코드/).fill(totp(secret));
  await page.getByRole("button", { name: "확인" }).click();
  await expect(page).toHaveURL(/\/admin\/members$/);

  await page.getByRole("searchbox", { name: "회원 검색" }).or(page.getByLabel("회원 검색")).fill(target.email);
  await page.getByRole("button", { name: "검색" }).click();
  const row = page.locator(`[data-testid=member-row][data-email="${target.email}"]`);
  await expect(row).toBeVisible();
  await row.locator("summary").click();
  const roleForm = row.getByTestId("role-form");
  await roleForm.getByLabel("역할 변경", { exact: true }).selectOption("host:grant");
  await roleForm.getByLabel("역할 변경 사유").fill("E2E 호스트 승인 테스트");
  await roleForm.getByRole("button", { name: "역할 변경" }).click();
  await expect(roleForm.getByTestId("form-success")).toBeVisible();
  await expect(row.getByTestId("member-roles")).toContainText("host");

  await page.goto("/admin/audit");
  await expect(page.locator("[data-testid=audit-row][data-action='role.grant']").first()).toContainText("E2E 호스트 승인 테스트");
  } finally {
    await revokeRoleDirect(admin.id, "admin");
  }
});
