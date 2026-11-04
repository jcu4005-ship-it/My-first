import Link from "next/link";
import { Suspense } from "react";

import { displayName } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { getCurrentMember } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function AccountNav() {
  const member = await getCurrentMember().catch(() => null);
  if (!member) {
    return (
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/login" className="px-2 py-2 text-muted-foreground hover:text-foreground">
          로그인
        </Link>
        <Button asChild size="sm">
          <Link href="/signup">가입하기</Link>
        </Button>
      </nav>
    );
  }
  return (
    <nav className="flex items-center gap-0.5 text-sm whitespace-nowrap" data-testid="account-nav">
      {member.roles.includes("admin") && (
        <Link href="/admin" className="hidden px-2 py-2 text-muted-foreground hover:text-foreground sm:inline">
          관리자
        </Link>
      )}
      {member.roles.includes("host") && (
        <Link href="/host" className="px-2 py-2 text-muted-foreground hover:text-foreground">
          호스트
        </Link>
      )}
      <Link href="/me/bookings" className="px-2 py-2 text-muted-foreground hover:text-foreground">
        신청 내역
      </Link>
      <UnreadBadge userId={member.id} />
      <Link href="/me" className="max-w-24 truncate px-2 py-2 font-medium" data-testid="nav-nickname">
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
    <Link href="/me/notifications" className="relative px-2 py-2 text-muted-foreground hover:text-foreground" aria-label={`알림 ${count ?? 0}개`} data-testid="nav-notifications">
      알림
      {!!count && (
        <span className="absolute top-0.5 -right-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 text-accent-foreground" data-testid="unread-count">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

const NAV = [
  { href: "/meetups", label: "Experiences", ko: "클래스" },
  { href: "/experts", label: "Experts", ko: "전문가" },
  { href: "/host/apply", label: "Become a Host", ko: "호스트 지원" },
];

/**
 * 사이트 머리글. overlay=true면 메인 히어로 사진 위에 투명하게 겹칩니다.
 * 메뉴 이름은 영문 라벨 + 화면 읽기용 한글 이름을 함께 둡니다.
 */
export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  return (
    <header
      className={
        overlay
          ? "absolute inset-x-0 top-0 z-20 text-sand-light [--muted-foreground:#d6cec1] [--foreground:#f5f1ea] [--primary:#f5f1ea] [--primary-foreground:#211d1a]"
          : "border-b border-border/70"
      }
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <div className="flex items-center gap-8 whitespace-nowrap">
          <Link href="/" className="font-display text-xl font-bold tracking-[0.12em] uppercase">
            {displayName()}
          </Link>
          <nav aria-label="주요 메뉴" className="hidden items-center gap-6 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="eyebrow text-muted-foreground transition-colors hover:text-foreground">
                {n.label}
                <span className="sr-only"> ({n.ko})</span>
              </Link>
            ))}
          </nav>
        </div>
        <Suspense fallback={<div className="h-9" />}>
          <AccountNav />
        </Suspense>
      </div>
      <nav aria-label="주요 메뉴 (모바일)" className="mx-auto flex w-full max-w-7xl gap-5 px-4 pb-3 md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="eyebrow py-1 text-muted-foreground hover:text-foreground">
            {n.label}
            <span className="sr-only"> ({n.ko})</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
