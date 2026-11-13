import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cache, Suspense } from "react";

import { brand } from "@/config/brand";
import { Seal } from "@/components/brand/seat-table";
import { ContentCard } from "@/components/contents/content-card";
import { HostCard } from "@/components/hosts/host-card";
import { SampleBadge } from "@/components/meetups/badges";
import { MeetupCard } from "@/components/meetups/meetup-card";
import { Photo } from "@/components/media/photo";
import { formatPrice, formatShortDateTime } from "@/lib/format";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { PILLARS } from "@/config/pillars";
import { listPublishedContents } from "@/lib/contents/queries";
import { listCategories, listFeaturedHosts, listUpcomingMeetups, type MeetupCardData } from "@/lib/meetups/queries";

/* ---------- 공통 조각 ---------- */

/** 편집 스타일 제목: 세리프 제목 + 영문 작은 라벨 + 가는 선 */
function Label({ title, en, id, href }: { title: string; en: string; id: string; href?: string }) {
  return (
    <div className="mx-4 mb-4 flex items-end justify-between gap-4 border-b border-[#d9ded2] pt-8 pb-2.5 sm:mx-6">
      <h2 id={id} className="font-display text-[21px] font-bold break-keep sm:text-2xl">{title}</h2>
      {href ? (
        <Link href={href} className="flex shrink-0 items-center gap-1 text-[11px] tracking-[0.2em] text-muted-foreground hover:text-foreground">
          {en}
          <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.6} />
          <span className="sr-only"> 전체 보기</span>
        </Link>
      ) : (
        <span className="text-[10.5px] tracking-[0.24em] text-muted-foreground">{en}</span>
      )}
    </div>
  );
}

/** 세 테이블 한 줄 소개 */
const PILLAR_LINE: Record<string, string> = {
  knowledge: "자기만의 질문을 나눕니다.",
  creators: "자기만의 작업을 같이 해 봅니다.",
  experts: "현장에서 쌓은 방법을 나눕니다.",
};

/** 휴대폰: 옆으로 넘기는 한 줄 (다음 카드가 살짝 보이게), 태블릿·PC: 격자 */
const rail =
  "relative flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 no-scrollbar sm:grid sm:overflow-visible sm:pb-0 sm:snap-none sm:gap-5";
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

/** 메인에서 같은 데이터를 두 번 읽지 않도록 (첫 화면·본문 공용) */
const homeData = cache(() =>
  Promise.all([listCategories(), listUpcomingMeetups(), listFeaturedHosts(4), listPublishedContents({ limit: 3 })]),
);

