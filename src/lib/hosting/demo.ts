/**
 * 가상(시연용) 크리에이터 소개 표시 (대표 요청 2026-11-21).
 * 실제 이름의 크리에이터에게 확인하지 않은 소개를 화면 확인용으로 넣을 때, 글에 "가상 소개"라는 말을 반드시 붙인다.
 * 이런 소개는 "운영팀 확인" 표시·체크리스트를 켜지 않고, 크리에이터 본인이 쓴 글처럼 서명하지도 않는다.
 */
export const DEMO_MARK = "가상 소개";

export function isDemoProfile(h: { headline?: string | null; bio?: string | null; philosophy?: string | null; career?: string | null } | null | undefined): boolean {
  if (!h) return false;
  return [h.headline, h.bio, h.philosophy, h.career].some((t) => typeof t === "string" && (t.includes(DEMO_MARK) || t.includes("(가상)") || t.includes("가상 경력")));
}

/** 운영팀 확인 표시를 켤 수 있는 크리에이터인가: 샘플이 아니고, 소개(한 줄·소개 글)가 있고, 가상 소개가 아닐 때 */
export function isVerifiedHost(
  h: { headline?: string | null; bio?: string | null; philosophy?: string | null; career?: string | null; is_sample?: boolean } | null | undefined,
): boolean {
  return Boolean(h && !h.is_sample && (h.headline || h.bio) && !isDemoProfile(h));
}
