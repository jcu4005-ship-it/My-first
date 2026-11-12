import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Suspense } from "react";

import { brand } from "@/config/brand";
import { Seal } from "@/components/brand/seat-table";
import { seatsLeft } from "@/components/meetups/badges";
import { ContentCard } from "@/components/contents/content-card";
import { HostCard } from "@/components/hosts/host-card";
import { MeetupCard } from "@/components/meetups/meetup-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { PILLARS } from "@/config/pillars";
import { listPublishedContents } from "@/lib/contents/queries";
import { listCategories, listFeaturedHosts, listUpcomingMeetups, type MeetupCardData } from "@/lib/meetups/queries";

/* ---------- 공통 조각 ---------- */

function SectionHeading({ title, id, href, linkLabel }: { title: string; id: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 sm:mb-7">
      <h2 id={id} className="font-display text-2xl font-bold break-keep text-forest sm:text-3xl">
        {title}
      </h2>
      {href && (
        <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          {linkLabel ?? "전체 보기"}
          <ArrowRight aria-hidden className="size-4" strokeWidth={1.6} />
        </Link>
      )}
    </div>
  );
}

/** 휴대폰: 옆으로 넘기는 한 줄 (다음 카드가 살짝 보이게), 태블릿·PC: 격자 */
const rail =
  "relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 sm:snap-none sm:gap-5";
const railItem = "w-[76vw] max-w-[20rem] shrink-0 snap-start sm:w-auto sm:max-w-none";

