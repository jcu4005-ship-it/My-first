import { expect, test } from "./fixtures";

import { isStaging, requireTestEnv } from "../support/env";
import { uniqueEmail, uniqueNickname } from "../support/fixtures";
import { latestAuthLink } from "../support/mailpit";

test.beforeAll(requireTestEnv);
// 로컬 테스트 메일함(Mailpit)이 필요 → 로컬·CI 전용. 스테이징의 실제 메일 인증은 직접 확인 항목
test.skip(isStaging, "실제 메일 수신이 필요해 스테이징 자동 검증에서 제외");

async function fillSignup(page: import("@playwright/test").Page, v: { email: string; nickname: string; password: string }) {
  await page.goto("/signup");
  await page.getByLabel("이메일").fill(v.email);
  await page.getByLabel("닉네임").fill(v.nickname);
  await page.getByLabel("비밀번호", { exact: true }).fill(v.password);
  await page.getByLabel("비밀번호 확인").fill(v.password);
  await page.getByRole("checkbox", { name: /이용약관/ }).check();
  await page.getByRole("checkbox", { name: /개인정보/ }).check();
  await page.getByRole("checkbox", { name: /만 14세/ }).check();
  await page.getByRole("button", { name: "가입하기" }).click();
}

test("이메일 가입 → 인증 → 로그인 → 로그아웃 → 비밀번호 재설정", async ({ page }) => {
  const email = uniqueEmail("e2e");
  const nickname = uniqueNickname("e2e");

  await fillSignup(page, { email, nickname, password: "Firstpass123" });
  await expect(page.getByTestId("check-email")).toBeVisible();

  // 인증 전 로그인 거부
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("Firstpass123");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByTestId("form-error")).toContainText("이메일 인증");

  // 메일 링크로 인증 → 로그인 상태로 마이페이지
  await page.goto(await latestAuthLink(email, "email"));
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByTestId("me-nickname")).toHaveText(nickname);

  // 로그아웃 후 보호 화면 접근 → 로그인 화면으로
  await page.getByRole("button", { name: "로그아웃" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.goto("/me");
  await expect(page).toHaveURL(/\/login\?next=%2Fme/);

  // 재로그인 → next 경로로 이동
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("Firstpass123");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/me$/);
  await page.getByRole("button", { name: "로그아웃" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  // 비밀번호 재설정
  await page.goto("/forgot-password");
  await page.getByLabel("이메일").fill(email);
  await page.getByRole("button", { name: "재설정 링크 받기" }).click();
  await expect(page.getByTestId("check-email")).toBeVisible();
  await page.goto(await latestAuthLink(email, "recovery"));
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel("새 비밀번호", { exact: true }).fill("short1");
  await page.getByLabel("새 비밀번호 확인").fill("short1");
  await page.getByRole("button", { name: "비밀번호 변경" }).click();
  await expect(page.getByText("10자 이상")).toBeVisible();
  await page.getByLabel("새 비밀번호", { exact: true }).fill("Secondpass456");
  await page.getByLabel("새 비밀번호 확인").fill("Secondpass456");
  await page.getByRole("button", { name: "비밀번호 변경" }).click();
  await expect(page).toHaveURL(/\/me\?notice=password-updated/);
  await page.getByRole("button", { name: "로그아웃" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  // 새 비밀번호로 로그인, 이전 비밀번호 거부
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("Firstpass123");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByTestId("form-error")).toContainText("올바르지 않습니다");
  await page.getByLabel("비밀번호").fill("Secondpass456");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/me$/);
});

test("가입 화면 검증: 약한 비밀번호, 대소문자·공백만 다른 닉네임 중복, 필수 동의", async ({ page }) => {
  const nickname = uniqueNickname("dup");
  await fillSignup(page, { email: uniqueEmail("dup1"), nickname, password: "Goodpass123" });
  await expect(page.getByTestId("check-email")).toBeVisible();

  // 같은 닉네임을 대문자 + 공백으로
  const variant = `${nickname.slice(0, 3).toUpperCase()} ${nickname.slice(3)}`;
  await fillSignup(page, { email: uniqueEmail("dup2"), nickname: variant, password: "Goodpass123" });
  await expect(page.getByText("이미 사용 중이거나 사용할 수 없는 닉네임")).toBeVisible();

  await fillSignup(page, { email: uniqueEmail("weak"), nickname: uniqueNickname("weak"), password: "onlyletters" });
  await expect(page.getByText("영문과 숫자를 모두 포함")).toBeVisible();

  await page.goto("/signup");
  await page.getByLabel("이메일").fill(uniqueEmail("noage"));
  await page.getByLabel("닉네임").fill(uniqueNickname("noage"));
  await page.getByLabel("비밀번호", { exact: true }).fill("Goodpass123");
  await page.getByLabel("비밀번호 확인").fill("Goodpass123");
  await page.getByRole("checkbox", { name: /이용약관/ }).check();
  await page.getByRole("checkbox", { name: /개인정보/ }).check();
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page.getByText("만 14세 이상만 가입할 수 있습니다")).toBeVisible();
});

test("외부 주소로의 로그인 후 이동(열린 리디렉트) 차단", async ({ page }) => {
  await page.goto("/login?next=//evil.example.com/steal");
  await expect(page.locator("input[name=next]")).toHaveValue("//evil.example.com/steal");
  // 서버가 safeNextPath로 걸러 /me로 보냄 — 실제 이동은 access.spec의 로그인 흐름에서 확인
});
