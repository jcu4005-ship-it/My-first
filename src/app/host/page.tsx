import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusPill } from "@/components/forms/controls";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { requireActiveMember } from "@/lib/auth/guards";
import { formatShortDateTime, isFuture } from "@/lib/format";
import { MEETUP_STATUS_LABEL, getMyHostProfile, listMyMeetups } from "@/lib/hosting/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hostHref } from "@/lib/hosting/avatar";

/** 앞으로 7일 안의 (취소되지 않은) 일정, 날짜순 */
function upcomingWeek(meetups: Awaited<ReturnType<typeof listMyMeetups>>) {
  const now = new Date();
  const until = new Date(now.getTime() + 7 * 86400000);
  return meetups
    .flatMap((m) =>
      m.sessions
        .filter((s) => s.status !== "cancelled" && new Date(s.starts_at) > now && new Date(s.starts_at) <= until)
        .map((s) => ({ sessionId: s.id, meetupId: m.id, title: m.title, startsAt: s.starts_at, reserved: s.reserved_count, capacity: s.capacity })),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

type HostStats = {
  programs_published: number;
  upcoming_sessions: number;
  total_participants: number;
  attended_participants: number;
  review_count: number;
  avg_rating: number | string | null;
  followers: number;
};

export const metadata: Metadata = { title: "호스트" };
export const instant = false;

export default async function HostDashboard() {
  const member = await requireActiveMember("/host");
  const host = await getMyHostProfile(member.id);
  if (!host || host.status !== "approved" || !member.roles.includes("host")) redirect("/become-a-host/apply");
  const supabase = await createSupabaseServerClient();
  const [meetups, statsRes, savesRes] = await Promise.all([listMyMeetups(member.id), supabase.rpc("host_my_stats"), supabase.rpc("host_meetup_save_counts")]);
  const saves = Object.fromEntries(((savesRes.data as { meetup_id: string; saves: number }[] | null) ?? []).map((r) => [r.meetup_id, r.saves]));
  const st = (statsRes.data as HostStats[] | null)?.[0];
  const week = upcomingWeek(meetups);
  const checklist = [
    { label: "프로필 사진", done: Boolean(host.avatar_path), href: "/host/profile" },
    { label: "나를 소개하는 한 줄", done: Boolean(host.occupation?.trim()), href: "/host/profile" },
    { label: "모임에서 중요하게 여기는 것 (메인 인용문에 쓰여요)", done: Boolean(host.philosophy?.trim()), href: "/host/profile" },
    { label: "소개", done: Boolean(host.bio?.trim()), href: "/host/profile" },
    { label: "첫 프로그램 공개", done: meetups.some((m) => m.status === "published"), href: "/host/meetups/new" },
  ];
  const stats = [
    { label: "공개 중인 프로그램", value: st?.programs_published ?? 0 },
    { label: "다가오는 일정", value: st?.upcoming_sessions ?? 0 },
    { label: "지금까지 만난 참가자", value: st?.total_participants ?? 0 },
    { label: "팔로워", value: st?.followers ?? 0 },
    { label: "평균 별점", value: st?.avg_rating != null ? Number(st.avg_rating).toFixed(1) : "–", sub: `후기 ${st?.review_count ?? 0}개`, href: "/host/reviews" },
  ];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8" data-testid="host-home">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.25em] text-brand">HOST</p>
            <h1 className="mt-1 font-display text-3xl font-bold">{host.display_name}</h1>
            <span className="mt-1 flex gap-4 text-sm">
              <Link href={hostHref(host)} className="text-muted-foreground underline underline-offset-4">공개 프로필 보기</Link>
              <Link href="/host/profile" className="underline underline-offset-4" data-testid="edit-profile-link">프로필 관리</Link>
              <Link href="/host/contents" className="underline underline-offset-4" data-testid="host-contents-link">내 콘텐츠</Link>
              <Link href="/host/reviews" className="underline underline-offset-4" data-testid="host-reviews-link">받은 후기</Link>
              <Link href="/host/settlements" className="underline underline-offset-4" data-testid="host-settlements-link">정산</Link>
            </span>
          </div>
          <Button asChild>
            <Link href="/host/meetups/new">새 프로그램 만들기</Link>
          </Button>
        </div>

        {checklist.some((c) => !c.done) && (
          <section className="mt-8 rounded-2xl border border-dashed p-5" data-testid="profile-checklist">
            <p className="font-semibold">프로필을 채우면 참가자에게 더 잘 보여요 <span className="text-muted-foreground">({checklist.filter((c) => c.done).length}/{checklist.length})</span></p>
            <p className="mt-1 text-sm text-muted-foreground">사진과 내가 중요하게 여기는 것이 있으면 메인 &lsquo;이번 호의 사람들&rsquo;과 공유 카드에 그대로 쓰여요.</p>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-center gap-2" data-testid="checklist-item" data-done={c.done ? "true" : "false"}>
                  <span aria-hidden className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${c.done ? "bg-forest text-white" : "border border-border"}`}>{c.done ? "✓" : ""}</span>
                  <span className={c.done ? "text-muted-foreground line-through" : ""}>{c.label}</span>
                  {!c.done && <Link href={c.href} className="text-xs underline underline-offset-4">채우기</Link>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <ul className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-5" data-testid="host-stats">
          {stats.map((x) => {
            const inner = (
              <>
                <p className="text-xs text-muted-foreground">{x.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{x.value}</p>
                {x.sub && <p className="text-[11px] text-muted-foreground">{x.sub}</p>}
              </>
            );
            return (
              <li key={x.label} className="rounded-xl border bg-card">
                {x.href ? <Link href={x.href} className="block p-4 hover:bg-linen/40">{inner}</Link> : <div className="p-4">{inner}</div>}
              </li>
            );
          })}
        </ul>

        {/* 앞으로 7일: 모든 프로그램의 일정을 날짜순으로 한눈에 */}
        <section className="mt-10" data-testid="host-week">
          <h2 className="mb-3 text-lg font-semibold">앞으로 7일</h2>
          {week.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">7일 안에 열리는 일정이 없어요.</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {week.map((w) => (
                <li key={w.sessionId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" data-testid="host-week-row">
                  <Link href={`/host/meetups/${w.meetupId}`} className="min-w-0">
                    <span className="block text-sm font-semibold">{formatShortDateTime(w.startsAt)}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">{w.title}</span>
                  </Link>
                  <span className="flex items-center gap-3 text-sm">
                    <b className="tabular-nums">{w.reserved}/{w.capacity}명</b>
                    <Link href={`/host/meetups/${w.meetupId}/roster?session=${w.sessionId}`} className="text-[13px] underline underline-offset-4" data-testid="roster-link">
                      출석부
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <h2 className="mt-10 mb-4 text-lg font-semibold">내 프로그램</h2>
        {meetups.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center">
            <p className="font-semibold">아직 만든 프로그램이 없어요</p>
            <p className="mt-2 text-sm text-muted-foreground">프로그램을 만들고 일정을 추가한 뒤 검수를 요청하면, 승인 후 공개돼요.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {meetups.map((m) => {
              const upcoming = m.sessions.filter((s) => s.status !== "cancelled" && isFuture(s.starts_at))
                .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
              const reserved = upcoming.reduce((n, s) => n + s.reserved_count, 0);
              const capacity = upcoming.reduce((n, s) => n + s.capacity, 0);
              return (
                <li key={m.id}>
                  <Link href={`/host/meetups/${m.id}`} className="flex flex-col gap-2 rounded-2xl border p-5 transition-colors hover:border-foreground" data-testid="host-meetup-row">
                    <div className="flex items-center gap-2">
                      <StatusPill tone={m.status === "published" ? "ok" : m.status === "rejected" ? "accent" : m.status === "pending_review" ? "warn" : "muted"}>
                        {MEETUP_STATUS_LABEL[m.status]}
                      </StatusPill>
                    </div>
                    <p className="font-semibold">{m.title}</p>
                    {(saves[m.id] ?? 0) > 0 && (
                      <p className="text-xs text-muted-foreground" data-testid="meetup-saves">저장한 사람 {saves[m.id]}명 · 새 일정을 열면 관심 있는 분들이 찾아와요</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {upcoming.length ? `다음 일정 ${formatShortDateTime(upcoming[0].starts_at)} · 예정 ${upcoming.length}회 · 신청 ${reserved}/${capacity}명` : "예정된 일정 없음"}
                    </p>
                    {m.status === "published" && upcoming.length === 0 && (
                      <p className="rounded-lg bg-notice px-3 py-1.5 text-xs text-notice-foreground" data-testid="no-upcoming-warning">
                        공개 중이지만 다가오는 일정이 없어서 프로그램 목록에 보이지 않아요. 일정을 추가해 주세요.
                      </p>
                    )}
                    {m.status === "draft" && (
                      <p className="text-xs text-muted-foreground">아직 공개 전이에요. 일정을 추가하고 검수를 요청하면 운영팀 승인 후 공개돼요.</p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
