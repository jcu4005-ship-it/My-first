import Link from "next/link";
import { ArrowRight, BadgeCheck, CreditCard, ShieldCheck, Users } from "lucide-react";

import { SeatCircle, SeatLegend } from "@/components/brand/seat-circle";
import { HostCard } from "@/components/hosts/host-card";
import { Night } from "@/components/layout/night";
import { SampleBadge, seatsLeft } from "@/components/meetups/badges";
import { CircleGrid, hostVerified, seatLine } from "@/components/meetups/circle-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentMember } from "@/lib/auth/session";
import { formatPrice, ticketDate } from "@/lib/format";
import { creatorPhoto, hostHref } from "@/lib/hosting/avatar";
import { listMyFollowedHosts } from "@/lib/hosting/follows";
import { getHost, listCategories, listFeaturedHosts, listUpcomingMeetups, type MeetupCardData } from "@/lib/meetups/queries";
import { REFUND_RULES } from "@/lib/payments/refund-policy";
import { getHostReviewSummaries } from "@/lib/reviews/queries";

/*
 * 홈 (드롭 × 모닥불 원 · 색 D안 "미드나잇 네이비 & 골드", 2026-11-20)
 * 1. 처음 온 사람이 바로 이해: 무엇을 하는 곳인지 + 믿을 이유(심사·소규모·결제/환불)
 * 2. 시그니처 원(콘텐츠보다 작게) + 크리에이터 이름·분야를 크게
 * 3. 지금 열린 원 · 크리에이터 · 운영 방식(아이보리)
 * 숫자·후기는 실제 데이터만. 예전 잡지형 메인은 /about.
 */
export const instant = false;

const open = (m: MeetupCardData) => m.nextSession.status === "open" && seatsLeft(m.nextSession) > 0;
/** 많이 찬 순, 같으면 가까운 일정 */
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
    <Night>
      <SiteHeader />
      <main className="flex-1">
        {/* 1. 무엇을 하는 곳인지 + 믿을 이유 */}
        <section className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-14" data-testid="home-intro">
          <h1 className="max-w-3xl font-display text-[30px] leading-[1.3] font-bold tracking-[-0.02em] break-keep sm:text-[46px]">
            검증된 크리에이터와
            <br />
            4~10명이 둘러앉는 작은 수업
          </h1>
          <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
            운영팀이 직접 심사한 크리에이터의 오프라인 클래스를 찾고, 라운디 안에서 안전하게 신청·결제하세요.
          </p>
          <ul className="mt-6 grid gap-2.5 sm:grid-cols-3 sm:gap-3" data-testid="home-trust">
            <li className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
              <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-gold" strokeWidth={1.8} />
              <span>
                <b className="block text-[15px]">크리에이터 심사 · 프로그램 검수</b>
                <span className="text-[14px] text-muted-foreground">운영팀이 확인한 사람과 프로그램만 공개해요</span>
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
              <Users aria-hidden className="mt-0.5 size-5 shrink-0 text-gold" strokeWidth={1.8} />
              <span>
                <b className="block text-[15px]">4~10명 소규모</b>
                <span className="text-[14px] text-muted-foreground">한 사람 한 사람이 보이는 인원으로만 열려요</span>
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
              <CreditCard aria-hidden className="mt-0.5 size-5 shrink-0 text-gold" strokeWidth={1.8} />
              <span>
                <b className="block text-[15px]">결제는 라운디 안에서만</b>
                <span className="text-[14px] text-muted-foreground">환불 기준을 모든 프로그램에 똑같이 적용해요</span>
              </span>
            </li>
          </ul>
        </section>

        {/* 2. 시그니처 원 + 크리에이터 */}
        <section className="mx-auto mt-10 w-full max-w-6xl px-4 sm:mt-14 sm:px-6" data-testid="home-circle">
          <h2 className="font-display text-[24px] font-bold tracking-[-0.02em] sm:text-[30px]">
            {hero ? (fromFollowed ? "팔로우한 크리에이터의 원에 자리가 있어요" : "당신 자리가 비어 있어요") : "곧 첫 원이 열려요"}
          </h2>
          {hero && s && d && line ? (
            <div className="mt-5 grid items-center gap-6 rounded-[24px] border border-border bg-card p-5 sm:p-7 md:grid-cols-[260px_1fr] md:gap-10">
              <div className="mx-auto w-[200px] md:w-[260px]">
                <SeatCircle
                  capacity={s.capacity}
                  taken={s.reserved_count}
                  you={hero.is_sample ? false : "open"}
                  face={face}
                  initial={hero.host?.display_name.slice(0, 1)}
                  label={hero.is_sample ? undefined : "당신 자리"}
                />
                <SeatLegend className="mt-3" />
              </div>
              <div className="min-w-0">
                {hero.host && (
                  <Link href={hostHref(hero.host)} className="group inline-flex flex-col" data-testid="home-host">
                    <span className="flex items-center gap-1.5 text-[22px] font-bold tracking-[-0.02em] group-hover:underline group-hover:underline-offset-4 sm:text-[26px]">
                      {hero.host.display_name}
                      {hostVerified(heroHost ?? hero.host) && <BadgeCheck aria-label="운영팀 심사를 통과한 크리에이터" className="size-5 text-gold" strokeWidth={2} />}
                    </span>
                    <span className="text-[15.5px] text-muted-foreground">
                      {[heroHost?.occupation || hero.host.occupation, heroHost?.expertise?.slice(0, 2).join(" · ")].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                )}
                {heroHost?.career && <p className="mt-2 line-clamp-2 text-[14.5px] leading-relaxed text-muted-foreground">경력 · {heroHost.career}</p>}
                <div className="mt-5 border-t border-border pt-5">
                  <p className="flex flex-wrap items-center gap-2 text-[19px] font-bold tracking-[-0.02em] sm:text-[21px]">
                    {hero.title}
                    {hero.is_sample && <SampleBadge />}
                  </p>
                  <p className="mt-1.5 text-[15px] text-muted-foreground">
                    {d.md} ({d.wd}) {d.time} · {s.area} · <span className="font-num text-foreground">{hero.price > 0 ? formatPrice(hero.price) : "무료"}</span>
                  </p>
                  <p className="mt-2 text-[15px] font-bold text-gold" data-testid="home-seat-line">
                    {line.text}
                  </p>
                  {heroTrust && heroTrust.count > 0 && heroTrust.avg != null && (
                    <p className="mt-1 text-[14px] text-muted-foreground">★ {heroTrust.avg.toFixed(1)} · 이 크리에이터 후기 {heroTrust.count}개</p>
                  )}
                  <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                    <Link
                      href={`/meetups/${hero.id}#booking`}
                      className="inline-flex h-13 items-center justify-center rounded-xl bg-primary px-7 text-[16px] font-bold text-primary-foreground hover:bg-primary/90"
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
            </div>
          ) : (
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              크리에이터를 팔로우하면 새 원이 열릴 때 알려 드려요.
            </p>
          )}
        </section>

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

        {/* 5. 운영 방식 (아이보리) */}
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
    </Night>
  );
}