async function HomeSections() {
  const [categories, meetups, hosts, contents] = await homeData();
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const pillarOf = Object.fromEntries(categories.map((c) => [c.slug, c.pillar]));
  const pillarCounts = meetups.reduce<Record<string, number>>((acc, m) => {
    const p = pillarOf[m.category_slug];
    return p ? { ...acc, [p]: (acc[p] ?? 0) + 1 } : acc;
  }, {});
  const { thisWeek, list: picks } = pickThisWeek(meetups);
  const openSeats = picks.reduce((sum, m) => sum + (m.nextSession.status === "open" ? Math.max(0, m.nextSession.capacity - m.nextSession.reserved_count) : 0), 0);
  const hasSample = picks.some((m) => m.is_sample);
  const firstClassOf = (hostId: string) => meetups.find((m) => m.host?.user_id === hostId);

  return (
    <>
      {/* 2. 세 개의 테이블 */}
      <section className="mx-auto w-full max-w-4xl" aria-labelledby="tables-title" data-testid="home-pillars">
        <Label id="tables-title" title="세 개의 테이블" en="THREE TABLES" />
        <ol>
          {PILLARS.map((p, i) => (
            <li key={p.slug} className="border-b border-dashed border-[#d2d9c8] last:border-0">
              <Link href={`/meetups?pillar=${p.slug}`} className="group grid grid-cols-[3rem_1fr_auto] items-start gap-2 px-5 py-4 sm:px-6" data-testid="pillar-tile">
                <span className="font-display text-2xl leading-none text-sage">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block text-[11px] font-bold tracking-[0.26em]">{p.label.toUpperCase()}</span>
                  <span className="mt-1 block font-display text-[15.5px] leading-snug group-hover:underline group-hover:underline-offset-4">{PILLAR_LINE[p.slug]}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{p.ko}{pillarCounts[p.slug] ? ` · ${pillarCounts[p.slug]}개 프로그램` : ""}</span>
                </span>
                <ArrowRight aria-hidden className="mt-1 size-4 text-muted-foreground" strokeWidth={1.6} />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* 3. 이번 주 자리 */}
      <section className="mx-auto mt-6 w-full max-w-6xl" aria-labelledby="picks-title" data-testid="home-this-week">
        <Label id="picks-title" title={thisWeek ? "이번 주 자리" : "곧 열리는 자리"} en={thisWeek ? "THIS WEEK" : "COMING UP"} href="/meetups" />
        <div className="px-4 sm:px-6">
          {openSeats > 0 && (
            <p className="mb-4 text-sm text-muted-foreground" data-testid="open-seats">
              {thisWeek ? "이번 주" : "곧 열리는 자리"} 남은 자리 <b className="font-display text-lg text-foreground">{openSeats}</b>개
            </p>
          )}
          {hasSample && (
            <p className="mb-4 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="sample-notice">
              지금 보이는 프로그램은 서비스 준비 중 보여 드리는 <strong>샘플</strong>입니다. 실제로 신청할 수 없어요.
            </p>
          )}
          {picks.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" data-testid="meetup-grid">
              {picks.map((m) => (
                <MeetupCard key={m.id} meetup={m} categoryName={names[m.category_slug] ?? m.category_slug} pillar={pillarOf[m.category_slug]} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">곧 첫 자리가 열립니다.</p>
          )}
        </div>
      </section>

      {/* 4. 호스트 */}
      {hosts.length > 0 && (
        <section className="mx-auto mt-6 w-full max-w-6xl" aria-labelledby="hosts-title">
          <Label title="프로그램을 여는 사람들" id="hosts-title" en="PEOPLE" href="/hosts" />
          <ul className={`${rail} px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4`}>
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
        <section className="mx-auto mt-6 w-full max-w-6xl" aria-labelledby="journal-title" data-testid="home-journal">
          <Label title="호스트의 이야기" id="journal-title" en="JOURNAL" href="/journal" />
          <ul className={`${rail} px-4 sm:grid-cols-3 sm:px-6`}>
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
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6">
      <div className="h-40 w-full animate-pulse rounded-xl bg-muted" />
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
    <section className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6" aria-labelledby="curation-title">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative rounded-[18px] border-[1.5px] border-dashed border-[#cfd6c4] p-5 sm:p-7" data-testid="home-curation">
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

/* ---------- 1. 첫 화면: 둥글게 놓인 빈 의자와 원목 테이블 ---------- */

async function Hero() {
  const [categories, meetups] = await homeData();
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const pillarOf = Object.fromEntries(categories.map((c) => [c.slug, c.pillar]));
  const { list } = pickThisWeek(meetups, 5);
  return (
    <section className="pt-5 pb-10 sm:pt-8" aria-labelledby="hero-title" data-testid="home-featured">
      <h1 id="hero-title" className="px-4 font-display text-[15px] text-[#2b3a30] sm:px-6 sm:text-center sm:text-lg">{brand.tagline}</h1>
      {list.length ? (
        <ul className="mt-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 no-scrollbar sm:mx-auto sm:max-w-6xl sm:px-6">
          {list.map((m) => (
            <li key={m.id} className="w-[84vw] max-w-[22rem] shrink-0 snap-start">
              <FeaturedCard meetup={m} categoryName={names[m.category_slug] ?? m.category_slug} pillar={pillarOf[m.category_slug]} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mx-4 mt-4 rounded-2xl bg-card/70 px-5 py-12 text-center text-muted-foreground">곧 첫 자리가 열립니다.</p>
      )}
    </section>
  );
}

/** 첫 화면 큰 카드: 호스트가 올린 사진 → 날짜·동네 → 제목 → 한 줄 소개 → 남은 자리·참가비 */
function FeaturedCard({ meetup, categoryName, pillar }: { meetup: MeetupCardData; categoryName: string; pillar?: string }) {
  const s = meetup.nextSession;
  const left = Math.max(0, s.capacity - s.reserved_count);
  const closed = s.status !== "open" || left === 0;
  const pillarLabel = PILLARS.find((p) => p.slug === pillar)?.label.toUpperCase();
  return (
    <Link href={`/meetups/${meetup.id}`} className="group flex h-full flex-col overflow-hidden rounded-[24px] bg-card shadow-[0_18px_34px_-22px_rgb(35_51_42/0.6)]" data-testid="featured-card">
      <div className="relative aspect-[4/5] overflow-hidden bg-[linear-gradient(150deg,#e3e9da_0%,#c4cfb5_70%,#b2bfa2_100%)]">
        {meetup.cover_image_url ? (
          <Photo src={meetup.cover_image_url} alt={meetup.title} priority sizes="(min-width: 640px) 352px, 84vw" fallback={null} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div aria-hidden className="absolute inset-0 flex flex-col justify-end p-5">
            {pillarLabel && <span className="text-[10px] tracking-[0.26em] text-[#44513f]">{pillarLabel}</span>}
            <span className="mt-1 font-display text-3xl leading-tight font-bold text-[#2f3f34]">{categoryName}</span>
          </div>
        )}
        <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-foreground">{categoryName}</span>
        {meetup.is_sample && <SampleBadge className="absolute top-3 right-3" />}
      </div>
      <div className="flex flex-1 flex-col px-4 pt-3.5 pb-4">
        <p className="text-xs text-muted-foreground">{formatShortDateTime(s.starts_at)} · {s.area}</p>
        <h2 className="mt-1 font-display text-xl leading-snug font-bold break-keep">{meetup.title}</h2>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{meetup.summary}</p>
        <p className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 pt-3 text-sm">
          <span className={closed ? "text-muted-foreground" : left <= 2 ? "font-semibold text-clay" : "font-semibold text-forest"}>
            {closed ? "마감" : `${left}자리 남음`}
            <span className="font-normal text-muted-foreground"> · {meetup.host?.display_name}</span>
          </span>
          <b className="shrink-0">{formatPrice(meetup.price)}</b>
        </p>
      </div>
    </Link>
  );
}

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Suspense fallback={<div className="h-[560px]" />}>
          <Hero />
        </Suspense>
        <div className="paper rounded-t-[28px] pb-14 shadow-[0_-18px_40px_-30px_rgb(35_51_42/0.6)]">
          <Suspense fallback={<SectionsSkeleton />}>
            <HomeSections />
          </Suspense>
          <TrustAndJoin />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
