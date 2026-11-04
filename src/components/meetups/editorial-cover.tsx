import { cn } from "@/lib/utils";

import { categoryStyle } from "./category-style";

/**
 * 사진이 없을 때 쓰는 타이포그래피 표지. 부모 요소를 꽉 채웁니다 (부모가 relative + 크기 지정).
 * 단색 상자처럼 보이지 않도록 영문 라벨·가는 선·큰 이니셜로 잡지 표지처럼 구성합니다.
 */
export function EditorialCover({
  category,
  title,
  area,
  size = "card",
  showTitle = true,
  className,
}: {
  category: string;
  title: string;
  area?: string;
  size?: "card" | "hero";
  /** 상세 화면처럼 제목이 바로 아래 크게 나오는 곳에서는 false */
  showTitle?: boolean;
  className?: string;
}) {
  const s = categoryStyle(category);
  const hero = size === "hero";
  return (
    <div
      className={cn("absolute inset-0 flex flex-col justify-between overflow-hidden", hero ? "p-6 sm:p-12" : "p-5", className)}
      style={{ backgroundColor: s.bg, color: s.fg }}
      aria-hidden
    >
      <div className="flex items-center justify-between gap-4">
        <span className="eyebrow">{s.label}</span>
        {area && <span className="text-[11px] tracking-[0.15em] opacity-80">{area}</span>}
      </div>
      <span
        className="pointer-events-none absolute top-1/2 right-[-0.08em] -translate-y-1/2 font-display leading-none font-bold opacity-[0.09] select-none"
        style={{ fontSize: hero ? "min(42vw, 26rem)" : "11rem" }}
      >
        {s.label.slice(0, 1)}
      </span>
      <div className="relative">
        <span className="mb-3 block h-px w-10 bg-current opacity-60" />
        {showTitle && (
        <p className={cn("font-display leading-snug font-medium break-keep", hero ? "max-w-3xl text-3xl sm:text-5xl" : "line-clamp-3 text-xl")}>
          {title}
        </p>
        )}
      </div>
    </div>
  );
}
