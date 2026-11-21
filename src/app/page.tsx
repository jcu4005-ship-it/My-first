import Link from "next/link";
import { ArrowRight, CalendarDays, Check, MapPin } from "lucide-react";

import { SeatCircle } from "@/components/brand/seat-circle";
import { HostCard } from "@/components/hosts/host-card";
import { Blue } from "@/components/layout/blue";
import { SampleBadge, seatsLeft } from "@/components/meetups/badges";
import { CircleGrid, hostVerified, seatLine } from "@/components/meetups/circle-card";
import { collectDrops, DropList } from "@/components/meetups/drop-list";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HomeProofs, VerifiedChip } from "@/components/trust/proofs";
import { getCurrentMember } from "@/lib/auth/session";
import { formatPrice, ticketDate } from "@/lib/format";
import { creatorPhoto, hostHref } from "@/lib/hosting/avatar";
import { listMyFollowedHosts } from "@/lib/hosting/follows";
import { isNotYetOpen } from "@/lib/meetups/drops";
import { listMyOpenAlerts } from "@/lib/meetups/open-alerts";
import { getHost, listCategories, listFeaturedHosts, listUpcomingMeetups, type MeetupCardData } from "@/lib/meetups/queries";
import { REFUND_RULES, refundNowLine } from "@/lib/payments/refund-policy";
import { getHostReviewSummaries } from "@/lib/reviews/queries";

/*
 * 홈 (드롭 × 모닥불 원 · 블루 디자인 시스템, 2026-11-21)
 * 1. 처음 온 사람이 바로 이해: 무엇을 하는 곳인지 + 믿을 이유(심사·소규모·결제/환불)
 * 2. 시그니처 원(콘텐츠보다 작게) + 크리에이터 이름·분야를 크게
 * 3. 지금 열린 원 · 크리에이터 · 운영 방식(아이보리)
 * 숫자·후기는 실제 데이터만. 예전 잡지형 메인은 /about.
 */
export const instant = false;

// 지금 신청할 수 있는 원: 모집 중 + 자리 있음 + 열림 시각이 지났거나 없음
const open = (m: MeetupCardData) => m.nextSession.status === "open" && seatsLeft(m.nextSession) > 0 && !isNotYetOpen(m.nextSession);
/** 많이 찬 순, 같으면 가까운 일정 */
const byFill = (a: MeetupCardData, b: MeetupCardData) =>
  b.nextSession.reserved_count / b.nextSession.capacity - a.nextSession.reserved_count / a.nextSession.capacity ||
  a.nextSession.starts_at.localeCompare(b.nextSession.starts_at);

