import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SeatCircle, SeatLegend } from "@/components/brand/seat-circle";
import { HostCard } from "@/components/hosts/host-card";
import { Dusk } from "@/components/layout/dusk";
import { SampleBadge, seatsLeft } from "@/components/meetups/badges";
import { CircleGrid, seatLine } from "@/components/meetups/circle-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentMember } from "@/lib/auth/session";
import { formatPrice, ticketDate } from "@/lib/format";
import { creatorPhoto, hostHref } from "@/lib/hosting/avatar";
import { listMyFollowedHosts } from "@/lib/hosting/follows";
import { listCategories, listFeaturedHosts, listUpcomingMeetups, type MeetupCardData } from "@/lib/meetups/queries";

/*
 * 홈 = "모닥불 원" (드롭 × 모닥불 원, 2026-11-20 대표 승인)
 * 첫 화면: 가운데 크리에이터 얼굴, 둘러앉은 의자(먼저 앉은 사람 = 불빛), 혼자 빛나는 빈 의자 하나 = 당신 자리.
 * 숫자는 실제 예약 수만. 열림 시각(드롭)은 3단계에서 — 지금은 이미 열린 원만 보여 줌.
 * 예전 잡지형 메인은 /about(라운디 이야기)으로 옮김.
 */
export const instant = false;

const open = (m: MeetupCardData) => m.nextSession.status === "open" && seatsLeft(m.nextSession) > 0;
/** 많이 찬 순(소속의 신호), 같으면 가까운 일정 */
const byFill = (a: MeetupCardData, b: MeetupCardData) =>
  b.nextSession.reserved_count / b.nextSession.capacity - a.nextSession.reserved_count / a.nextSession.capacity ||
  a.nextSession.starts_at.localeCompare(b.nextSession.starts_at);

