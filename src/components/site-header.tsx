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

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5">
      <div className="flex items-center gap-4 whitespace-nowrap">
        <Link href="/" className="font-display text-xl font-bold tracking-tight">
          {displayName()}
        </Link>
        <Link href="/meetups" className="text-sm text-muted-foreground hover:text-foreground">
          클래스
        </Link>
      </div>
      <Suspense fallback={<div className="h-9" />}>
        <AccountNav />
      </Suspense>
    </header>
  );
}
