import "server-only";

import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppRole = "participant" | "host" | "admin";
export type MemberStatus = "active" | "suspended" | "withdrawn";

export type CurrentUser = {
  /** 변경되지 않는 내부 식별자 (UUID) — 권한·관계의 기준 */
  id: string;
  email: string | null;
  /** 인증 수준: aal1 = 일반 로그인, aal2 = 2단계 인증 완료 */
  aal: "aal1" | "aal2";
};

export type CurrentMember = CurrentUser & {
  nickname: string;
  status: MemberStatus;
  roles: AppRole[];
};

/**
 * 검증된 로그인 정보만 반환합니다.
 * getClaims()는 토큰 서명을 검증합니다. getSession()의 값은 쿠키를 그대로 믿는 것이라 사용하지 않습니다.
 * 권한(role)은 토큰이 아니라 DB에서 읽습니다(getCurrentMember).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
  };
});

/** 로그인 정보 + DB의 프로필 상태·역할 (요청마다 새로 조회 — 권한 변경이 즉시 반영됨) */
export const getCurrentMember = cache(async (): Promise<CurrentMember | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("nickname, status").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  if (!profile) return null;
  return {
    ...user,
    nickname: profile.nickname,
    status: profile.status as MemberStatus,
    roles: (roles ?? []).map((r) => r.role as AppRole),
  };
});
