import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import pg from "pg";

import { isStaging, testEnv } from "./env";
import { totp } from "./totp";

/** 로컬은 고정, 스테이징은 실행마다 무작위 (출력·저장하지 않음) */
export const PASSWORD = isStaging ? `Stg${randomUUID().replace(/-/g, "").slice(0, 16)}9` : "Testpass1234";

/** 테스트 계정 준비용 관리 연결 (로컬/CI 전용 비밀키) */
export function adminApi(): SupabaseClient {
  return createClient(testEnv.supabaseUrl, testEnv.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** 일반 사용자와 동일한 공개 키 연결 (공격자 입장) */
export function publicClient(): SupabaseClient {
  return createClient(testEnv.supabaseUrl, testEnv.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function uniqueEmail(tag: string) {
  return isStaging ? `stg-${tag}-${randomUUID().slice(0, 8)}@example.com` : `${tag}-${randomUUID().slice(0, 8)}@test.local`;
}

/** 스테이징 테스트 계정 닉네임은 stg 로 시작 */
export function uniqueNickname(tag: string) {
  return `${isStaging ? "stg" : ""}${tag}${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export type TestMember = { id: string; email: string; nickname: string; client: SupabaseClient };

/** 이메일 인증된 회원 생성 후 로그인한 연결을 돌려줌 */
export async function createMember(tag: string, extraMeta: Record<string, unknown> = {}): Promise<TestMember> {
  const email = uniqueEmail(tag);
  const nickname = uniqueNickname(tag);
  const { data, error } = await adminApi().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      nickname,
      consents: { terms_version: "test", privacy_version: "test", age_14_plus: true, marketing: false },
      ...extraMeta,
    },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const client = publicClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, email, nickname, client };
}

/** 테스트 준비: 서버 비밀키로 역할 직접 부여 (앱 경로 아님 — 테스트 계정 전용) */
export async function grantRoleDirect(userId: string, role: "host" | "admin") {
  const { error } = await adminApi().from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
  if (error) throw new Error(`역할 부여 실패: ${error.message}`);
}

/** 테스트 정리: 테스트 계정의 역할 회수 (스테이징에 관리자 권한을 남기지 않음) */
export async function revokeRoleDirect(userId: string, role: "host" | "admin") {
  await adminApi().from("user_roles").delete().eq("user_id", userId).eq("role", role);
}

/** 테스트 준비: 승인된 호스트로 만들기 (서버 비밀키, 테스트 계정 전용) */
export async function makeApprovedHost(userId: string, displayName = "테스트 호스트") {
  const { error } = await adminApi()
    .from("host_profiles")
    .upsert({ user_id: userId, display_name: displayName, headline: "테스트용 호스트입니다", status: "approved" }, { onConflict: "user_id" });
  if (error) throw new Error(`호스트 준비 실패: ${error.message}`);
  await grantRoleDirect(userId, "host");
}

/** 로컬 전용: DB 직접 조회 (스테이징에서는 사용 불가) */

export async function dbQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = []) {
  if (isStaging) throw new Error("dbQuery는 로컬 전용입니다 (스테이징 DB 직접 접속 금지)");
  const db = new pg.Client({ connectionString: testEnv.dbUrl });
  await db.connect();
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.end();
  }
}

/** 로그인한 연결에서 TOTP 등록·확인 → 세션 aal2 */
export async function upgradeToAal2(client: SupabaseClient) {
  const { data: enrolled, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `t-${randomUUID()}` });
  if (error || !enrolled) throw error ?? new Error("enroll failed");
  const { error: verifyError } = await client.auth.mfa.challengeAndVerify({
    factorId: enrolled.id,
    code: totp(enrolled.totp.secret),
  });
  if (verifyError) throw verifyError;
}
