"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * 브라우저용 Supabase 연결 — 공개(publishable) 키만 사용합니다.
 * 이 연결로 할 수 있는 일은 DB의 RLS 권한 규칙으로 제한됩니다.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase가 아직 연결되지 않았습니다. (docs/SETUP.md 참고)");
  }
  return createBrowserClient(url, key);
}
