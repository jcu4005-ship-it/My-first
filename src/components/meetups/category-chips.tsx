import Link from "next/link";

import type { Category } from "@/lib/meetups/queries";
import { cn } from "@/lib/utils";

export function CategoryChips({ categories, active }: { categories: Category[]; active?: string }) {
  const chip = (isActive: boolean) =>
    cn(
      "block shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm transition-colors",
      isActive ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground",
    );
  return (
    <nav aria-label="카테고리" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 pb-1">
        <li>
          <Link href="/meetups" className={chip(!active)} aria-current={!active ? "page" : undefined}>
            전체
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/meetups?category=${c.slug}`}
              className={chip(active === c.slug)}
              aria-current={active === c.slug ? "page" : undefined}
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
