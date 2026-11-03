import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "./config";

/**
 * 서버(화면 렌더링·서버 처리)용 Supabase 연결 — 로그인한 사용자 본인의 권한으로 동작합니다.
 * 모든 권한을 무시하는 비밀키(SUPABASE_SECRET_KEY) 연결은 웹훅 등 꼭 필요한 곳에서만
 * 별도 모듈로 만들며, 0단계에서는 만들지 않습니다.
 */
export async function createSupabaseServerClient() {
  const { url, key } = getSupabasePublicConfig();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 서버 컴포넌트 렌더링 중에는 쿠키를 쓸 수 없습니다. 세션 갱신은 1단계에서 proxy로 처리합니다.
        }
      },
    },
  });
}
