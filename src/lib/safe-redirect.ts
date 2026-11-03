/**
 * 로그인 후 이동할 주소 검증 — 외부 사이트로 보내는 "열린 리디렉트" 공격을 막습니다.
 * 같은 사이트 내부 경로("/"로 시작, "//"·"/\" 아님)만 허용합니다.
 */
export function safeNextPath(next: unknown, fallback = "/me"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  try {
    const url = new URL(next, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
