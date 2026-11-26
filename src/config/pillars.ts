/** 3대 분류 (DB enum public.pillar 와 같은 값). 화면 이름·설명은 여기서만 관리합니다. */
export const PILLARS = [
  { slug: "knowledge", label: "Knowledge", ko: "지식·관점", description: "철학, 심리, 인문학, 경제·사회, 사고법 — 세상을 보는 관점을 넓히는 배움" },
  { slug: "creators", label: "Creators", ko: "창작·표현", description: "사진, 영상, 드로잉·공예, 음악, 글쓰기, 커피·요리 — 직접 만들고 표현하는 배움" },
  { slug: "experts", label: "Experts", ko: "전문성·실무", description: "커리어, 실무 기술, 몸과 습관 — 현장에서 다듬어진 노하우를 배우는 시간" },
] as const;

export type PillarSlug = (typeof PILLARS)[number]["slug"];

export function isPillar(v: unknown): v is PillarSlug {
  return typeof v === "string" && PILLARS.some((p) => p.slug === v);
}

export function pillarInfo(slug: string | null | undefined) {
  return PILLARS.find((p) => p.slug === slug) ?? null;
}
