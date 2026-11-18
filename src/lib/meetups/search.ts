import type { MeetupCardData } from "./queries";

/** 띄어쓰기·대소문자 차이를 무시하고 비교 ("사진 클래스" = "사진클래스") */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

export function normalizeQuery(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, 40) : "";
}

/**
 * 프로그램 검색: 제목·요약·크리에이터 이름·직업·분야 이름·동네·장소 이름에서 찾음.
 * 여러 단어는 모두 들어 있어야 함 (예: "용산 사진").
 */
export function searchMeetups(
  list: MeetupCardData[],
  q: string,
  extra: { categoryName?: (slug: string) => string | undefined } = {},
): MeetupCardData[] {
  const terms = q.split(/\s+/).map(norm).filter(Boolean);
  if (!terms.length) return list;
  return list.filter((m) => {
    const hay = norm(
      [
        m.title,
        m.summary,
        m.host?.display_name,
        m.host?.occupation,
        extra.categoryName?.(m.category_slug),
        ...m.upcomingSessions.flatMap((s) => [s.area, s.venue_name]),
      ]
        .filter(Boolean)
        .join(" "),
    );
    return terms.every((t) => hay.includes(t));
  });
}
