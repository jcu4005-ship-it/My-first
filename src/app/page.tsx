import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cache, Suspense } from "react";

import { brand } from "@/config/brand";
import { LogoSymbol } from "@/components/brand/logo";
import { ContentCard } from "@/components/contents/content-card";
import { CreatorTile } from "@/components/hosts/host-card";
import { MeetupCard } from "@/components/meetups/meetup-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PILLARS } from "@/config/pillars";
import { listPublishedContents } from "@/lib/contents/queries";
import { listCategories, listFeaturedHosts, listUpcomingMeetups, type MeetupCardData } from "@/lib/meetups/queries";

/*
 * 메인 (2026-11-17 대표 시안 "Creator Culture")
 * 1 큰 사진 + 영문 세리프 문구 → 2 지금 가장 흥미로운 경험(프로그램) → 3 세 카테고리(사진 타일)
 * → 4 만나 볼 사람들(크리에이터) → 5 이야기(저널) → 6 짙은 초록 띠(심사 기준 + 크리에이터 모집)
 * 사진: 분위기 사진은 대표 시안에서 잘라 쓴 임시 이미지(public/images/home). 실제 루라운지 사진으로 교체 예정.
 */

/** 섹션 제목: 작은 영문 라벨 + 제목 + 전체 보기 */
function Label({ title, en, id, href }: { title: string; en: string; id: string; href?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 px-4 sm:px-6">
      <div>
        <p className="text-[10.5px] font-semibold tracking-[0.26em] text-muted-foreground">{en}</p>
        <h2 id={id} className="mt-1.5 text-[21px] leading-snug font-semibold tracking-[-0.01em] break-keep sm:text-[26px]">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="flex shrink-0 items-center gap-1.5 pb-1 text-[13px] font-medium text-foreground/80 hover:text-foreground">
          전체 보기
          <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.6} />
        </Link>
      )}
    </div>
  );
}

