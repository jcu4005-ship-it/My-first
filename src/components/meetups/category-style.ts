/** 카테고리별 표지 색 (화면 표현용). 사진이 없는 클래스도 잡지 표지처럼 보이게 합니다. */
const STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  reading: { bg: "#E9E1D3", fg: "#3B2F25", label: "READING" },
  music: { bg: "#2E2A44", fg: "#F2C7A8", label: "MUSIC CLASS" },
  photo: { bg: "#D9CBB4", fg: "#2B2420", label: "FILM & PHOTO" },
  art: { bg: "#C9D8C5", fg: "#22362A", label: "DRAWING & CRAFT" },
  philosophy: { bg: "#1F2D3A", fg: "#E8DCC8", label: "SALON" },
  networking: { bg: "#F1D9C4", fg: "#5A2E1B", label: "PEOPLE" },
  travel: { bg: "#BFD6DE", fg: "#173342", label: "TRAVEL" },
  outdoor: { bg: "#C5502E", fg: "#FBEFE3", label: "OUTDOOR" },
  wine: { bg: "#5B1F2B", fg: "#F3D9C9", label: "WINE" },
  coffee: { bg: "#3A2A20", fg: "#EAD7BF", label: "COFFEE & TEA" },
  cooking: { bg: "#E8C9A0", fg: "#3D2414", label: "COOKING" },
  writing: { bg: "#F0EBE1", fg: "#22201C", label: "WRITING" },
  career: { bg: "#1E3A4C", fg: "#E3EEF2", label: "CAREER SKILLS" },
  wellness: { bg: "#B9CDB8", fg: "#1D3121", label: "BODY & POSTURE" },
};

export function categoryStyle(slug: string) {
  return STYLES[slug] ?? { bg: "#E4E0D8", fg: "#2A2522", label: slug.toUpperCase() };
}
