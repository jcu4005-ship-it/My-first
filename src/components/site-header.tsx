import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { Suspense } from "react";

import { displayName } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { getCurrentMember } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { MobileTabBar } from "./mobile-tab-bar";

const iconButton =
  "relative inline-flex size-10 items-center justify-center rounded-full border border-border bg-white/70 text-foreground transition-colors hover:bg-white";

async function AccountNav() {
  const member = await getCurrentMember().catch(() => null);
  if (!member) {
    return (
      <nav className="flex items-center gap-2 text-sm" aria-label="계정">
        <Link href="/login" className="px-2 py-2 font-medium text-muted-foreground hover:text-foreground">
          로그인
        </Link>
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href="/signup">가입하기</Link>
        </Button>
      </nav>
    );
  }
  const link = "hidden px-2 py-2 text-muted-foreground hover:text-foreground md:inline";
  return (
    <nav className="flex items-center gap-1 text-sm whitespace-nowrap" data-testid="account-nav" aria-label="계정">
      {member.roles.includes("admin") && (
        <Link href="/admin" className={link}>
          관리자
        </Link>
      )}
      {member.roles.includes("host") && (
        <Link href="/host" className={link}>
          호스트 공간
        </Link>
      )}
      <Link href="/me/bookings" className={link}>
        신청 내역
      </Link>
      <UnreadBadge userId={member.id} />
      <Link href="/me" className="hidden max-w-28 truncate px-2 py-2 font-medium md:inline" data-testid="nav-nickname">
        {member.nickname}
      </Link>
    </nav>
  );
}

async function UnreadBadge({ userId }: { userId: string }) {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return (
    <Link href="/me/notifications" className={iconButton} aria-label={`알림 ${count ?? 0}개`} data-testid="nav-notifications">
      <Bell aria-hidden strokeWidth={1.6} />
      {!!count && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-clay px-1 text-center text-[10px] leading-4 text-white" data-testid="unread-count">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

const NAV = [
  { href: "/meetups", label: "프로그램" },
  { href: "/hosts", label: "호스트" },
  { href: "/journal", label: "저널" },
  { href: "/become-a-host", label: "호스트 지원" },
];

/**
 * 사이트 머리글: 이름 + 큰 메뉴 4개(PC) + 검색·알림 아이콘.
 * 휴대폰에서는 위쪽 메뉴 대신 아래 탭 막대(홈·탐색·호스트·저널·마이)를 씁니다.
 * tabBar=false: 아래쪽에 자체 고정 버튼이 있는 화면(프로그램 상세)에서 탭 막대를 숨김.
 */
export function SiteHeader({ tabBar = true }: { tabBar?: boolean }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-10 whitespace-nowrap">
            <Link href="/" className="font-display text-2xl font-bold tracking-tight text-forest" aria-label={`${displayName()} 홈`}>
              {displayName()}
              <span aria-hidden>.</span>
            </Link>
            <nav aria-label="주요 메뉴" className="hidden items-center gap-7 md:flex">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/meetups" className={iconButton} aria-label="프로그램 찾기">
              <Search aria-hidden strokeWidth={1.6} />
            </Link>
            <Suspense fallback={<div className="h-10 w-10" />}>
              <AccountNav />
            </Suspense>
          </div>
        </div>
      </header>
      {tabBar && <MobileTabBar />}
    </>
  );
}
