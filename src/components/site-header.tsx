import Link from "next/link";
import { Suspense } from "react";

import { displayName } from "@/config/brand";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { getCurrentMember } from "@/lib/auth/session";

async function AccountNav() {
  const member = await getCurrentMember().catch(() => null);
  if (!member) {
    return (
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/login" className="px-3 py-2 text-muted-foreground hover:text-foreground">
          로그인
        </Link>
        <Button asChild size="sm">
          <Link href="/signup">가입하기</Link>
        </Button>
      </nav>
    );
  }
  return (
    <nav className="flex items-center gap-1 text-sm" data-testid="account-nav">
      {member.roles.includes("admin") && (
        <Link href="/admin" className="px-3 py-2 text-muted-foreground hover:text-foreground">
          관리자
        </Link>
      )}
      {member.roles.includes("host") && (
        <Link href="/host" className="px-3 py-2 text-muted-foreground hover:text-foreground">
          호스트
        </Link>
      )}
      <Link href="/me" className="px-3 py-2 font-medium" data-testid="nav-nickname">
        {member.nickname}
      </Link>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="sm">
          로그아웃
        </Button>
      </form>
    </nav>
  );
}

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-8">
      <Link href="/" className="font-display text-xl font-bold tracking-tight">
        {displayName()}
      </Link>
      <Suspense fallback={<div className="h-9" />}>
        <AccountNav />
      </Suspense>
    </header>
  );
}