/** 인기순: 예약률이 높은 순 (같으면 가까운 일정 순) */
function byPopularity(a: MeetupCardData, b: MeetupCardData) {
  const rate = (m: MeetupCardData) => m.nextSession.reserved_count / Math.max(1, m.nextSession.capacity);
  return rate(b) - rate(a) || a.nextSession.starts_at.localeCompare(b.nextSession.starts_at);
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** 이번 주(7일 안) 프로그램을 인기순으로. 없으면 가장 가까운 일정 순으로 대신 보여 줌 */
function pickThisWeek(meetups: MeetupCardData[], limit = 6) {
  const now = Date.now();
  const week = meetups.filter((m) => new Date(m.nextSession.starts_at).getTime() - now <= WEEK_MS).sort(byPopularity);
  return week.length ? { thisWeek: true, list: week.slice(0, limit) } : { thisWeek: false, list: meetups.slice(0, limit) };
}

/* ---------- 2~5. 데이터가 필요한 섹션 ---------- */

async function HomeSections() {
  const [categories, meetups, hosts, contents] = await Promise.all([
    listCategories(),
    listUpcomingMeetups(),
    listFeaturedHosts(4),
    listPublishedContents({ limit: 3 }),
  ]);
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const pillarOf = Object.fromEntries(categories.map((c) => [c.slug, c.pillar]));
  const pillarCounts = meetups.reduce<Record<string, number>>((acc, m) => {
    const p = pillarOf[m.category_slug];
    return p ? { ...acc, [p]: (acc[p] ?? 0) + 1 } : acc;
  }, {});
  const { thisWeek, list: picks } = pickThisWeek(meetups);
  const openSeats = picks.reduce((sum, m) => sum + (m.nextSession.status === "open" ? seatsLeft(m.nextSession) : 0), 0);
  const hasSample = picks.some((m) => m.is_sample);
  const firstClassOf = (hostId: string) => meetups.find((m) => m.host?.user_id === hostId);

  return (
    <>
      {/* 1. 첫 화면: 이번 주 빈자리 수 (실제 데이터) */}
      <section className="relative mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-14" aria-labelledby="hero-title">
        <p className="text-[11.5px] tracking-[0.14em] text-muted-foreground">{thisWeek ? "THIS WEEK'S TABLES" : "UPCOMING TABLES"}</p>
        <h1 id="hero-title" className="mt-2 font-display text-[1.75rem] leading-[1.32] font-bold break-keep sm:text-5xl sm:leading-tight">
          {thisWeek ? "이번 주" : "곧"}, 당신을 위한
          <br />
          {openSeats > 0 ? (
            <>
              자리가 <em className="text-clay not-italic">{openSeats}개</em> 비어 있어요.
            </>
          ) : (
            "테이블을 준비하고 있어요."
          )}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">심사를 통과한 호스트가 열 명 남짓의 테이블만 차려요.</p>
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground" aria-hidden>
          <span className="flex items-center gap-1.5"><i className="size-[11px] rounded-full bg-forest" />예약된 자리</span>
          <span className="flex items-center gap-1.5"><i className="size-[11px] rounded-full border-[1.5px] border-dashed border-sage bg-card" />빈자리</span>
        </div>
        {/* 분야 */}
        <nav aria-label="분야로 찾기" className="-mx-4 mt-5 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0" data-testid="home-pillars">
          <ul className="flex w-max gap-2">
            <li>
              <Link href="/meetups" className="inline-flex h-9 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-white">전체</Link>
            </li>
            {PILLARS.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/meetups?pillar=${p.slug}`}
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-card px-4 text-sm hover:border-forest/40"
                  data-testid="pillar-tile"
                >
                  {p.ko}
                  <span className="sr-only"> ({p.label})</span>
                  {pillarCounts[p.slug] ? <span className="text-xs text-muted-foreground">{pillarCounts[p.slug]}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      {/* 2. 이번 주 테이블 */}
      <section className="mx-auto mt-6 w-full max-w-6xl px-4 sm:mt-8 sm:px-6" aria-label={thisWeek ? "이번 주 테이블" : "곧 열리는 테이블"} data-testid="home-this-week">
        {hasSample && (
          <p className="mb-4 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="sample-notice">
            지금 보이는 프로그램은 서비스 준비 중 보여 드리는 <strong>샘플</strong>입니다. 실제로 신청할 수 없어요.
          </p>
        )}
        {picks.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" data-testid="meetup-grid">
            {picks.map((m) => (
              <MeetupCard key={m.id} meetup={m} categoryName={names[m.category_slug] ?? m.category_slug} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border-[1.5px] border-dashed border-[#cfc6b5] py-12 text-center text-muted-foreground">곧 첫 테이블이 차려집니다.</p>
        )}
        <div className="mt-4 text-center">
          <Link href="/meetups" className="inline-flex items-center gap-1 text-sm font-semibold text-forest hover:underline hover:underline-offset-4">
            모든 테이블 보기 <ArrowRight aria-hidden className="size-4" strokeWidth={1.8} />
          </Link>
        </div>
      </section>

      {/* 4. 호스트 */}
      {hosts.length > 0 && (
        <section className="mx-auto mt-12 w-full max-w-6xl px-4 sm:mt-16 sm:px-6" aria-labelledby="hosts-title">
          <SectionHeading title="프로그램을 여는 사람들" id="hosts-title" href="/hosts" />
          <ul className={`${rail} sm:grid-cols-2 lg:grid-cols-4`}>
            {hosts.map((h) => (
              <li key={h.user_id} className={railItem}>
                <HostCard host={h} representative={firstClassOf(h.user_id)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 5. 저널 */}
      {contents.length > 0 && (
        <section className="mx-auto mt-12 w-full max-w-6xl px-4 sm:mt-16 sm:px-6" aria-labelledby="journal-title" data-testid="home-journal">
          <SectionHeading title="호스트의 이야기" id="journal-title" href="/journal" />
          <ul className={`${rail} sm:grid-cols-3`}>
            {contents.map((c) => (
              <li key={c.id} className={railItem}>
                <ContentCard content={c} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function SectionsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-14">
      <div className="h-24 w-72 max-w-full animate-pulse rounded-xl bg-muted" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-[18px] bg-muted" />
        ))}
      </div>
    </div>
  );
}

/* ---------- 6. 믿을 수 있는 이유 (실제 운영 중인 절차만) + 멤버십(준비 중) + 호스트 지원 ---------- */

const CURATION = [
  { title: "호스트 심사", body: "경력·포트폴리오와 기획안을 운영팀이 직접 확인해요." },
  { title: "공개 전 검수", body: "모든 프로그램과 글은 검수를 거친 뒤에만 공개돼요." },
  { title: "작은 테이블", body: "한 사람 한 사람을 볼 수 있는 인원으로만 열어요." },
  { title: "추천은 사람이", body: "팔로워 수가 아니라 운영팀이 직접 골라요." },
];

function TrustAndJoin() {
  return (
    <section className="mx-auto mt-12 w-full max-w-6xl px-4 sm:mt-16 sm:px-6" aria-labelledby="curation-title">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative rounded-[18px] border-[1.5px] border-dashed border-[#cfc6b5] p-5 sm:p-7" data-testid="home-curation">
          <Seal className="absolute -top-3 right-4">심사<br />통과</Seal>
          <h2 id="curation-title" className="font-display text-xl font-bold sm:text-2xl">아무나 차릴 수 없는 테이블</h2>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
            호스트 심사 <span className="text-sage">→</span> 프로그램 검수 <span className="text-sage">→</span> 초대장 발송
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {CURATION.map((c) => (
              <li key={c.title} className="flex gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest">
                  <Check aria-hidden className="size-3" strokeWidth={2.6} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{c.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">{c.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4">
          <div id="host" className="flex flex-1 flex-col rounded-[18px] bg-forest p-6 text-cream sm:p-7">
            <h2 className="font-display text-xl font-bold sm:text-2xl">당신의 테이블을 차려 보세요</h2>
            <p className="mt-2 text-sm leading-relaxed text-cream/80">입장료 없이, 프로그램이 판매될 때만 함께 나눠요.</p>
            <div className="mt-auto pt-5">
              <Button asChild variant="secondary">
                <Link href="/become-a-host/apply">
                  호스트 지원하기
                  <ArrowRight aria-hidden strokeWidth={1.8} />
                </Link>
              </Button>
            </div>
          </div>
          <div className="ticket p-5" data-testid="membership-soon">
            <p className="flex items-center gap-2 text-sm font-semibold">
              {brand.name} 멤버십
              <span className="pill bg-linen text-muted-foreground">준비 중</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              프로그램에 참여한 회원을 위한 멤버십을 준비하고 있어요. 지금은 가입하거나 결제할 수 없어요.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Suspense fallback={<SectionsSkeleton />}>
          <HomeSections />
        </Suspense>
        <TrustAndJoin />
      </main>
      <SiteFooter />
    </>
  );
}
