/**
 * 카테고리별 표지 색과 영문 라벨 (화면 표현용, DB 카테고리 slug 기준).
 * 색은 브랜드 팔레트(espresso·sand·terracotta·olive)와 그 명암 변형만 사용합니다.
 */
const STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  philosophy: { bg: "#2D2824", fg: "#EAE4D9", label: "PHILOSOPHY" },
  reading: { bg: "#EAE4D9", fg: "#211D1A", label: "LITERATURE" },
  psychology: { bg: "#747A65", fg: "#F5F1EA", label: "PSYCHOLOGY" },
  society: { bg: "#4E5244", fg: "#EAE4D9", label: "ECONOMY & SOCIETY" },
  thinking: { bg: "#A66D50", fg: "#FFFFFF", label: "THINKING" },
  photo: { bg: "#211D1A", fg: "#EAE4D9", label: "PHOTOGRAPHY" },
  art: { bg: "#747A65", fg: "#F5F1EA", label: "CRAFT & DESIGN" },
  music: { bg: "#2D2824", fg: "#D9B39E", label: "MUSIC" },
  coffee: { bg: "#A66D50", fg: "#FFFFFF", label: "COFFEE & TEA" },
  cooking: { bg: "#EAE4D9", fg: "#211D1A", label: "FOOD & DINING" },
  writing: { bg: "#D8D0C2", fg: "#211D1A", label: "WRITING" },
  career: { bg: "#4E5244", fg: "#EAE4D9", label: "BUSINESS & SKILLS" },
  wellness: { bg: "#C4B8A4", fg: "#211D1A", label: "WELLNESS" },
};

export function categoryStyle(slug: string) {
  return STYLES[slug] ?? { bg: "#2D2824", fg: "#EAE4D9", label: slug.toUpperCase() };
}
