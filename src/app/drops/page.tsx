import type { Metadata } from "next";
import Link from "next/link";

import { Night } from "@/components/layout/night";
import { collectDrops, DropList, type DropItem } from "@/components/meetups/drop-list";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentMember } from "@/lib/auth/session";
import { listMyFollowedHosts } from "@/lib/hosting/follows";
import { isNotYetOpen, kstDateKey, kstDayShort, kstDaysFromToday } from "@/lib/meetups/drops";
import { listMyOpenAlerts } from "@/lib/meetups/open-alerts";
import { listUpcomingMeetups } from "@/lib/meetups/queries";

export const metadata: Metadata = { title: "곧 열리는 원" };
export const instant = false;

const DAYS = 7;

/** 정해진 시각에 열리는 원 — 앞으로 7일, 날짜별로 묶고 팔로우한 크리에이터를 먼저. 열림 시각·정원은 모두 실제 값 */
export default async function DropsPage() {
  const member = await getCurrentMember().catch(() => null);
  const loggedIn = Boolean(member && member.status === "active");
  const [meetups, myAlerts, followed] = await Promise.all([
    listUpcomingMeetups(),
    loggedIn ? listMyOpenAlerts() : Promise.resolve([]),
    member ? listMyFollowedHosts(member.id).catch(() => []) : Promise.resolve([]),
  ]);
  const followedIds = new Set(followed.map((f) => f.host.user_id));
  const alertOn = new Set(myAlerts.map((a) => a.session_id));
  const all = collectDrops(meetups, isNotYetOpen);
  const week = all.filter((d) => kstDaysFromToday(d.session.opens_at as string) < DAYS);
  const later = all.length - week.length;

  // 날짜별 묶음 (열림 시각 순, 같은 시각이면 팔로우한 크리에이터 먼저)
  const byDay = new Map<string, DropItem[]>();
  for (const d of week) {
    const k = kstDateKey(d.session.opens_at as string);
    byDay.set(k, [...(byDay.get(k) ?? []), d]);
  }
  for (const [k, list] of byDay) {
    byDay.set(
      k,
      [...list].sort(
        (a, b) =>
          (a.session.opens_at as string).localeCompare(b.session.opens_at as string) ||
          Number(followedIds.has(b.meetup.host?.user_id ?? "")) - Number(followedIds.has(a.meetup.host?.user_id ?? "")),
      ),
    );
  }
  const days = [...byDay.entries()];

  return (
    <Night>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-8 pb-10 sm:px-6 sm:pt-12">
        <h1 className="font-display text-[32px] leading-tight font-bold tracking-[-0.02em] sm:text-[44px]">곧 열리는 원</h1>
        <p className="mt-2 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
          크리에이터가 정한 시각에 열리는 원이에요. 열리기 전에는 신청할 수 없고, 알림을 켜 두면 열리기 1시간 전과 열리는 순간에 알려 드려요.
        </p>

        {days.length > 0 ? (
          <>
            <nav aria-label="날짜" className="mt-6 grid grid-cols-7 gap-1.5" data-testid="drop-days">
              {Array.from({ length: DAYS }, (_, i) => {
                const entry = days.find(([, list]) => kstDaysFromToday(list[0].session.opens_at as string) === i);
                const ref = entry?.[1][0].session.opens_at ?? new Date(new Date().getTime() + i * 86_400_000).toISOString();
                const { day, wd } = kstDayShort(ref);
                const key = entry?.[0];
                const cls = "flex flex-col items-center rounded-2xl border px-1 py-2.5 text-center " + (key ? "border-border bg-card" : "border-border/50 text-muted-foreground");
                const inner = (
                  <>
                    <span className="text-[13px] text-muted-foreground">{wd}</span>
                    <b className="font-num text-[19px] font-semibold">{day}</b>
                    <span className="mt-0.5 h-4 text-[12.5px] font-bold text-gold">{entry ? `${entry[1].length}개` : ""}</span>
                  </>
                );
                return key ? (
                  <a key={i} href={`#day-${key}`} className={cls}>{inner}</a>
                ) : (
                  <span key={i} className={cls}>{inner}</span>
                );
              })}
            </nav>

            <div className="mt-8 flex flex-col gap-9">
              {days.map(([key, list], idx) => (
                <section key={key} id={`day-${key}`} aria-labelledby={`h-${key}`} className="scroll-mt-24" data-testid="drop-day">
                  <h2 id={`h-${key}`} className="mb-3 font-display text-[22px] font-bold tracking-[-0.02em]">
                    {(() => {
                      const d = kstDaysFromToday(list[0].session.opens_at as string);
                      const s = kstDayShort(list[0].session.opens_at as string);
                      return `${d === 0 ? "오늘" : d === 1 ? "내일" : `${s.day}일 (${s.wd})`} · 원 ${list.length}개`;
                    })()}
                  </h2>
                  <DropList items={list} alertOn={alertOn} loggedIn={loggedIn} followedIds={followedIds} withCountdown={idx === 0} />
                </section>
              ))}
            </div>
            {later > 0 && <p className="mt-8 text-[15px] text-muted-foreground">이후에 열리는 원이 {later}개 더 있어요.</p>}
          </>
        ) : (
          <div className="mt-8 rounded-[24px] border border-dashed border-border px-6 py-14 text-center" data-testid="drops-empty">
            <p className="font-display text-[22px] font-bold">아직 예정된 원이 없어요</p>
            <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
              크리에이터가 열림 시각을 정하면 이곳에 나타나요. 지금 바로 신청할 수 있는 원은 &lsquo;둘러보기&rsquo;에서 볼 수 있어요.
            </p>
            <Link href="/meetups" className="mt-5 inline-flex h-12 items-center rounded-xl bg-primary px-6 text-[15px] font-bold text-primary-foreground hover:bg-primary/90">
              지금 열린 원 둘러보기
            </Link>
          </div>
        )}
        {loggedIn && myAlerts.length > 0 && (
          <section className="mt-12" data-testid="my-open-alerts">
            <h2 className="mb-3 font-display text-[22px] font-bold tracking-[-0.02em]">내가 알림을 켠 원</h2>
            <ul className="flex flex-col gap-2 text-[15px]">
              {myAlerts.map((a) => (
                <li key={a.session_id}>
                  <Link href={`/meetups/${a.meetup_id}`} className="flex flex-wrap justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 hover:border-gold/60">
                    <span className="font-semibold">{a.title}</span>
                    <span className="text-muted-foreground">{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(a.opens_at))} 오픈</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </Night>
  );
}