/** 세 카테고리 타일 (사진 + 한 줄) */
const PILLAR_TILE: Record<string, { line: string; image: string }> = {
  knowledge: { line: "지식을 넘어, 시각을 넓히는 시간", image: "/images/home/knowledge.jpg" },
  creators: { line: "크리에이터와 함께, 새로운 영감을 발견하세요", image: "/images/home/creators.jpg" },
  experts: { line: "분야의 전문가에게, 더 깊이 배우세요", image: "/images/home/experts.jpg" },
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

/* ---------- 데이터가 필요한 섹션 ---------- */

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
  const { list: picks } = pickThisWeek(meetups, 8);
  const hasSample = picks.some((m) => m.is_sample);
  const countOf = (hostId: string) => meetups.filter((m) => m.host?.user_id === hostId).length;

  return (
    <>
      {/* 2. 지금, 가장 흥미로운 경험 */}
      <section className="mx-auto mt-12 w-full max-w-6xl sm:mt-16" aria-labelledby="picks-title" data-testid="home-this-week">
        <Label id="picks-title" title="지금, 가장 흥미로운 경험" en={`${brand.name.toUpperCase()} CLASS`} href="/meetups" />
        {picks.length ? (
          <ul className={`${rail} sm:grid-cols-3 sm:px-6 lg:grid-cols-4`} data-testid="meetup-grid">
            {picks.map((m) => (
              <li key={m.id} className="w-[64vw] max-w-[17rem] shrink-0 snap-start sm:w-auto sm:max-w-none">
                <MeetupCard meetup={m} categoryName={names[m.category_slug] ?? m.category_slug} pillar={pillarOf[m.category_slug]} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mx-4 rounded-2xl bg-card px-5 py-12 text-center text-muted-foreground sm:mx-6">곧 첫 프로그램이 열립니다.</p>
        )}
        {hasSample && (
          <p className="mx-4 mt-4 rounded-xl bg-notice px-4 py-3 text-[13px] text-notice-foreground sm:mx-6" data-testid="sample-notice">
            <strong>샘플</strong> 표시가 있는 프로그램은 서비스 준비 중 보여 드리는 예시예요. 아직 신청할 수 없어요.
          </p>
        )}
      </section>

      {/* 3. 세 카테고리 */}
      <section className="mx-auto mt-14 w-full max-w-6xl sm:mt-20" aria-labelledby="fields-title" data-testid="home-pillars">
        <Label id="fields-title" title="3가지 카테고리로, 더 깊은 경험을 만나보세요" en="OUR CATEGORIES" />
        <ul className="grid gap-3 px-4 sm:grid-cols-3 sm:gap-5 sm:px-6">
          {PILLARS.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/meetups?pillar=${p.slug}`}
                className="group relative flex aspect-[16/9] flex-col justify-end overflow-hidden rounded-[18px] bg-forest-deep p-5 text-[#f3efe8] sm:aspect-[5/4]"
                data-testid="pillar-tile"
              >
                <Image src={PILLAR_TILE[p.slug].image} alt="" fill sizes="(min-width: 640px) 33vw, 100vw" className="object-cover opacity-80 transition-transform duration-700 group-hover:scale-[1.04]" />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                <span className="relative text-[10.5px] font-semibold tracking-[0.26em]">{p.label.toUpperCase()}</span>
                <span className="relative mt-1.5 flex items-end justify-between gap-3">
                  <span className="text-[17px] leading-snug font-semibold break-keep">
                    {PILLAR_TILE[p.slug].line}
                    <span className="mt-1 block text-[12px] font-normal text-[#f3efe8]/75">
                      {p.ko}
                      {pillarCounts[p.slug] ? ` · ${pillarCounts[p.slug]}개 프로그램` : ""}
                    </span>
                  </span>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/60 transition-colors group-hover:bg-white/15">
                    <ArrowRight aria-hidden className="size-4" strokeWidth={1.6} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. 만나 볼 사람들 — 크리에이터를 발견 */}
      {hosts.length > 0 && (
        <section className="mx-auto mt-14 w-full max-w-6xl sm:mt-20" aria-labelledby="hosts-title" data-testid="home-creators">
          <Label title="만나 볼 사람들" id="hosts-title" en="CREATORS" href="/hosts" />
          <ul className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 no-scrollbar sm:grid sm:grid-cols-4 sm:gap-5 sm:overflow-visible sm:px-6 lg:grid-cols-5">
            {[...hosts].sort((a, b) => countOf(b.user_id) - countOf(a.user_id)).map((h) => (
              <li key={h.user_id} className="w-[42vw] max-w-[13rem] shrink-0 snap-start sm:w-auto sm:max-w-none">
                <CreatorTile host={h} programCount={countOf(h.user_id)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 5. 이야기 */}
      {contents.length > 0 && (
        <section className="mx-auto mt-14 w-full max-w-6xl sm:mt-20" aria-labelledby="journal-title" data-testid="home-journal">
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
    <div className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
      <div className="h-8 w-56 animate-pulse rounded bg-muted" />
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-[18px] bg-muted" />
        ))}
      </div>
    </div>
  );
}

/* ---------- 6. 짙은 초록 띠: 실제 운영 중인 심사 기준 + 크리에이터 모집 ---------- */

const CURATION = [
  { title: "크리에이터 심사", body: "작업과 기획안을 운영팀이 직접 확인해요." },
  { title: "공개 전 검수", body: "모든 프로그램과 글은 검수를 거친 뒤에만 공개돼요." },
  { title: "작은 정원", body: "한 사람 한 사람을 볼 수 있는 인원으로만 열어요." },
];

function JoinBand() {
  return (
    <section className="mx-auto mt-16 w-full max-w-6xl px-4 sm:mt-24 sm:px-6" aria-labelledby="join-title">
      <div className="grid overflow-hidden rounded-[22px] bg-forest-deep text-[#f3efe8] lg:grid-cols-[1.1fr_1fr]">
        <div className="p-7 sm:p-10">
          <LogoSymbol className="w-10 text-[#f3efe8]" />
          <p className="mt-5 text-[11px] font-semibold tracking-[0.3em] text-[#f3efe8]/70">CONNECT · LEARN · CREATE</p>
          <h2 id="join-title" className="mt-2 font-editorial text-[30px] leading-[1.1] font-medium sm:text-[40px]">
            A platform where
            <br />
            creators become brands.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#f3efe8]/80">
            팔로워가 적어도 괜찮아요. 자기만의 작업과 전문성이 있다면 첫 프로그램은 함께 기획해요. 가입비 없이, 판매될 때만 나눠요.
          </p>
          <Link
            href="/become-a-host/apply"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[#f3efe8] px-6 text-sm font-semibold text-forest-deep transition-colors hover:bg-white"
          >
            크리에이터로 지원하기
            <ArrowRight aria-hidden className="size-4" strokeWidth={1.8} />
          </Link>
        </div>
        <div className="border-t border-white/10 p-7 sm:p-10 lg:border-t-0 lg:border-l" data-testid="home-curation">
          <p className="text-[11px] font-semibold tracking-[0.3em] text-[#f3efe8]/70">CURATION</p>
          <h3 className="mt-2 text-lg font-semibold">아무나 열 수 없는 자리</h3>
          <ul className="mt-5 flex flex-col gap-4">
            {CURATION.map((c) => (
              <li key={c.title} className="flex gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/12 text-[#f3efe8]">
                  <Check aria-hidden className="size-3" strokeWidth={2.6} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{c.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-[#f3efe8]/70">{c.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- 1. 첫 화면: 큰 사진 + 문구 ---------- */

function Hero() {
  return (
    <section className="mx-auto w-full max-w-6xl px-3 pt-3 sm:px-6 sm:pt-6" aria-labelledby="hero-title">
      <div className="relative isolate overflow-hidden rounded-[22px] bg-forest-deep text-[#f3efe8] sm:grid sm:min-h-[480px] sm:grid-cols-[1.15fr_1fr]">
        {/* 사진: 휴대폰은 배경 전체, PC는 오른쪽 */}
        <div className="absolute inset-0 -z-10 sm:relative sm:inset-auto sm:z-0 sm:order-2">
          <Image src="/images/home/hero.jpg" alt="" fill priority sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/20 sm:bg-gradient-to-r sm:from-forest-deep sm:via-forest-deep/30 sm:to-transparent" />
        </div>
        <div className="flex min-h-[460px] flex-col justify-end p-6 sm:min-h-0 sm:justify-center sm:p-12">
          <p className="text-[11px] font-semibold tracking-[0.32em] text-[#f3efe8]/75">{brand.name.toUpperCase()}</p>
          <h1 id="hero-title" className="mt-3 font-editorial text-[38px] leading-[1.04] font-medium tracking-[-0.01em] sm:text-[60px]">
            Make time
            <br />
            for what inspires you.
          </h1>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-[#f3efe8]/85">
            취향이 맞는 사람들과,
            <br />
            새로운 경험이 시작되는 곳.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/meetups"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#f3efe8] px-6 text-sm font-semibold text-forest-deep transition-colors hover:bg-white"
              data-testid="hero-cta"
            >
              지금 시작하기
              <ArrowRight aria-hidden className="size-4" strokeWidth={1.8} />
            </Link>
            <Link href="/hosts" className="inline-flex h-11 items-center px-2 text-sm font-medium text-[#f3efe8]/85 underline-offset-4 hover:underline">
              크리에이터 만나 보기
            </Link>
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
      <main className="flex-1 pb-16">
        <Hero />
        <Suspense fallback={<SectionsSkeleton />}>
          <HomeSections />
        </Suspense>
        <JoinBand />
      </main>
      <SiteFooter />
    </>
  );
}
