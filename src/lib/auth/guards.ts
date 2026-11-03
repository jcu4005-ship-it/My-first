import "server-only";

import { forbidden, redirect } from "next/navigation";

import { getCurrentMember, type AppRole, type CurrentMember } from "./session";

/**
 * 서버 권한 검사 — 화면(페이지)과 서버 처리(Server Action)에서 매번 호출합니다.
 * DB의 RLS·관리자 함수도 같은 규칙을 다시 확인합니다(이중 검사).
 */
export async function requireMember(nextPath: string): Promise<CurrentMember> {
  const member = await getCurrentMember();
  if (!member) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return member;
}

export async function requireActiveMember(nextPath: string): Promise<CurrentMember> {
  const member = await requireMember(nextPath);
  if (member.status !== "active") forbidden();
  return member;
}

export async function requireRole(role: AppRole, nextPath: string): Promise<CurrentMember> {
  const member = await requireActiveMember(nextPath);
  if (!member.roles.includes(role)) forbidden();
  return member;
}

/** 관리자: admin 역할 + 2단계 인증(aal2). 2단계 인증 전이면 인증 화면으로 보냅니다. */
export async function requireAdmin(nextPath: string): Promise<CurrentMember> {
  const member = await requireRole("admin", nextPath);
  if (member.aal !== "aal2") redirect(`/admin/mfa?next=${encodeURIComponent(nextPath)}`);
  return member;
}

/** Server Action용: 리디렉트 대신 결과로 돌려줍니다. */
export async function checkAdminForAction(): Promise<CurrentMember | null> {
  const member = await getCurrentMember();
  if (!member || member.status !== "active" || !member.roles.includes("admin") || member.aal !== "aal2") {
    return null;
  }
  return member;
}
