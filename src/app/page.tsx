import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cache, Suspense } from "react";

import { brand } from "@/config/brand";
import { Seal } from "@/components/brand/seat-table";
import { LogoStacked } from "@/components/brand/logo";
import { ContentCard } from "@/components/contents/content-card";
import { CreatorTile } from "@/components/hosts/host-card";
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

/** 첫 화면 큰 카드 수 */
const HERO_LIMIT = 5;

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
  Promise.all([listCategories(), listUpcomingMeetups(), listFeaturedHosts(8), listPublishedContents({ limit: 3 })]),
);

async function HomeSections() {
  const [categories, meetups, hosts, contents] = await homeData();
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const pillarOf = Object.fromEntries(categories.map((c) => [c.slug, c.pillar]));
  const pillarCounts = meetups.reduce<Record<string, number>>((acc, m) => {
    const p = pillarOf[m.category_slug];
    return p ? { ...acc, [p]: (acc[p] ?? 0) + 1 } : acc;
  }, {});
  // 첫 화면 큰 카드에 이미 나온 프로그램은 다시 보여 주지 않음 (같은 카드 두 번 금지)
  const heroIds = new Set(pickThisWeek(meetups, HERO_LIMIT).list.map((m) => m.id));
  const rest = meetups.filter((m) => !heroIds.has(m.id)).slice(0, 8);
  const openSeats = meetups.reduce((sum, m) => sum + (m.nextSession.status === "open" ? Math.max(0, m.nextSession.capacity - m.nextSession.reserved_count) : 0), 0);
  const countOf = (hostId: string) => meetups.filter((m) => m.host?.user_id === hostId).length;

  return (
    <>
      {/* 2. 만나 볼 사람들 — 크리에이터를 먼저 발견 */}
      {hosts.length > 0 && (
        <section className="mx-auto w-full max-w-6xl" aria-labelledby="hosts-title" data-testid="home-creators">
          <Label title="만나 볼 사람들" id="hosts-title" en="CREATORS" href="/hosts" />
          <p className="-mt-1 mb-4 px-4 text-sm text-muted-foreground sm:px-6">프로그램보다 사람을 먼저. 마음에 드는 사람의 세계로 들어가 보세요.</p>
          <ul className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 no-scrollbar sm:grid sm:grid-cols-4 sm:gap-5 sm:overflow-visible sm:px-6 lg:grid-cols-5">
            {[...hosts].sort((a, b) => countOf(b.user_id) - countOf(a.user_id)).map((h) => (
              <li key={h.user_id} className="w-[42vw] max-w-[13rem] shrink-0 snap-start sm:w-auto sm:max-w-none">
                <CreatorTile host={h} programCount={countOf(h.user_id)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 3. 세 개의 분야 */}
      <section className="mx-auto mt-6 w-full max-w-4xl" aria-labelledby="tables-title" data-testid="home-pillars">
        <Label id="tables-title" title="세 개의 분야" en="THREE FIELDS" />
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

      {/* 4. 더 많은 프로그램 (첫 화면에 없던 것만) */}
      {rest.length > 0 && (
        <section className="mx-auto mt-6 w-full max-w-6xl" aria-labelledby="picks-title" data-testid="home-this-week">
          <Label id="picks-title" title="곧 열리는 프로그램" en="ALL PROGRAMS" href="/meetups" />
          <div className="px-4 sm:px-6">
            {openSeats > 0 && (
              <p className="mb-4 text-sm text-muted-foreground" data-testid="open-seats">
                지금 신청할 수 있는 자리 <b className="font-display text-lg text-foreground">{openSeats}</b>개
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" data-testid="meetup-grid">
              {rest.map((m) => (
                <MeetupCard key={m.id} meetup={m} categoryName={names[m.category_slug] ?? m.category_slug} pillar={pillarOf[m.category_slug]} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. 저널 */}
      {contents.length > 0 && (
        <section className="mx-auto mt-6 w-full max-w-6xl" aria-labelledby="journal-title" data-testid="home-journal">
          <Label title="크리에이터의 이야기" id="journal-title" en="JOURNAL" href="/journal" />
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

/* ---------- 6. 믿을 수 있는 이유 (실제 운영 중인 절차만) + 크리에이터 지원 ---------- */

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
            크리에이터 심사 <span className="text-sage">→</span> 프로그램 검수 <span className="text-sage">→</span> 공개
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
            <h2 className="font-display text-xl font-bold sm:text-2xl">당신의 세계를 프로그램으로</h2>
            <p className="mt-2 text-sm leading-relaxed text-cream/80">팔로워가 적어도 괜찮아요. 자기만의 작업과 전문성이 있다면 첫 프로그램은 함께 기획해요. 가입비 없이, 판매될 때만 나눠요.</p>
            <div className="mt-auto pt-5">
              <Button asChild variant="secondary">
                <Link href="/become-a-host/apply">
                  호스트 지원하기
                  <ArrowRight aria-hidden strokeWidth={1.8} />
                </Link>
              </Button>
            </div>
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
  const { list } = pickThisWeek(meetups, HERO_LIMIT);
  const hasSample = list.some((m) => m.is_sample);
  return (
    <section className="pb-10" aria-labelledby="hero-title" data-testid="home-featured">
      <h1 id="hero-title" className="flex justify-center px-4 pt-10 pb-9 text-[#1f3a2b] sm:pt-16 sm:pb-12" data-testid="hero-logo">
        <span className="flex flex-col items-center">
          <LogoStacked className="w-[min(64vw,300px)] drop-shadow-[0_1px_0_rgb(255_255_255/0.35)]" />
          <span className="mt-5 font-display text-[15px] tracking-[0.06em] text-[#2b3a30] sm:mt-6 sm:text-lg">{brand.tagline}</span>
        </span>
      </h1>
      <p className="mx-auto max-w-6xl px-4 text-[11px] font-semibold tracking-[0.24em] text-muted-foreground sm:px-6">THIS WEEK · 이번 주 프로그램</p>
      {list.length ? (
        <ul className="mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 no-scrollbar sm:mx-auto sm:max-w-6xl sm:px-6">
          {list.map((m) => (
            <li key={m.id} className="w-[44vw] max-w-[22rem] shrink-0 snap-start sm:w-[22rem]">
              <FeaturedCard meetup={m} categoryName={names[m.category_slug] ?? m.category_slug} pillar={pillarOf[m.category_slug]} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mx-4 mt-4 rounded-2xl bg-card/70 px-5 py-12 text-center text-muted-foreground">곧 첫 프로그램이 열립니다.</p>
      )}
      {hasSample && (
        <p className="mx-4 mt-2 rounded-xl bg-notice px-4 py-3 text-[13px] text-notice-foreground sm:mx-auto sm:max-w-6xl" data-testid="sample-notice">
          <strong>샘플</strong> 표시가 있는 프로그램은 서비스 준비 중 보여 드리는 예시예요. 아직 신청할 수 없어요.
        </p>
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
      <div className="relative aspect-square overflow-hidden bg-[linear-gradient(150deg,#e3e9da_0%,#c4cfb5_70%,#b2bfa2_100%)] sm:aspect-[4/5]">
        {meetup.cover_image_url ? (
          <Photo src={meetup.cover_image_url} alt={meetup.title} priority sizes="(min-width: 640px) 352px, 84vw" fallback={null} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div aria-hidden className="absolute inset-0 flex flex-col justify-end p-3 sm:p-5">
            {pillarLabel && <span className="text-[9px] tracking-[0.22em] text-[#44513f] sm:text-[10px] sm:tracking-[0.26em]">{pillarLabel}</span>}
            <span className="mt-0.5 font-display text-base leading-tight font-bold text-[#2f3f34] sm:mt-1 sm:text-3xl">{categoryName}</span>
          </div>
        )}
        {/* 사진이 없으면 아래 큰 분야 이름과 겹치므로 휴대폰에서는 숨김 */}
        <span
          className={`absolute top-2.5 left-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-foreground ${meetup.cover_image_url ? "inline-block" : "hidden sm:inline-block"}`}
        >
          {categoryName}
        </span>
        {meetup.is_sample && <SampleBadge className="absolute top-2 right-2 sm:top-3 sm:right-3" />}
      </div>
      <div className="flex flex-1 flex-col px-3 pt-2.5 pb-3 sm:px-4 sm:pt-3.5 sm:pb-4">
        <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{formatShortDateTime(s.starts_at)} · {s.area}</p>
        <h2 className="mt-0.5 line-clamp-2 font-display text-sm leading-snug font-bold break-keep sm:mt-1 sm:text-xl">{meetup.title}</h2>
        <p className="mt-1 hidden text-sm leading-relaxed text-muted-foreground sm:mt-1.5 sm:line-clamp-2">{meetup.summary}</p>
        <p className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 pt-2 text-xs sm:pt-3 sm:text-sm">
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