export default async function Home() {
  const member = await getCurrentMember().catch(() => null);
  const [all, categories, featured, followed, myAlerts] = await Promise.all([
    listUpcomingMeetups(),
    listCategories(),
    listFeaturedHosts(6),
    member ? listMyFollowedHosts(member.id).catch(() => []) : Promise.resolve([]),
    member && member.status === "active" ? listMyOpenAlerts() : Promise.resolve([]),
  ]);
  const loggedIn = Boolean(member && member.status === "active");
  const alertOn = new Set(myAlerts.map((a) => a.session_id));
  // 곧 열리는 원 (열림 시각이 정해진 회차, 가까운 순 3개 — 팔로우한 크리에이터 것이 있으면 먼저)
  const drops = collectDrops(all, isNotYetOpen);
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
  const homeDrops = [...drops]
    .sort((a, b) => Number(followedIds.has(b.meetup.host?.user_id ?? "")) - Number(followedIds.has(a.meetup.host?.user_id ?? "")) || (a.session.opens_at as string).localeCompare(b.session.opens_at as string))
    .slice(0, 3)
    .sort((a, b) => (a.session.opens_at as string).localeCompare(b.session.opens_at as string));
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const repOf = (hostId: string) => all.find((m) => m.host?.user_id === hostId) ?? null;
  const [heroHost, trust] = await Promise.all([
    hero?.host ? getHost(hero.host.user_id).catch(() => null) : Promise.resolve(null),
    getHostReviewSummaries([...rest, ...(hero ? [hero] : [])].flatMap((m) => (m.host ? [m.host.user_id] : []))),
  ]);

  const s = hero?.nextSession;
  const d = s ? ticketDate(s.starts_at) : null;
  const line = s ? seatLine(s) : null;
  const face = hero ? (hero.host && creatorPhoto(hero.host)) || hero.cover_image_url : null;
  const heroTrust = hero?.host ? trust[hero.host.user_id] : undefined;

  return (
    <Blue>
      <SiteHeader />
      <main className="flex-1">
        {/* 1. 브랜드 영역 (Deep Blue): 무엇을 하는 곳인지 */}
        <section className="on-deep" data-testid="home-intro">
          <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-24 sm:px-6 sm:pt-14 sm:pb-28">
            <h1 className="max-w-3xl font-display text-[29px] leading-[1.32] font-bold tracking-[-0.025em] break-keep sm:text-[46px]">
              한 사람을 만나러 가는
              <br />
              4~10명의 작은 자리
            </h1>
            <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
              운영팀이 확인한 크리에이터와 둘러앉아 직접 배워요. 결제와 환불은 라운디 안에서만 해요.
            </p>
          </div>
        </section>

        {/* 2. 크리에이터 얼굴 카드 (Deep Blue 영역 위로 겹침) + 시그니처 원 */}
        <section className="mx-auto -mt-16 w-full max-w-6xl px-4 sm:-mt-20 sm:px-6" data-testid="home-circle">
          <h2 className="sr-only">
            {hero ? (fromFollowed ? "팔로우한 크리에이터의 원에 자리가 있어요" : "당신 자리가 비어 있어요") : "곧 첫 원이 열려요"}
          </h2>
          {hero && s && d && line ? (
            <div className="grid overflow-hidden rounded-[24px] border border-border bg-card shadow-[0_18px_40px_-24px_rgb(16_29_56/0.45)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="relative min-h-[260px] bg-navy-2 md:min-h-[340px]">
                {face && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={face} alt={hero.host ? `${hero.host.display_name} 크리에이터 사진` : ""} className="absolute inset-0 size-full object-cover object-[50%_12%]" />
                )}
                {!face && (
                  <span aria-hidden className="absolute inset-0 flex items-center justify-center font-display text-[9rem] font-bold text-white/10">
                    {hero.host?.display_name.slice(0, 1)}
                  </span>
                )}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#101d38]/95 via-[#101d38]/45 to-transparent" />
                {hero.host && (
                  <Link href={hostHref(hero.host)} className="group absolute inset-x-4 bottom-4 flex items-end justify-between gap-2 text-white" data-testid="home-host">
                    <span className="flex flex-col">
                      <span className="font-display text-[30px] leading-tight font-bold tracking-[-0.02em] group-hover:underline group-hover:underline-offset-4 sm:text-[34px]">{hero.host.display_name}</span>
                      <span className="text-[15px] text-white/90">
                        {[heroHost?.occupation || hero.host.occupation, heroHost?.expertise?.slice(0, 2).join(" · ")].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {hostVerified(heroHost ?? hero.host) && <VerifiedChip />}
                  </Link>
                )}
              </div>
              <div className="min-w-0 p-5 sm:p-7">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[19px] leading-snug font-bold tracking-[-0.02em] sm:text-[21px]">
                      {hero.title}
                      {hero.is_sample && <SampleBadge />}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden className="size-4" strokeWidth={1.7} />{d.md} ({d.wd}) {d.time}</span>
                      <span className="inline-flex items-center gap-1.5"><MapPin aria-hidden className="size-4" strokeWidth={1.7} />{s.area}</span>
                    </p>
                  </div>
                  <div className="w-[72px] shrink-0 sm:w-[96px]">
                    <SeatCircle capacity={s.capacity} taken={s.reserved_count} you={hero.is_sample ? false : "open"} face={face} initial={hero.host?.display_name.slice(0, 1)} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <b className="font-num text-[19px]">{hero.price > 0 ? formatPrice(hero.price) : "무료"}</b>
                  <span className="rounded-full border border-gold bg-gold/25 px-3 py-1 text-[14px] font-bold text-forest" data-testid="home-seat-line">
                    {line.text}
                  </span>
                </div>
                {heroTrust && heroTrust.count > 0 && heroTrust.avg != null && (
                  <p className="mt-2 text-[14px] text-muted-foreground">★ {heroTrust.avg.toFixed(1)} · 이 크리에이터 후기 {heroTrust.count}개</p>
                )}
                {!line.closed && !line.notOpen && (
                  <p className="mt-3 flex items-start gap-2 border-t border-border pt-3 text-[14.5px] leading-snug" data-testid="home-refund-line">
                    <Check aria-hidden className="mt-0.5 size-4.5 shrink-0 text-forest" strokeWidth={2.6} />
                    <span><b>{refundNowLine(s.starts_at)}</b></span>
                  </p>
                )}
                <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                  <Link
                    href={`/meetups/${hero.id}#booking`}
                    className="inline-flex h-13 items-center justify-center rounded-xl bg-gold px-7 text-[16px] font-bold text-gold-ink hover:bg-gold/90"
                    data-testid="home-cta"
                  >
                    {hero.is_sample ? "자세히 보기" : "이 자리에 앉기"}
                  </Link>
                  {hero.host && (
                    <Link href={hostHref(hero.host)} className="inline-flex h-13 items-center justify-center rounded-xl border border-border px-6 text-[15px] font-semibold hover:border-foreground/50">
                      크리에이터 소개 보기
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="rounded-[20px] border border-border bg-card p-5 text-[15px] leading-relaxed text-muted-foreground">
              곧 첫 원이 열려요. 크리에이터를 팔로우하면 새 원이 열릴 때 알려 드려요.
            </p>
          )}
        </section>

        {/* 2-0. 신청하기 전에, 직접 확인하세요 (약속 옆에 증거) */}
        <section className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
          <h2 className="mb-4 font-display text-[24px] font-bold tracking-[-0.02em] sm:text-[30px]">신청하기 전에, 직접 확인하세요</h2>
          <HomeProofs startsAt={hero?.nextSession.starts_at ?? null} />
        </section>

        {/* 2-1. 곧 열리는 원 (열림 시각이 정해진 원이 있을 때만) */}
        {homeDrops.length > 0 && (
          <section className="mx-auto mt-14 w-full max-w-6xl px-4 sm:px-6" data-testid="home-drops">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 className="font-display text-[24px] font-bold tracking-[-0.02em] sm:text-[30px]">곧 열리는 원</h2>
              <Link href="/drops" className="flex shrink-0 items-center gap-1 text-[14px] font-semibold text-muted-foreground hover:text-foreground">
                {drops.length}개 · 전체 보기
                <ArrowRight aria-hidden className="size-4" strokeWidth={1.8} />
              </Link>
            </div>
            <DropList items={homeDrops} alertOn={alertOn} loggedIn={loggedIn} followedIds={followedIds} />
          </section>
        )}

        {/* 3. 지금 열린 원 */}
        <section className="mx-auto mt-14 w-full max-w-6xl px-4 sm:px-6" data-testid="home-open">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="font-display text-[24px] font-bold tracking-[-0.02em] sm:text-[30px]">지금 열린 원</h2>
            <Link href="/meetups" className="flex shrink-0 items-center gap-1 text-[14px] font-semibold text-muted-foreground hover:text-foreground">
              {openOnes.length}개 · 전체 보기
              <ArrowRight aria-hidden className="size-4" strokeWidth={1.8} />
            </Link>
          </div>
          {rest.length ? (
            <CircleGrid meetups={rest} categoryNames={names} trust={trust} />
          ) : (
            <p className="rounded-[20px] border border-dashed border-border px-5 py-8 text-center text-[15px] text-muted-foreground">다른 열린 원이 아직 없어요.</p>
          )}
        </section>

        {/* 4. 크리에이터 */}
        {featured.length > 0 && (
          <section className="mx-auto mt-14 w-full max-w-6xl px-4 sm:px-6" data-testid="home-creators">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 className="font-display text-[24px] font-bold tracking-[-0.02em] sm:text-[30px]">원을 여는 사람들</h2>
              <Link href="/hosts" className="flex shrink-0 items-center gap-1 text-[14px] font-semibold text-muted-foreground hover:text-foreground">
                전체 보기
                <ArrowRight aria-hidden className="size-4" strokeWidth={1.8} />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-6">
              {featured.map((h) => (
                <HostCard key={h.user_id} host={h} representative={repOf(h.user_id)} />
              ))}
            </div>
          </section>
        )}

        {/* 5. 운영 방식 (흰색 패널) */}
        <section className="mx-auto mt-16 w-full max-w-6xl px-4 sm:px-6" data-testid="home-how">
          <div className="sheet rounded-[26px] px-5 py-8 sm:px-10 sm:py-10">
            <h2 className="font-display text-[24px] font-bold tracking-[-0.02em] sm:text-[30px]">라운디는 이렇게 운영해요</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3 md:gap-8">
              <div>
                <b className="text-[17px]">1. 사람을 먼저 심사해요</b>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">경력과 작업, 기획안을 운영팀이 직접 확인한 크리에이터만 원을 열 수 있어요.</p>
              </div>
              <div>
                <b className="text-[17px]">2. 공개 전에 검수해요</b>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">모든 프로그램은 내용·가격·장소를 검수한 뒤 공개해요. 외부 결제 유도는 막아요.</p>
              </div>
              <div>
                <b className="text-[17px]">3. 같은 환불 기준</b>
                <ul className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                  {REFUND_RULES.map((r) => (
                    <li key={r.when}>
                      {r.when} · <b className="text-foreground">{r.percent === 0 ? "환불 없음" : `${r.percent}%`}</b>
                    </li>
                  ))}
                  <li>크리에이터 사정으로 취소 · <b className="text-foreground">전액</b></li>
                </ul>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5 text-[15px] font-semibold">
              <Link href="/about" className="underline-offset-4 hover:underline" data-testid="home-about">라운디 이야기</Link>
              <Link href="/refund" className="underline-offset-4 hover:underline">취소·환불 정책</Link>
              <Link href="/help" className="underline-offset-4 hover:underline">고객센터</Link>
              <Link href="/become-a-host" className="underline-offset-4 hover:underline">크리에이터 지원</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </Blue>
  );
}
