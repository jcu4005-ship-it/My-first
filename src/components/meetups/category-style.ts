/**
 * 카테고리별 표지 색과 영문 라벨 (화면 표현용, DB 카테고리 slug 기준).
 * 색은 브랜드 팔레트(forest·cream·linen·sage·clay)와 그 명암 변형만 사용합니다.
 */
const STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  philosophy: { bg: "#2E4A3B", fg: "#F7F4EE", label: "PHILOSOPHY" },
  reading: { bg: "#ECE7DD", fg: "#1C2620", label: "LITERATURE" },
  psychology: { bg: "#6F8576", fg: "#FFFFFF", label: "PSYCHOLOGY" },
  society: { bg: "#3D5C4B", fg: "#F7F4EE", label: "ECONOMY & SOCIETY" },
  thinking: { bg: "#DCE6DA", fg: "#1F3329", label: "THINKING" },
  photo: { bg: "#1F3329", fg: "#ECE7DD", label: "PHOTOGRAPHY" },
  art: { bg: "#C9D6C6", fg: "#1F3329", label: "CRAFT & DESIGN" },
  music: { bg: "#2E4A3B", fg: "#B9D3BF", label: "MUSIC" },
  coffee: { bg: "#E4DCCB", fg: "#1C2620", label: "COFFEE & TEA" },
  cooking: { bg: "#ECE7DD", fg: "#1C2620", label: "FOOD & DINING" },
  writing: { bg: "#D9DFD4", fg: "#1C2620", label: "WRITING" },
  career: { bg: "#3D5C4B", fg: "#ECE7DD", label: "BUSINESS & SKILLS" },
  wellness: { bg: "#B9D3BF", fg: "#1F3329", label: "WELLNESS" },
};

export function categoryStyle(slug: string) {
  return STYLES[slug] ?? { bg: "#2E4A3B", fg: "#F7F4EE", label: slug.toUpperCase() };
}
