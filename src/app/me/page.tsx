import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { requireMember } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

import { PrivateForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "마이페이지" };

// 권한 확인이 끝나기 전에는 응답을 시작하지 않음 → 권한 없으면 HTTP 403
export const instant = false;

const ROLE_LABEL = { participant: "참가자", host: "호스트", admin: "관리자" } as const;

async function MyPage({ member }: { member: Awaited<ReturnType<typeof requireMember>> }) {
  const supabase = await createSupabaseServerClient();
  const [{ data: profile }, { data: priv }] = await Promise.all([
    supabase.from("profiles").select("nickname, bio, status, created_at").eq("id", member.id).single(),
    supabase.from("profile_private").select("phone, birth_year").eq("user_id", member.id).single(),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <div>
        <h1 className="font-display text-3xl font-bold" data-testid="me-nickname">
          {profile?.nickname}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {member.email} · {member.roles.map((r) => ROLE_LABEL[r]).join(", ")}
        </p>
        {member.status !== "active" && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            이용이 제한된 계정입니다. 운영팀에 문의해 주세요.
          </p>
        )}
      </div>

      <nav className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link href="/me/bookings">신청 내역</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/me/notifications">알림</Link></Button>
        {member.roles.includes("host") ? (
          <Button asChild variant="outline" size="sm"><Link href="/host">호스트 공간</Link></Button>
        ) : (
          <Button asChild variant="outline" size="sm"><Link href="/become-a-host/apply">호스트 신청</Link></Button>
        )}
        {member.roles.includes("admin") && <Button asChild variant="outline" size="sm"><Link href="/admin">관리자</Link></Button>}
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">로그아웃</Button>
        </form>
      </nav>

      <section className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold">공개 프로필</h2>
        <ProfileForm nickname={profile?.nickname ?? ""} bio={profile?.bio ?? null} />
      </section>

      <section className="flex flex-col gap-6 border-t pt-10">
        <div>
          <h2 className="text-lg font-semibold">비공개 정보</h2>
          <p className="mt-1 text-sm text-muted-foreground">본인만 볼 수 있으며 호스트에게 공개되지 않습니다.</p>
        </div>
        <PrivateForm phone={priv?.phone ?? null} birthYear={priv?.birth_year ?? null} />
      </section>

      <section className="border-t pt-10 text-sm text-muted-foreground">
        <h2 className="text-lg font-semibold text-foreground">회원 탈퇴</h2>
        <p className="mt-2">탈퇴하면 개인정보가 삭제되고 예정된 신청이 취소됩니다.</p>
        <Link href="/me/withdraw" className="mt-3 inline-block underline underline-offset-4">회원 탈퇴하기</Link>
      </section>
    </div>
  );
}

export default async function Page() {
  const member = await requireMember("/me");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-8">
        <MyPage member={member} />
      </main>
    </>
  );
}
