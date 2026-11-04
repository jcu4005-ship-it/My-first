/**
 * 브랜드 사진 자리 (메인 히어로, 커뮤니티 섹션, 카테고리 타일).
 *
 * 사용법: 사용 권한이 확인된 사진을 public/images/brand/ 에 넣고 아래 경로를 채웁니다.
 *  - 직접 촬영했거나 사용 허락·라이선스를 받은 사진만 사용합니다.
 *  - 실제 수업 사진이 아닌 분위기 사진은 credit에 출처를 남기고, 실제 클래스 사진처럼 보이게 쓰지 않습니다.
 *  - 비워 두면(null) 사진 없이도 완성도 있게 보이는 타이포그래피 화면이 표시됩니다.
 */
export type BrandImage = { src: string; alt: string; credit?: string } | null;

export const brandImages: {
  hero: BrandImage;
  club: BrandImage;
  host: BrandImage;
  categories: Record<string, BrandImage>;
} = {
  hero: null,
  club: null,
  host: null,
  categories: {},
};
