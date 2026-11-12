import Link from "next/link";

import type { Category } from "@/lib/meetups/queries";
import { cn } from "@/lib/utils";

/** 알약 모양 선택 버튼 (선택된 것은 딥 그린) */
export function chipClass(isActive: boolean) {
  return cn(
    "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm transition-colors",
    isActive ? "border-forest bg-forest font-semibold text-white" : "border-border bg-white/70 text-foreground/80 hover:border-forest/40",
  );
}

export function CategoryChips({ categories, active, allHref = "/meetups" }: { categories: Category[]; active?: string; allHref?: string }) {
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
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
