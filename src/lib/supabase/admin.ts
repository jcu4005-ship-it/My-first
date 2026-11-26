import "server-only";

import { createClient } from "@supabase/supabase-js";

import { assertValidEnv } from "@/config/env";

/**
 * 서버 비밀키 연결 — 결제 확정·환불 기록(DB 함수 confirm_payment / refund_booking)에만 사용합니다.
 * 이 연결은 RLS를 무시하므로 다른 용도로 쓰지 않습니다. 브라우저로 절대 전달되지 않습니다(server-only).
 */
export function createSupabaseServiceClient() {
  const env = assertValidEnv(process.env);
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error("결제 처리를 위한 서버 설정(SUPABASE_SECRET_KEY)이 없습니다.");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function serviceClientAvailable(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
}
