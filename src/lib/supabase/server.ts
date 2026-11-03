import "server-only";

import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "./config";

/**
 * 서버(화면 렌더링·서버 처리)용 Supabase 연결 — 로그인한 사용자 본인의 권한으로 동작하며
 * DB의 RLS가 그대로 적용됩니다. 모든 권한을 무시하는 비밀키 연결은 앱 코드에서 사용하지 않습니다.
 */
export async function createSupabaseServerClient() {
  // 로그인 정보는 요청마다 달라지므로 항상 요청 시점에 실행 (미리 만들어 두는 화면에 섞이지 않게)
  await connection();
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
          // 서버 컴포넌트 렌더링 중에는 쿠키를 쓸 수 없습니다. 세션 갱신은 proxy.ts에서 처리합니다.
        }
      },
    },
  });
}
