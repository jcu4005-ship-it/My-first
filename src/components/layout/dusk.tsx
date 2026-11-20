import { cn } from "@/lib/utils";

/**
 * 해 질 녘 화면 감싸개 (드롭 × 모닥불 원, 2026-11-20 승인).
 * 참가자 화면만 이 안에 둡니다. 호스트·관리자·약관 화면은 지금의 밝은 화면 그대로.
 */
export function Dusk({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("theme-dusk flex flex-1 flex-col", className)}>{children}</div>;
}
