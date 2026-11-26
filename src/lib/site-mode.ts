/**
 * 사이트 모드: 임시 공개("곧 문을 엽니다") 모드
 *
 * 운영 DB·결제·메일이 준비되기 전에 도메인(roundi.kr 등)으로 들어온 사람에게
 * 소개 페이지·사업자 정보·약관만 보여 주기 위한 모드입니다. 환경변수 SITE_MODE=coming_soon 일 때만 켜집니다.
 *
 * - 열려 있는 화면: 소개(/), 이용약관, 개인정보 처리방침, 취소·환불 정책
 * - 운영 DB가 연결돼 있으면(= Supabase 환경변수가 있으면) 추가로: 크리에이터 지원(/apply)과 관리자 로그인·화면(/login, /admin …)
 *   회원가입·프로그램·결제 등 나머지는 모두 막고 소개 페이지로 돌려보냅니다.
 * - 끄는 법: SITE_MODE 환경변수를 지우고 다시 배포 (docs/COMING_SOON_MODE.md)
 */
export function isComingSoon(env: Record<string, string | undefined> = process.env): boolean {
  return env.SITE_MODE === "coming_soon";
}

export type RouteDecision = { kind: "pass" } | { kind: "rewrite"; to: string } | { kind: "redirect"; to: string };

/** 임시 공개 모드에서 항상 열어 두는 화면 */
const ALWAYS_OPEN = ["/terms", "/privacy", "/refund", "/coming-soon", "/api/health", "/opengraph-image", "/robots.txt", "/sitemap.xml", "/icon.svg", "/favicon.ico"];

/** 운영 DB가 연결된 경우에만 여는 화면 (지원 접수·관리자 로그인에 필요한 것만, 회원가입은 계속 막음) */
const OPEN_WITH_DATABASE = ["/apply", "/login", "/forgot-password", "/reset-password", "/check-email", "/auth-error", "/auth", "/denied", "/admin"];

function under(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** 이 요청을 그대로 보여 줄지(pass), 소개 페이지를 대신 보여 줄지(rewrite), 소개 페이지로 보낼지(redirect) */
export function comingSoonRoute(pathname: string, options: { databaseConfigured: boolean }): RouteDecision {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/") return { kind: "rewrite", to: "/coming-soon" };
  if (/\.[a-z0-9]+$/i.test(path)) return { kind: "pass" }; // 이미지·글꼴 같은 파일
  if (ALWAYS_OPEN.some((p) => under(path, p))) return { kind: "pass" };
  if (options.databaseConfigured && OPEN_WITH_DATABASE.some((p) => under(path, p))) return { kind: "pass" };
  return { kind: "redirect", to: "/" };
}
