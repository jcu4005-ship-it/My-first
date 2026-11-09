/**
 * 브랜드 설정 — 서비스명·회사 정보는 이 파일에서만 관리합니다.
 *
 * - 화면·메일·약관 등 모든 곳은 이 값을 불러서 표시해야 합니다(이름 직접 작성 금지).
 * - 브랜드명이 확정되면 이 파일과 로고 이미지만 교체합니다.
 * - 사업자 정보는 확정 전이므로 비워 두며, 출시 전 체크리스트(설계안 9장)에서 채웁니다.
 */
export const brand = {
  /** 서비스 표시 이름 (가칭) */
  name: "Gathering",
  /** 가칭 여부 — true면 화면에 "(가칭)" 표기 */
  isPlaceholderName: true,
  /** 코드·저장소 내부 식별자 (사용자에게 보이지 않음) */
  codeName: "gathering",
  /** 메인 영문 카피 */
  englishTagline: "Make time for what inspires you.",
  /** 한 줄 소개 (한글) */
  tagline: "검증된 전문가에게 소수 정예로 배우고, 어제보다 나은 나를 만나는 시간.",
  description:
    "검증된 전문가와 크리에이터가 여는 소수 정예 오프라인 프로그램과 경험",
  locale: "ko-KR",
  /** 사업자 정보 — 출시 전 확정 (설계안 9-2) */
  company: {
    legalName: "",
    representative: "",
    businessRegistrationNumber: "",
    mailOrderBusinessNumber: "",
    address: "",
    supportEmail: "",
  },
} as const;

export type Brand = typeof brand;

/** 화면에 표시할 서비스명 (가칭 표기 포함 여부 선택) */
export function displayName(options: { withPlaceholderMark?: boolean } = {}) {
  const { withPlaceholderMark = false } = options;
  return withPlaceholderMark && brand.isPlaceholderName
    ? `${brand.name} (가칭)`
    : brand.name;
}
