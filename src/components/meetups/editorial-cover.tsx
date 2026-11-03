import { cn } from "@/lib/utils";

import { categoryStyle } from "./category-style";

/** 사진 없이도 모임의 개성이 드러나는 잡지형 표지 */
export function EditorialCover({
  category,
  categoryName,
  title,
  area,
  size = "card",
  className,
}: {
  category: string;
  categoryName: string;
  title: string;
  area?: string;
  size?: "card" | "hero";
  className?: string;
}) {
  const s = categoryStyle(category);
  return (
    <div
      className={cn(
        "relative flex flex-col justify-between overflow-hidden",
        size === "card" ? "aspect-[4/3] p-5" : "aspect-[4/3] p-6 sm:aspect-[16/9] sm:p-10",
        className,
      )}
      style={{ backgroundColor: s.bg, color: s.fg }}
      aria-hidden
    >
      <div className="flex items-start justify-between text-[11px] tracking-[0.25em]">
        <span>{s.label}</span>
        {area && <span className="tracking-normal opacity-80">{area}</span>}
      </div>
      <div
        className="pointer-events-none absolute -right-6 -bottom-10 font-display leading-none font-bold opacity-[0.12] select-none"
        style={{ fontSize: size === "card" ? "9rem" : "16rem" }}
      >
        {categoryName.slice(0, 1)}
      </div>
      <p
        className={cn(
          "relative font-display leading-snug font-bold break-keep",
          size === "card" ? "line-clamp-3 text-xl" : "max-w-2xl text-3xl sm:text-5xl",
        )}
      >
        {title}
      </p>
    </div>
  );
}
