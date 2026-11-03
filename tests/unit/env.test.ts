import { describe, expect, it } from "vitest";

import { assertValidEnv, integrationStatus, parseEnv } from "@/config/env";

const errorsOf = (src: Record<string, string | undefined>) => {
  const r = parseEnv(src);
  return r.ok ? [] : r.errors;
};

/** 테스트용 가짜 JWT (서명 검증 없이 payload만 의미 있음) */
const fakeJwt = (payload: object) =>
  ["e30", Buffer.from(JSON.stringify(payload)).toString("base64url"), "sig"].join(".");

describe("환경변수 검증", () => {
  it("아무 값이 없으면 로컬·테스트 결제 모드 기본값으로 통과한다", () => {
    const r = parseEnv({});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.env.NEXT_PUBLIC_APP_ENV).toBe("local");
      expect(r.env.NEXT_PUBLIC_PAYMENT_MODE).toBe("test");
    }
  });

  it("실결제(live) 모드는 거부한다", () => {
    const errors = errorsOf({ NEXT_PUBLIC_PAYMENT_MODE: "live" });
    expect(errors.join()).toContain("실결제(live) 모드는 아직 허용되지 않습니다");
  });

  it("테스트 모드에서 토스 운영 키(live_)를 거부한다", () => {
    const errors = errorsOf({
      NEXT_PUBLIC_TOSS_CLIENT_KEY: "live_ck_abc",
      TOSS_SECRET_KEY: "live_sk_abc",
    });
    expect(errors).toHaveLength(2);
  });

  it("토스 테스트 키(test_)는 허용한다", () => {
    expect(
      parseEnv({ NEXT_PUBLIC_TOSS_CLIENT_KEY: "test_ck_abc", TOSS_SECRET_KEY: "test_sk_abc" }).ok,
    ).toBe(true);
  });

  it("비밀값 이름에 NEXT_PUBLIC_ 접두사가 붙으면 거부한다", () => {
    expect(errorsOf({ NEXT_PUBLIC_SUPABASE_SECRET_KEY: "x" }).join()).toContain("브라우저에 노출");
    expect(errorsOf({ NEXT_PUBLIC_TOSS_SECRET_KEY: "x" })).not.toHaveLength(0);
    expect(errorsOf({ NEXT_PUBLIC_SERVICE_ROLE: "x" })).not.toHaveLength(0);
  });

  it("공개 키 자리에 Supabase 비밀키가 들어가면 거부한다", () => {
    expect(
      errorsOf({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_abc" }),
    ).not.toHaveLength(0);
    expect(
      errorsOf({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fakeJwt({ role: "service_role" }) }),
    ).not.toHaveLength(0);
  });

  it("공개 키(publishable/anon)는 허용한다", () => {
    expect(parseEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc" }).ok).toBe(true);
    expect(parseEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fakeJwt({ role: "anon" }) }).ok).toBe(
      true,
    );
  });

  it("Vercel 운영(Production) 배포는 승인 전까지 거부, Preview는 허용", () => {
    expect(errorsOf({ VERCEL_ENV: "production" }).join()).toContain("운영(Production) 배포");
    expect(parseEnv({ VERCEL_ENV: "preview" }).ok).toBe(true);
  });

  it("스테이징·운영 환경은 사이트 주소, Supabase 연결, 서버 비밀키가 필수다", () => {
    expect(errorsOf({ NEXT_PUBLIC_APP_ENV: "production" })).toHaveLength(4);
    expect(errorsOf({ NEXT_PUBLIC_APP_ENV: "staging" })).toHaveLength(4);
    expect(
      parseEnv({
        NEXT_PUBLIC_APP_ENV: "staging",
        NEXT_PUBLIC_SITE_URL: "https://staging.example.com",
        NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
        SUPABASE_SECRET_KEY: "sb_secret_x",
      }).ok,
    ).toBe(true);
  });

  it("서버 비밀키 자리에 공개 키를 넣으면 거부한다", () => {
    expect(errorsOf({ SUPABASE_SECRET_KEY: "sb_publishable_abc" }).join()).toContain("SUPABASE_SECRET_KEY");
  });

  it("알 수 없는 환경 이름과 잘못된 URL을 거부한다", () => {
    expect(errorsOf({ NEXT_PUBLIC_APP_ENV: "prod" })).not.toHaveLength(0);
    expect(errorsOf({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url" })).not.toHaveLength(0);
  });

  it("빈 문자열은 설정되지 않은 것으로 본다", () => {
    expect(parseEnv({ NEXT_PUBLIC_SUPABASE_URL: "", TOSS_SECRET_KEY: "" }).ok).toBe(true);
  });

  it("assertValidEnv는 모든 오류를 모아 예외를 던진다", () => {
    expect(() =>
      assertValidEnv({ NEXT_PUBLIC_PAYMENT_MODE: "live", NEXT_PUBLIC_TOSS_SECRET: "x" }),
    ).toThrow(/환경변수 설정에 문제가 있습니다/);
  });

  it("V3: 오류 메시지에는 변수 이름만 있고 값은 들어가지 않는다", () => {
    const secretish = "sb_secret_SHOULD_NOT_APPEAR_1234";
    const r = parseEnv({
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secretish,
      NEXT_PUBLIC_SUPABASE_SECRET_KEY: secretish,
      TOSS_SECRET_KEY: "live_sk_SHOULD_NOT_APPEAR",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const text = r.errors.join("\n");
      expect(text).not.toContain(secretish);
      expect(text).not.toContain("live_sk_SHOULD_NOT_APPEAR");
    }
  });

  it("연결 상태 요약에는 설정 여부만 있고 값은 없다", () => {
    const r = parseEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const status = integrationStatus(r.env);
      expect(status).toEqual({ supabase: true, supabaseServer: false, tossPayments: false });
      expect(JSON.stringify(status)).not.toContain("sb_publishable_abc");
    }
  });
});
