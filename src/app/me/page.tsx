import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { requireMember } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

import { Photo } from "@/components/media/photo";
import { RecentlyViewedList } from "@/components/recently-viewed";
import { pillarInfo } from "@/config/pillars";
import { APPLICATION_STATUS_LABEL, getMyApplication } from "@/lib/hosting/applications";
import { hostAvatarUrl, hostHref } from "@/lib/hosting/avatar";
import { listMyFollowedHosts } from "@/lib/hosting/follows";
import { formatShortDateTime } from "@/lib/format";

import { PrivateForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "마이페이지" };

// 권한 확인이 끝나기 전에는 응답을 시작하지 않음 → 권한 없으면 HTTP 403
export const instant = false;

const ROLE_LABEL = { participant: "참가자", host: "호스트", admin: "관리자" } as const;

async function MyPage({ member }: { member: Awaited<ReturnType<typeof requireMember>> }) {
  const supabase = await createSupabaseServerClient();
  const isHost = member.roles.includes("host");
  const [{ data: profile }, { data: priv }, followed, application, { data: recent }] = await Promise.all([
    supabase.from("profiles").select("nickname, bio, status, created_at").eq("id", member.id).single(),
    supabase.from("profile_private").select("phone, birth_year").eq("user_id", member.id).single(),
    listMyFollowedHosts(member.id),
    isHost ? Promise.resolve(null) : getMyApplication(member.id),
    supabase
      .from("notifications")
      .select("id, title, link, read_at, created_at")
      .eq("user_id", member.id)
      .order("created_at", { ascending: false })
      .limit(5),
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
        {isHost ? (
          <Button asChild variant="outline" size="sm"><Link href="/host">호스트 공간</Link></Button>
        ) : (
          <Button asChild variant="outline" size="sm"><Link href="/become-a-host/apply">호스트 신청</Link></Button>
        )}
        {member.roles.includes("admin") && <Button asChild variant="outline" size="sm"><Link href="/admin">관리자</Link></Button>}
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">로그아웃</Button>
        </form>
      </nav>

      {application && (
        <section className="border p-5" data-testid="me-application" data-status={application.status}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">호스트 지원</h2>
            <span className="text-sm font-semibold">{APPLICATION_STATUS_LABEL[application.status]}</span>
          </div>
          {application.status === "revision_requested" && (
            <p className="mt-3 text-sm text-muted-foreground">운영팀이 보완을 요청했어요. 내용을 고쳐 다시 제출해 주세요.</p>
          )}
          <Link href="/become-a-host/apply" className="mt-4 inline-block text-sm underline underline-offset-4">지원서 보기</Link>
        </section>
      )}

      <section className="flex flex-col gap-5" data-testid="me-following">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">팔로우한 호스트</h2>
          <span className="text-sm text-muted-foreground">{followed.length}명</span>
        </div>
        {followed.length === 0 ? (
          <div className="border border-dashed px-5 py-8 text-sm text-muted-foreground">
            <p>아직 팔로우한 호스트가 없어요. 마음에 드는 호스트를 팔로우하면 새 프로그램을 여기서 바로 볼 수 있어요.</p>
            <Link href="/hosts" className="mt-3 inline-block text-foreground underline underline-offset-4">호스트 둘러보기</Link>
          </div>
        ) : (
          <ul className="flex flex-col divide-y border-y">
            {followed.map(({ host, next }) => {
              const avatar = hostAvatarUrl(host.avatar_path);
              const pillar = pillarInfo(host.primary_pillar);
              return (
                <li key={host.user_id} className="flex gap-4 py-4" data-testid="followed-host" data-name={host.display_name}>
                  <Link href={hostHref(host)} className="relative size-16 shrink-0 overflow-hidden bg-espresso text-sand-light">
                    <Photo src={avatar} alt={`${host.display_name} 프로필 사진`} sizes="64px"
                      fallback={<span className="absolute inset-0 flex items-center justify-center font-display text-2xl">{host.display_name.slice(0, 1)}</span>} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={hostHref(host)} className="font-medium hover:underline">{host.display_name}</Link>
                    <p className="truncate text-xs text-muted-foreground">{[pillar?.label, host.occupation].filter(Boolean).join(" · ")}</p>
                    {next ? (
                      <Link href={`/meetups/${next.id}`} className="mt-2 block text-sm" data-testid="followed-next">
                        <span className="text-muted-foreground">다음 프로그램 · {formatShortDateTime(next.nextSession.starts_at)}</span>
                        <span className="block truncate font-medium underline-offset-4 hover:underline">{next.title}</span>
                      </Link>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">지금 모집 중인 프로그램이 없어요.</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <RecentlyViewedList />

      <section className="flex flex-col gap-4" data-testid="me-activity">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">최근 활동</h2>
          <Link href="/me/notifications" className="text-sm underline underline-offset-4">전체 알림</Link>
        </div>
        {!recent || recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 활동 기록이 없어요.</p>
        ) : (
          <ul className="flex flex-col divide-y border-y text-sm">
            {recent.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-4 py-3">
                {n.link ? <Link href={n.link} className="min-w-0 truncate hover:underline">{n.title}</Link> : <span className="min-w-0 truncate">{n.title}</span>}
                <span className="shrink-0 text-xs text-muted-foreground">{formatShortDateTime(n.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-6 border-t pt-10">
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
