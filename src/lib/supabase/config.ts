import { assertValidEnv } from "@/config/env";

/** Supabase 공개 연결 정보. 아직 프로젝트가 연결되지 않았다면 이유를 담아 오류를 냅니다. */
export function getSupabasePublicConfig() {
  const env = assertValidEnv(process.env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase가 아직 연결되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 설정하세요. (docs/SETUP.md 참고)",
    );
  }
  return { url, key };
}
