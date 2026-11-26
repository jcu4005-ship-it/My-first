import { describe, expect, it } from "vitest";

import { parseEnv } from "@/config/env";
import { comingSoonRoute, isComingSoon } from "@/lib/site-mode";

const noDb = { databaseConfigured: false };
const withDb = { databaseConfigured: true };

describe("임시 공개 모드: 어떤 화면을 열어 두나", () => {
  it("SITE_MODE=coming_soon 일 때만 켜진다", () => {
    expect(isComingSoon({})).toBe(false);
    expect(isComingSoon({ SITE_MODE: "coming_soon" })).toBe(true);
    expect(isComingSoon({ SITE_MODE: "other" })).toBe(false);
  });

  it("메인(/)은 소개 페이지로 연결하고, 약관·방침·환불·상태 확인은 그대로 보여 준다", () => {
    expect(comingSoonRoute("/", noDb)).toEqual({ kind: "rewrite", to: "/coming-soon" });
    for (const p of ["/terms", "/privacy", "/refund", "/coming-soon", "/api/health", "/opengraph-image"]) {
      expect(comingSoonRoute(p, noDb), p).toEqual({ kind: "pass" });
    }
  });

  it("열려 있지 않은 화면(프로그램·가입·결제·호스트 등)은 소개 페이지로 돌려보낸다", () => {
    for (const p of ["/meetups", "/meetups/abc", "/signup", "/login", "/checkout/123", "/host", "/me", "/hosts/jiwan", "/journal", "/admin", "/apply"]) {
      expect(comingSoonRoute(p, noDb), p).toEqual({ kind: "redirect", to: "/" });
    }
  });

  it("운영 DB가 연결되면 크리에이터 지원과 관리자 로그인·화면만 추가로 열고, 회원가입·결제·프로그램은 계속 막는다", () => {
    for (const p of ["/apply", "/login", "/admin", "/admin/creators", "/auth/callback", "/forgot-password"]) {
      expect(comingSoonRoute(p, withDb), p).toEqual({ kind: "pass" });
    }
    for (const p of ["/signup", "/meetups", "/checkout/1", "/me", "/host", "/become-a-host"]) {
      expect(comingSoonRoute(p, withDb), p).toEqual({ kind: "redirect", to: "/" });
    }
  });

  it("끝의 슬래시와 파일 경로를 알맞게 처리한다", () => {
    expect(comingSoonRoute("/terms/", noDb)).toEqual({ kind: "pass" });
    expect(comingSoonRoute("/brand/logo.png", noDb)).toEqual({ kind: "pass" });
    expect(comingSoonRoute("/adminx", withDb)).toEqual({ kind: "redirect", to: "/" }); // /admin 으로 시작해도 다른 경로는 열지 않음
  });
});

describe("임시 공개 모드: 운영 환경 검사", () => {
  const production = { NEXT_PUBLIC_APP_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://example.kr", ALLOW_PRODUCTION_DEPLOY: "approved", VERCEL_ENV: "production" };
  const errorsOf = (src: Record<string, string | undefined>) => {
    const r = parseEnv(src);
    return r.ok ? [] : r.errors;
  };

  it("운영에서 SITE_MODE 없이 Supabase 설정이 없으면 여전히 막는다 (기존 안전장치 유지)", () => {
    expect(errorsOf(production).join()).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("SITE_MODE=coming_soon 이면 Supabase 설정 없이도 운영 환경을 통과한다", () => {
    expect(errorsOf({ ...production, SITE_MODE: "coming_soon" })).toEqual([]);
  });

  it("운영 배포 승인(ALLOW_PRODUCTION_DEPLOY) 확인은 임시 공개 모드에서도 그대로 필요하다", () => {
    const { ALLOW_PRODUCTION_DEPLOY: _omit, ...withoutApproval } = production;
    void _omit;
    expect(errorsOf({ ...withoutApproval, SITE_MODE: "coming_soon" }).join()).toContain("운영(Production) 배포는 아직 허용되지 않습니다");
  });

  it("SITE_MODE 에 다른 값을 넣으면 거부한다", () => {
    expect(errorsOf({ SITE_MODE: "maintenance" }).join()).toContain("SITE_MODE");
  });
});
