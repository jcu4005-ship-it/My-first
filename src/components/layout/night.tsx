import { cn } from "@/lib/utils";

/**
 * 미드나잇 네이비 화면 감싸개 (드롭 × 모닥불 원, 2026-11-20 승인 · 색 D안).
 * 참가자 화면만 이 안에 둡니다. 호스트·관리자·약관·라운디 이야기 화면은 밝은 화면 그대로.
 * 주의: 바탕색은 이 감싸개 자신만 가집니다. Next.js는 이전 화면을 숨겨서 보관하므로,
 * body 에 "네이비 화면이 있으면 …" 같은 규칙을 걸면 숨겨진 화면 때문에 다른 화면의 바탕이 남색이 됩니다(2026-11-21 실제 발생).
 */
export function Night({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("theme-night flex min-h-dvh flex-1 flex-col", className)}>{children}</div>;
}
