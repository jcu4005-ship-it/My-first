import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Supabase 기본 메일 링크(인증·비밀번호 재설정)에서 돌아오는 곳.
 * Supabase가 이메일을 확인한 뒤 일회용 code를 붙여 보내면, 서버가 로그인 세션으로 바꿉니다.
 * - 같은 브라우저: 바로 로그인 → next 로 이동
 * - 다른 브라우저(코드 교환 불가): 가입 인증은 이미 완료 → 로그인 화면 안내 / 재설정은 다시 요청 안내
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const flow = params.get("flow") === "recovery" ? "recovery" : "signup";
  const code = params.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(flow === "recovery" ? "/reset-password" : safeNextPath(params.get("next")));
    }
  }
  if (flow === "signup" && !params.get("error")) redirect("/login?notice=verified");
  redirect("/auth-error");
}