export default async function Home() {
  const member = await getCurrentMember().catch(() => null);
  const [all, categories, featured, followed] = await Promise.all([
    listUpcomingMeetups(),
    listCategories(),
    listFeaturedHosts(6),
    member ? listMyFollowedHosts(member.id).catch(() => []) : Promise.resolve([]),
  ]);
  const followedIds = new Set(followed.map((f) => f.host.user_id));
  const openOnes = all.filter(open);
  // 첫 화면 원: 팔로우한 크리에이터의 열린 원 → 신청할 수 있는(샘플 아닌) 원 중 많이 찬 것 → 샘플이라도
  const hero =
    openOnes.find((m) => !m.is_sample && m.host && followedIds.has(m.host.user_id)) ??
    [...openOnes].filter((m) => !m.is_sample).sort(byFill)[0] ??
    [...openOnes].sort(byFill)[0] ??
    null;
  const fromFollowed = Boolean(hero?.host && followedIds.has(hero.host.user_id));
  const rest = [...openOnes].filter((m) => m.id !== hero?.id).sort(byFill).slice(0, 6);
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const repOf = (hostId: string) => all.find((m) => m.host?.user_id === hostId) ?? null;

  const s = hero?.nextSession;
  const d = s ? ticketDate(s.starts_at) : null;
  const line = s ? seatLine(s) : null;
  const face = hero ? (hero.host && creatorPhoto(hero.host)) || hero.cover_image_url : null;

  return (
    <Dusk>
      <SiteHeader />
      <main className="flex-1">
        {/* 1. 첫 화면: 원 하나 */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-6 px-4 pt-6 pb-4 sm:px-6 lg:grid-cols-[1fr_460px] lg:gap-12 lg:pt-14" data-testid="home-circle">
          <div className="lg:order-1">
            {fromFollowed && hero?.host && <p className="text-[14px] text-muted-foreground">팔로우한 {hero.host.display_name}의 원</p>}
            <h1 className="mt-1 text-[38px] leading-[1.05] font-black tracking-[-0.05em] break-keep sm:text-[64px]">
              {hero ? (
                <>
                  당신 자리가
                  <br />
                  비어 있어요.
                </>
              ) : (
                <>
                  곧 첫 원이
                  <br />
                  열려요.
                </>
              )}
            </h1>
            {hero && s && d && (
              <div className="mt-4 hidden lg:block">
                <HeroText hero={hero} when={`${d.md} (${d.wd}) ${d.time} · ${s.area}`} line={line?.text ?? ""} />
              </div>
            )}
            {!hero && (
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                한 사람을 중심으로 4~10명이 둘러앉는 자리. 크리에이터를 팔로우하면 새 원이 열릴 때 알려 드려요.
              </p>
            )}
          </div>
          {hero && s && (
            <div className="flex flex-col items-center lg:order-2">
              <div className="w-[min(78vw,330px)] lg:w-[420px]">
                <SeatCircle
                  capacity={s.capacity}
                  taken={s.reserved_count}
                  you={hero.is_sample ? false : "open"}
                  face={face}
                  initial={hero.host?.display_name.slice(0, 1)}
                  label={hero.is_sample ? undefined : "당신 자리"}
                />
              </div>
              <SeatLegend className="mt-3" />
            </div>
          )}
          {hero && s && d && (
            <div className="text-center lg:hidden">
              <HeroText hero={hero} when={`${d.md} (${d.wd}) ${d.time} · ${s.area}`} line={line?.text ?? ""} />
            </div>
          )}
        </section>

        {/* 2. 지금 열린 원 */}
        <section className="mx-auto mt-10 w-full max-w-6xl px-4 sm:mt-14 sm:px-6" data-testid="home-open">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="text-[24px] font-black tracking-[-0.035em] sm:text-[30px]">지금 열린 원</h2>
            <Link href="/meetups" className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
              {openOnes.length}개 · 전체 보기
              <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.8} />
            </Link>
          </div>
          {rest.length ? (
            <CircleGrid meetups={rest} categoryNames={names} />
          ) : (
            <p className="rounded-[20px] border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">다른 열린 원이 아직 없어요.</p>
          )}
        </section>

        {/* 3. 크리에이터 */}
        {featured.length > 0 && (
          <section className="mx-auto mt-14 w-full max-w-6xl px-4 sm:px-6" data-testid="home-creators">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 className="text-[24px] font-black tracking-[-0.035em] sm:text-[30px]">원을 여는 사람들</h2>
              <Link href="/hosts" className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
                전체 보기
                <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.8} />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-6">
              {featured.map((h) => (
                <HostCard key={h.user_id} host={h} representative={repOf(h.user_id)} />
              ))}
            </div>
          </section>
        )}

        {/* 4. 라운디 이야기 */}
        <section className="mx-auto mt-14 w-full max-w-6xl px-4 sm:px-6">
          <Link href="/about" className="group flex items-center justify-between gap-4 rounded-[24px] border border-border bg-card p-5 hover:border-amber/50 sm:p-7" data-testid="home-about">
            <span>
              <b className="block text-[18px] tracking-[-0.02em] sm:text-[22px]">라운디 이야기</b>
              <span className="mt-1 block text-[13.5px] text-muted-foreground">왜 4~10명인지, 어떻게 크리에이터를 고르는지</span>
            </span>
            <ArrowRight aria-hidden className="size-5 shrink-0 transition-transform group-hover:translate-x-1" strokeWidth={1.8} />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </Dusk>
  );
}

function HeroText({ hero, when, line }: { hero: MeetupCardData; when: string; line: string }) {
  return (
    <>
      <p className="flex flex-wrap items-center justify-center gap-2 text-[19px] font-extrabold tracking-[-0.03em] lg:justify-start lg:text-[22px]">
        {hero.title}
        {hero.is_sample && <SampleBadge />}
      </p>
      <p className="mt-1 text-[13.5px] text-muted-foreground lg:text-[15px]">
        {hero.host && (
          <Link href={hostHref(hero.host)} className="hover:underline hover:underline-offset-4">
            {hero.host.display_name}
          </Link>
        )}
        {hero.host?.occupation && ` · ${hero.host.occupation}`} · {when} · <span className="font-num">{formatPrice(hero.price)}</span>
      </p>
      <p className="mt-2 text-[15px] font-bold text-amber" data-testid="home-seat-line">
        {line}
      </p>
      <Link
        href={`/meetups/${hero.id}#booking`}
        className="mt-5 inline-flex h-14 w-full items-center justify-center rounded-full bg-primary px-8 text-[16px] font-black text-primary-foreground shadow-[0_12px_34px_-12px_rgb(255_106_43/0.8)] hover:bg-primary/90 sm:w-auto"
        data-testid="home-cta"
      >
        {hero.is_sample ? "자세히 보기" : "이 자리에 앉기"}
      </Link>
    </>
  );
}
