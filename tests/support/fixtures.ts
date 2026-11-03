import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import pg from "pg";

import { testEnv } from "./env";
import { totp } from "./totp";

export const PASSWORD = "Testpass1234";

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
  return `${tag}-${randomUUID().slice(0, 8)}@test.local`;
}

export function uniqueNickname(tag: string) {
  return `${tag}${randomUUID().replace(/-/g, "").slice(0, 8)}`;
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

/** 테스트 데이터 준비: DB 소유자 권한으로 역할 직접 부여 (앱 경로 아님 — 로컬/CI DB 전용) */
export async function grantRoleDirect(userId: string, role: "host" | "admin") {
  const db = new pg.Client({ connectionString: testEnv.dbUrl });
  await db.connect();
  try {
    await db.query("insert into public.user_roles (user_id, role) values ($1, $2) on conflict do nothing", [userId, role]);
  } finally {
    await db.end();
  }
}

/** 테스트 데이터 준비: 승인된 호스트로 만들기 (로컬/CI DB 전용) */
export async function makeApprovedHost(userId: string, displayName = "테스트 호스트") {
  await dbQuery(
    "insert into public.host_profiles (user_id, display_name, headline, status) values ($1, $2, '테스트용 호스트입니다', 'approved') on conflict (user_id) do update set status = 'approved'",
    [userId, displayName],
  );
  await grantRoleDirect(userId, "host");
}

export async function dbQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = []) {
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
