import Link from "next/link";

import type { Category } from "@/lib/meetups/queries";
import { cn } from "@/lib/utils";

/** 알약 모양 선택 버튼 (선택된 것은 글자색 바탕 — 밝은 화면·해 질 녘 화면 모두) */
export function chipClass(isActive: boolean) {
  return cn(
    "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm transition-colors",
    isActive ? "border-foreground bg-foreground font-semibold text-background" : "border-border bg-card text-foreground/80 hover:border-foreground/40",
  );
}

export function CategoryChips({
  categories,
  active,
  allHref = "/meetups",
  counts,
}: {
  categories: Category[];
  active?: string;
  allHref?: string;
  /** 분야별 프로그램 수 (있으면 칩 옆에 작게 표시) */
  counts?: Record<string, number>;
}) {
  return (
    <nav aria-label="카테고리" className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 py-3">
        <li>
          <Link href={allHref} className={chipClass(!active)} aria-current={!active ? "page" : undefined}>
            전체
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.slug}>
            <Link href={`/meetups?category=${c.slug}`} className={chipClass(active === c.slug)} aria-current={active === c.slug ? "page" : undefined}>
              {c.name}
              {counts?.[c.slug] ? (
                <span aria-hidden className="ml-1.5 text-xs opacity-60">
                  {counts[c.slug]}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
