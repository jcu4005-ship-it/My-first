import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusPill } from "@/components/forms/controls";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { requireActiveMember } from "@/lib/auth/guards";
import { formatShortDateTime, isFuture } from "@/lib/format";
import { MEETUP_STATUS_LABEL, getMyHostProfile, listMyMeetups } from "@/lib/hosting/queries";
import { hostHref } from "@/lib/hosting/avatar";

export const metadata: Metadata = { title: "호스트" };
export const instant = false;

export default async function HostDashboard() {
  const member = await requireActiveMember("/host");
  const host = await getMyHostProfile(member.id);
  if (!host || host.status !== "approved" || !member.roles.includes("host")) redirect("/become-a-host/apply");
  const meetups = await listMyMeetups(member.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8" data-testid="host-home">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.25em] text-accent">HOST</p>
            <h1 className="mt-1 font-display text-3xl font-bold">{host.display_name}</h1>
            <span className="mt-1 flex gap-4 text-sm">
              <Link href={hostHref(host)} className="text-muted-foreground underline underline-offset-4">공개 프로필 보기</Link>
              <Link href="/host/profile" className="underline underline-offset-4" data-testid="edit-profile-link">프로필 관리</Link>
            </span>
          </div>
          <Button asChild>
            <Link href="/host/meetups/new">새 프로그램 만들기</Link>
          </Button>
        </div>

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
                    <p className="text-sm text-muted-foreground">
                      {upcoming.length ? `다음 일정 ${formatShortDateTime(upcoming[0].starts_at)} · 예정 ${upcoming.length}회 · 신청 ${reserved}/${capacity}명` : "예정된 일정 없음"}
                    </p>
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
