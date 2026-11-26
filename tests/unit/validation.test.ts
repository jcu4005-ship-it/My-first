import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/safe-redirect";
import { passwordSchema, privateUpdateSchema, signUpSchema } from "@/lib/validation/auth";
import { cleanNickname, nicknameKey, nicknameProblem } from "@/lib/validation/nickname";

describe("닉네임 정규화 (DB 규칙과 동일)", () => {
  it("앞뒤 공백 제거, 연속 공백 1칸", () => {
    expect(cleanNickname("   민지   kim  ")).toBe("민지 kim");
  });
  it("대소문자·공백·전각 문자 차이는 같은 키", () => {
    expect(nicknameKey("Hong Gil")).toBe("honggil");
    expect(nicknameKey("HONG  GIL")).toBe("honggil");
    expect(nicknameKey("ＨＯＮＧ ＧＩＬ")).toBe("honggil");
  });
  it("길이·문자·예약어 검사", () => {
    expect(nicknameProblem("a")).toBe("length");
    expect(nicknameProblem("가".repeat(21))).toBe("length");
    expect(nicknameProblem("bad<script>")).toBe("charset");
    expect(nicknameProblem("관리자")).toBe("reserved");
    expect(nicknameProblem("Ad Min")).toBe("reserved");
    expect(nicknameProblem("좋은 닉네임_1")).toBeNull();
  });
});

describe("비밀번호 규칙 (10자 이상, 영문+숫자)", () => {
  it.each([["abcdefg12"], ["abcdefghijkl"], ["123456789012"]])("거부: %s", (pw) => {
    expect(passwordSchema.safeParse(pw).success).toBe(false);
  });
  it("허용: abcdefgh12", () => {
    expect(passwordSchema.safeParse("abcdefgh12").success).toBe(true);
  });
});

describe("가입 입력 검증", () => {
  const base = {
    email: "User@Example.com ",
    password: "Goodpass123",
    passwordConfirm: "Goodpass123",
    nickname: " 새 회원 ",
    agreeTerms: "on",
    agreePrivacy: "on",
    confirmAge14: "on",
    agreeMarketing: "",
  };
  it("정상 입력은 정규화되어 통과", () => {
    const r = signUpSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("user@example.com");
      expect(r.data.nickname).toBe("새 회원");
      expect(r.data.agreeMarketing).toBe(false);
    }
  });
  it("만 14세 확인·필수 동의·비밀번호 확인 누락 시 거부", () => {
    for (const patch of [{ confirmAge14: "" }, { agreeTerms: "" }, { agreePrivacy: "" }, { passwordConfirm: "Other12345" }]) {
      expect(signUpSchema.safeParse({ ...base, ...patch }).success).toBe(false);
    }
  });
});

describe("비공개 정보 입력", () => {
  it("휴대폰 번호의 하이픈·공백 제거", () => {
    const r = privateUpdateSchema.safeParse({ phone: "010-1234 5678", birthYear: "1995" });
    expect(r.success && r.data).toEqual({ phone: "01012345678", birthYear: 1995 });
  });
  it("잘못된 번호·연도 거부", () => {
    expect(privateUpdateSchema.safeParse({ phone: "02-123-4567", birthYear: "" }).success).toBe(false);
    expect(privateUpdateSchema.safeParse({ phone: "", birthYear: "1850" }).success).toBe(false);
  });
});

describe("로그인 후 이동 주소 검증 (열린 리디렉트 방지)", () => {
  it.each([
    ["//evil.com", "/me"],
    ["https://evil.com", "/me"],
    ["/\\evil.com", "/me"],
    ["javascript:alert(1)", "/me"],
    ["", "/me"],
    ["/admin/members?q=a", "/admin/members?q=a"],
    ["/me", "/me"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
