import { cn } from "@/lib/utils";

/**
 * BLUE 화면 감싸개 (참가자 화면, 2026-11-21 대표 지정 파란 디자인 시스템).
 * 바탕 Ice Blue · 카드 White · 헤더와 아래 탭 막대는 Deep Blue (색은 globals.css 의 .theme-blue 토큰에서만 관리).
 * 호스트·관리자·로그인·약관 화면은 이 안에 두지 않고 지금처럼 밝은 화면 그대로 둡니다.
 * 주의: 바탕색은 이 감싸개 자신만 가집니다. Next.js는 이전 화면을 숨겨서 보관하므로,
 * body 에 ".theme-blue 가 있으면 …" 같은 규칙을 걸면 숨겨진 화면 때문에 다른 화면의 바탕이 바뀝니다(2026-11-21 실제 발생).
 */
export function Blue({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("theme-blue flex min-h-dvh flex-1 flex-col", className)}>{children}</div>;
}
