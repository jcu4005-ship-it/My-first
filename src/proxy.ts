import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * 요청 전처리 (Next.js 16의 proxy = 이전 middleware)
 * 1) Supabase 로그인 세션 갱신(쿠키)
 * 2) 화면을 그리기 전에 접근 권한·대상 존재 여부를 확인해 정확한 HTTP 상태를 돌려줍니다.
 *    - 비로그인 보호 경로 → 로그인 화면(307)
 *    - 권한 없음 → 403 (/denied 화면)
 *    - 없거나 비공개인 모임·호스트, 내 것이 아닌 관리 화면 → 404
 *    화면(guards.ts)과 DB(RLS·함수)의 권한 검사는 그대로 유지됩니다(다중 방어).
 */
const PROTECTED_PREFIXES = ["/me", "/host", "/admin", "/reset-password", "/checkout"]; // /hosts(공개 프로필)는 제외
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function under(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const { pathname, search } = request.nextUrl;

  /** 갱신된 세션 쿠키를 유지한 채 다른 응답으로 바꿈 */
  const carry = (res: NextResponse) => {
    for (const c of response.cookies.getAll()) res.cookies.set(c);
    return res;
  };
  const deny = () => carry(NextResponse.rewrite(new URL("/denied", request.url)));
  const missing = () => carry(NextResponse.rewrite(new URL("/__not-found", request.url)));

  // ---- 공개 상세: 없거나 비공개면 404 ----
  const seg = pathname.split("/").filter(Boolean);
  if (seg[0] === "meetups" && seg.length === 2) {
    if (!UUID.test(seg[1])) return missing();
    const { data: m } = await supabase.from("meetups").select("id").eq("id", seg[1]).eq("status", "published").maybeSingle();
    return m ? response : missing();
  }
  if (seg[0] === "hosts" && seg.length === 2) {
    if (!UUID.test(seg[1])) return missing();
    const { data: h } = await supabase.from("host_profiles").select("user_id").eq("user_id", seg[1]).eq("status", "approved").maybeSingle();
    return h ? response : missing();
  }

  if (!PROTECTED_PREFIXES.some((p) => under(pathname, p))) return response;

  // ---- 로그인 필요 ----
  if (!claims) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    return carry(NextResponse.redirect(loginUrl));
  }

  const needsRole = under(pathname, "/admin") || under(pathname, "/host/meetups");
  if (!needsRole && !(seg[0] === "checkout" && seg.length === 2)) return response;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("status").eq("id", claims.sub).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", claims.sub),
  ]);
  const active = profile?.status === "active";
  const roles = new Set((roleRows ?? []).map((r) => r.role as string));

  // ---- 관리자: 역할 + 2단계 인증 ----
  if (under(pathname, "/admin")) {
    if (!active || !roles.has("admin")) return deny();
    if (pathname !== "/admin/mfa" && claims.aal !== "aal2") {
      const mfa = request.nextUrl.clone();
      mfa.pathname = "/admin/mfa";
      mfa.search = `?next=${encodeURIComponent(pathname + search)}`;
      return carry(NextResponse.redirect(mfa));
    }
    return response;
  }

  // ---- 호스트 모임 관리: 호스트 역할 + 본인 모임 ----
  if (under(pathname, "/host/meetups")) {
    if (!active || !roles.has("host")) return deny();
    if (seg.length >= 3 && seg[2] !== "new") {
      if (!UUID.test(seg[2])) return missing();
      const { data: m } = await supabase.from("meetups").select("id").eq("id", seg[2]).eq("host_id", claims.sub).maybeSingle();
      if (!m) return missing();
    }
    return response;
  }

  // ---- 결제 화면: 본인 신청 ----
  if (seg[0] === "checkout") {
    if (!UUID.test(seg[1])) return missing();
    const { data: b } = await supabase.from("bookings").select("id").eq("id", seg[1]).eq("user_id", claims.sub).maybeSingle();
    return b ? response : missing();
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/health|icon.svg|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)",
  ],
};
