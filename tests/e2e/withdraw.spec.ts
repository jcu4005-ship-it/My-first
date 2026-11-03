import { expect, test } from "@playwright/test";

import { requireTestEnv } from "../support/env";
import { PASSWORD, createMember, dbQuery, publicClient } from "../support/fixtures";

test.beforeAll(requireTestEnv);

test("회원 탈퇴: 비밀번호 재확인 → 개인정보 삭제 → 로그아웃 → 다시 로그인 불가", async ({ page }) => {
  const u = await createMember("wd");
  await dbQuery("update public.profile_private set phone = '01012341234' where user_id = $1", [u.id]);
  await page.goto("/login");
  await page.getByLabel("이메일").fill(u.email);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/me$/);

  await page.getByRole("link", { name: "회원 탈퇴하기" }).click();
  const form = page.getByTestId("withdraw-form");
  await form.getByLabel("비밀번호 확인").fill("Wrongpass999");
  await form.getByLabel(/탈퇴합니다/).fill("탈퇴합니다");
  await form.getByRole("button", { name: "회원 탈퇴" }).click();
  await expect(form.getByText("비밀번호가 올바르지 않습니다")).toBeVisible();

  await form.getByLabel("비밀번호 확인").fill(PASSWORD);
  await form.getByLabel(/탈퇴합니다/).fill("탈퇴합니다");
  await form.getByRole("button", { name: "회원 탈퇴" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  const [row] = await dbQuery<{ status: string; nickname: string; phone: string | null; email: string }>(
    `select p.status, p.nickname, pp.phone, u.email from public.profiles p join public.profile_private pp on pp.user_id = p.id
     join auth.users u on u.id = p.id where p.id = $1`,
    [u.id],
  );
  expect(row.status).toBe("withdrawn");
  expect(row.nickname).toMatch(/^탈퇴회원 /);
  expect(row.phone).toBeNull();
  expect(row.email).not.toBe(u.email);

  const { error } = await publicClient().auth.signInWithPassword({ email: u.email, password: PASSWORD });
  expect(error).not.toBeNull();
  const res = await page.goto("/me");
  expect(page.url()).toContain("/login");
  expect(res?.status()).toBe(200);
});
