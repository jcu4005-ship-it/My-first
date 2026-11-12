"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, House, UserRound, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "홈", icon: House, match: (p: string) => p === "/" },
  { href: "/meetups", label: "탐색", icon: Compass, match: (p: string) => p.startsWith("/meetups") },
  { href: "/hosts", label: "호스트", icon: Users, match: (p: string) => p.startsWith("/hosts") || p.startsWith("/become-a-host") },
  { href: "/journal", label: "저널", icon: BookOpen, match: (p: string) => p.startsWith("/journal") },
  { href: "/me", label: "마이", icon: UserRound, match: (p: string) => p.startsWith("/me") },
];

/** 휴대폰 전용 아래 탭 막대. 실제로 있는 화면으로만 연결합니다. */
export function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="주요 메뉴 (모바일)"
      data-tabbar
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-forest" : "text-muted-foreground",
                )}
              >
                <Icon aria-hidden className="size-5" strokeWidth={active ? 2 : 1.6} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
