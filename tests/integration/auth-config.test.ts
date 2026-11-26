import { beforeAll, describe, expect, it } from "vitest";

import { requireTestEnv } from "../support/env";
import { publicClient, uniqueEmail, uniqueNickname } from "../support/fixtures";

/**
 * 실제 Supabase Auth 설정이 비밀번호 규칙(10자 이상, 영문+숫자)과 이메일 인증 필수를 강제하는지 확인.
 * 화면 검증과 별개로, Auth 서버 자체가 거부해야 합니다.
 */
const meta = (nickname: string) => ({
  nickname,
  consents: { terms_version: "test", privacy_version: "test", age_14_plus: true },
});

describe("Auth 서버 설정", () => {
  beforeAll(requireTestEnv);

  it.each([
    ["9자 (영문+숫자)", "abcdefg12"],
    ["숫자 없음", "abcdefghijkl"],
    ["영문 없음", "123456789012"],
  ])("약한 비밀번호 거부: %s", async (_label, password) => {
    const { error } = await publicClient().auth.signUp({
      email: uniqueEmail("weak"),
      password,
      options: { data: meta(uniqueNickname("weak")) },
    });
    expect(error?.code).toBe("weak_password");
  });

  it("규칙을 만족하는 비밀번호는 허용되고, 이메일 인증 전에는 로그인할 수 없다", async () => {
    const email = uniqueEmail("ok");
    const client = publicClient();
    const { error } = await client.auth.signUp({
      email,
      password: "abcdefgh12",
      options: { data: meta(uniqueNickname("ok")) },
    });
    expect(error).toBeNull();
    const { error: loginError } = await client.auth.signInWithPassword({ email, password: "abcdefgh12" });
    expect(loginError?.code).toBe("email_not_confirmed");
  });

  it("필수 동의(만 14세)가 없으면 가입이 거부된다", async () => {
    const { error } = await publicClient().auth.signUp({
      email: uniqueEmail("noage"),
      password: "abcdefgh12",
      options: {
        data: { nickname: uniqueNickname("noage"), consents: { terms_version: "t", privacy_version: "t", age_14_plus: false } },
      },
    });
    expect(error).not.toBeNull();
  });
});
