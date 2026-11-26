import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cache, Suspense } from "react";

import { brand } from "@/config/brand";
import { LogoSymbol } from "@/components/brand/logo";
import { MagazineCover } from "@/components/home/magazine-cover";
import { ContentCard } from "@/components/contents/content-card";
import { Photo } from "@/components/media/photo";
import { MeetupRow } from "@/components/meetups/meetup-card";
import { Blue } from "@/components/layout/blue";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PILLARS, pillarInfo } from "@/config/pillars";
import { listPublishedContents } from "@/lib/contents/queries";
import { creatorPhoto, hostHref } from "@/lib/hosting/avatar";
import { listCategories, listFeaturedHosts, listUpcomingMeetups, type HostDetail, type MeetupCardData } from "@/lib/meetups/queries";
import { cn } from "@/lib/utils";

/*
 * 라운디 이야기 (/about) — 예전 메인. 2026-11-20 홈이 "드롭 × 모닥불 원"으로 바뀌며 이곳으로 옮김(대표 결정).
 * "매달 발행되는 문화 잡지" (2026-11-17 대표 승인)
 * 제호 → 호 정보 띠 → 표지(이번 호 크리에이터 사진 + 카피 + 목차) → 이번 호의 사람들 → 그 사람을 만나는 방법(프로그램)
 * → 세 분야 → 저널 → 경험 원칙 → 크리에이터 모집
 * 원칙: 사람 먼저. 인용문은 크리에이터가 직접 쓴 "작업 철학"만 보여 줌(지어낸 문장 없음). 사진은 직접 올린 것 우선.
 */

/** 섹션 머리: 작은 영문 라벨 + 큰 제목 + 굵은 선 */
function Head({ en, title, id, href, more }: { en: string; title: React.ReactNode; id: string; href?: string; more?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b-2 border-foreground pb-3 sm:pb-4">
      <div>
        <p className="text-[10.5px] font-bold tracking-[0.26em] text-fog uppercase">{en}</p>
        <h2 id={id} className="mt-2 text-[28px] leading-[1.15] font-extrabold tracking-[-0.04em] break-keep sm:text-[44px]">
          {title}
        </h2>
      </div>
      {href && (
        <Link href={href} className="flex shrink-0 items-center gap-1.5 pb-1 text-[13px] font-semibold hover:underline hover:underline-offset-4">
          {more ?? "전체 보기"}
          <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.8} />
        </Link>
      )}
    </div>
  );
}

/** 크리에이터 특집의 세 가지 색 (사람마다 다른 인상) */
const TONES = [
  { box: "bg-navy text-[#f5f2ea]", sub: "text-[#c3cbdc]", line: "border-white/25" },
  { box: "bg-white text-[#17243a] ring-1 ring-[#e5e2da]", sub: "text-[#5e6879]", line: "border-white/25" },
  { box: "bg-[#263d63] text-[#f5f2ea]", sub: "text-[#c3cbdc]", line: "border-white/25" },
] as const;

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

/* ---------- 데이터 ---------- */

const homeData = cache(async () => {
  const [categories, meetups, hosts, contents] = await Promise.all([
    listCategories(),
    listUpcomingMeetups(),
    listFeaturedHosts(8),
    listPublishedContents({ limit: 3 }),
  ]);
  // 사진이 있는 크리에이터를 앞으로 (운영팀 추천 순서는 그 안에서 유지)
  const people = [...hosts].sort((a, b) => Number(Boolean(creatorPhoto(b))) - Number(Boolean(creatorPhoto(a))));
  return { categories, meetups, people, contents };
});

function firstProgramOf(meetups: MeetupCardData[], hostId: string) {
  return meetups.find((m) => m.host?.user_id === hostId);
}

/* ---------- 1. 표지 ---------- */

/* ---------- 2~6. 본문 ---------- */

async function Sections() {
  const { categories, meetups, people, contents } = await homeData();
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const pillarOf = Object.fromEntries(categories.map((c) => [c.slug, c.pillar]));
  const pillarCounts = meetups.reduce<Record<string, number>>((acc, m) => {
    const p = pillarOf[m.category_slug];
    return p ? { ...acc, [p]: (acc[p] ?? 0) + 1 } : acc;
  }, {});
  const { list: picks } = pickThisWeek(meetups, 6);
  const hasSample = picks.some((m) => m.is_sample);
  // 특집 배치(승인 시안): 짙은 남색 · 베이지 / 아래 넓은 돌 회색 = 표지 인물. 그래서 순서를 뒤집어 표지 인물이 넓은 칸에
  const featured = people.slice(0, 3).reverse();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      {/* 2. 이번 호의 사람들 */}
      {featured.length > 0 && (
        <section className="mt-16 sm:mt-28" aria-labelledby="hosts-title" data-testid="home-creators">
          <Head en="Meet the creators" title="이번 호의 사람들" id="hosts-title" href="/hosts" more="모든 크리에이터" />
          <div className="mt-5 grid gap-4 sm:mt-7 sm:gap-6 lg:grid-cols-[7fr_5fr]">
            {featured.map((h, i) => (
              <CreatorFeature key={h.user_id} host={h} tone={i} program={firstProgramOf(meetups, h.user_id)} wide={i === 2 && featured.length === 3} />
            ))}
          </div>
        </section>
      )}

      {/* 3. 그 사람을 만나는 방법 */}
      <section className="mt-16 sm:mt-28" aria-labelledby="picks-title" data-testid="home-this-week">
        <Head en="Ways to meet" title="그 사람을 만나는 방법" id="picks-title" href="/meetups" more="모든 프로그램" />
        {picks.length ? (
          <div className="mt-1" data-testid="meetup-grid">
            {picks.map((m, i) => (
              <MeetupRow key={m.id} meetup={m} index={i} categoryName={names[m.category_slug] ?? m.category_slug} />
            ))}
          </div>
        ) : (
          <p className="py-12 text-center text-muted-foreground">곧 첫 프로그램이 열립니다.</p>
        )}
        {hasSample && (
          <p className="mt-4 rounded-xl bg-notice px-4 py-3 text-[13px] text-notice-foreground" data-testid="sample-notice">
            <strong>샘플</strong> 표시가 있는 프로그램은 서비스 준비 중 보여 드리는 예시예요. 아직 신청할 수 없어요.
          </p>
        )}
      </section>

      {/* 4. 세 분야 (목차처럼) */}
      <section className="mt-16 sm:mt-24" aria-labelledby="fields-title" data-testid="home-pillars">
        <Head en="Three fields" title="세 가지 분야" id="fields-title" />
        <ol className="grid sm:grid-cols-3">
          {PILLARS.map((p, i) => (
            <li key={p.slug} className="border-b border-border sm:border-r sm:border-b-0 sm:last:border-r-0">
              <Link href={`/meetups?pillar=${p.slug}`} className="group flex items-start gap-4 py-5 sm:flex-col sm:gap-2 sm:px-5 sm:py-7 sm:first:pl-0" data-testid="pillar-tile">
                <span className="text-[28px] leading-none font-light text-ember sm:text-[36px]">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block text-[11px] font-extrabold tracking-[0.24em]">{p.label.toUpperCase()}</span>
                  <span className="mt-1 block text-[17px] font-bold tracking-[-0.02em] group-hover:underline group-hover:underline-offset-4">{p.ko}</span>
                  <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
                    {p.description.split(" — ")[0]}
                    {pillarCounts[p.slug] ? ` · ${pillarCounts[p.slug]}개 프로그램` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* 5. 저널 (실제 공개된 글만) */}
      {contents.length > 0 && (
        <section className="mt-16 sm:mt-28" aria-labelledby="journal-title" data-testid="home-journal">
          <Head en={`${brand.name} Journal`} title="사람의 이야기를 읽다" id="journal-title" href="/journal" />
          <ul className="mt-6 grid gap-5 sm:grid-cols-3">
            {contents.map((c) => (
              <li key={c.id}>
                <ContentCard content={c} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 6. 경험 원칙 */}
      <section className="mt-16 sm:mt-28" aria-labelledby="exp-title">
        <Head en={`The ${brand.name} experience`} title={<>모임이 아니라,<br />한 사람의 세계에 들어갑니다.</>} id="exp-title" />
        <div className="mt-6 grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="relative aspect-[16/11] overflow-hidden rounded-[4px] bg-forest-deep">
            <Image src="/images/home/hero.jpg" alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            <span className="absolute bottom-2.5 left-3 text-[10px] tracking-[0.06em] text-white/80">분위기 참고 이미지</span>
          </div>
          <ol>
            {[
              ["4~10명, 작은 자리", "한 사람 한 사람이 보이는 인원으로만 엽니다."],
              ["사람이 먼저", "무엇을 할지보다 누구와 할지를 먼저 고릅니다."],
              ["손에 남는 것", "사진 한 장, 노래 한 소절, 말하기 3분이 남습니다."],
            ].map(([t, b], i) => (
              <li key={t} className="grid grid-cols-[56px_1fr] border-b border-border py-5 last:border-0">
                <span className="text-[32px] leading-none font-light text-ember sm:text-[40px]">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <b className="block text-[17px] sm:text-[21px]">{t}</b>
                  <span className="mt-1 block text-[13.5px] text-muted-foreground sm:text-[14.5px]">{b}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

/** 이번 호의 사람들 — 한 사람의 특집. 인용문은 본인이 쓴 작업 철학만 */
function CreatorFeature({ host, tone, program, wide }: { host: HostDetail; tone: number; program?: MeetupCardData; wide?: boolean }) {
  const t = TONES[tone % TONES.length];
  const photo = creatorPhoto(host);
  const pillar = pillarInfo(host.primary_pillar);
  const quote = host.philosophy?.trim();
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[4px]",
        t.box,
        wide ? "grid lg:col-span-2 lg:grid-cols-[1.3fr_1fr]" : tone === 0 ? "grid sm:grid-cols-[300px_1fr]" : "flex flex-col",
      )}
      data-testid="creator-tile"
    >
      <div className={cn("relative overflow-hidden bg-black/10", wide ? "h-[300px] lg:order-2 lg:h-auto lg:min-h-[420px]" : tone === 0 ? "h-[420px] sm:h-auto sm:min-h-[520px]" : "h-[260px]")}>
        <Photo
          src={photo}
          alt={`${host.display_name} 사진`}
          sizes="(min-width: 1024px) 40vw, 100vw"
          fallback={<span aria-hidden className="absolute inset-0 flex items-center justify-center font-display text-7xl opacity-60">{host.display_name.slice(0, 1)}</span>}
          className={wide ? "object-[50%_14%]" : "object-top"}
        />
      </div>
      <div className={cn("flex flex-col p-5 sm:p-8", wide && "lg:order-1 lg:p-11")}>
        <p className={cn("text-[10.5px] font-bold tracking-[0.26em] uppercase", t.sub)}>
          {pillar?.label}
          {host.expertise[0] ? ` · ${host.expertise[0]}` : ""}
        </p>
        <Link href={hostHref(host)} className="mt-3 block text-[36px] leading-none font-extrabold tracking-[-0.04em] hover:underline hover:underline-offset-4 sm:text-[48px]">
          {host.display_name}
        </Link>
        <p className={cn("mt-2 text-[13px]", t.sub)}>{host.occupation || host.headline}</p>
        {quote ? (
          <p className={cn("mt-5 font-display break-keep whitespace-pre-line", wide ? "text-[24px] leading-[1.5] sm:text-[34px]" : "text-[19px] leading-[1.55] sm:text-[22px]")}>
            “{quote}”
          </p>
        ) : (
          <p className={cn("mt-5 text-[14px]", t.sub)}>{host.bio ? host.bio.slice(0, 80) : "곧 자기만의 이야기를 들려줄 크리에이터예요."}</p>
        )}
        {program && (
          <Link href={`/meetups/${program.id}`} className={cn("mt-auto flex items-center justify-between gap-3 border-t pt-3 text-[13px] hover:underline hover:underline-offset-4", t.line, "mt-8")}>
            <span className="truncate">
              <b>{program.title}</b>
            </span>
            <ArrowRight aria-hidden className="size-4 shrink-0" strokeWidth={1.8} />
          </Link>
        )}
      </div>
    </article>
  );
}

/* ---------- 7. 크리에이터 모집 + 실제 심사 기준 ---------- */

const CURATION = [
  { title: "크리에이터 심사", body: "작업과 기획안을 운영팀이 직접 확인해요." },
  { title: "공개 전 검수", body: "모든 프로그램과 글은 검수를 거친 뒤에만 공개돼요." },
  { title: "작은 정원", body: "한 사람 한 사람을 볼 수 있는 인원으로만 열어요." },
];

function JoinBand() {
  return (
    <section className="relative mt-20 overflow-hidden bg-forest-deep text-[#f3f0ea] sm:mt-32" aria-labelledby="join-title">
      <LogoSymbol className="pointer-events-none absolute top-1/2 -right-16 w-[260px] -translate-y-1/2 opacity-[0.07] sm:w-[440px]" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div>
          <p className="text-[10.5px] font-bold tracking-[0.26em] text-[#f3f0ea]/70 uppercase">Become a creator</p>
          <h2 id="join-title" className="mt-3 text-[40px] leading-[1.05] font-extrabold tracking-[-0.05em] break-keep sm:text-[76px]">
            팔로워가 아니라
            <br />
            당신의 관점을 봅니다.
          </h2>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-[#f3f0ea]/80 sm:text-[17px]">
            자기만의 강점과 이야기가 있다면 충분해요. 질문으로 함께 찾고, 첫 프로그램도 함께 기획하고, 가입비 없이 판매될 때만 나눕니다.
          </p>
          <Link
            href="/apply"
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-[#f3f0ea] px-6 text-[14.5px] font-bold text-forest-deep hover:bg-white"
          >
            크리에이터로 지원하기
            <ArrowRight aria-hidden className="size-4" strokeWidth={1.8} />
          </Link>
        </div>
        <div className="border-t border-white/15 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10" data-testid="home-curation">
          <p className="text-[10.5px] font-bold tracking-[0.26em] text-[#f3f0ea]/70 uppercase">Curation</p>
          <ul className="mt-4 flex flex-col gap-4">
            {CURATION.map((c) => (
              <li key={c.title} className="flex gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/12">
                  <Check aria-hidden className="size-3" strokeWidth={2.6} />
                </span>
                <span>
                  <b className="block text-sm">{c.title}</b>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-[#f3f0ea]/70">{c.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function CoverSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
      <div className="h-24 w-full animate-pulse rounded bg-muted sm:h-40" />
      <div className="mt-6 aspect-[4/5] w-full animate-pulse rounded bg-muted lg:hidden" />
    </div>
  );
}

async function CoverFromData() {
  const { meetups, people } = await homeData();
  return <MagazineCover meetups={meetups} people={people} />;
}

export const metadata = { title: "라운디 이야기" };

export default function About() {
  return (
    <Blue>
      <SiteHeader masthead />
      <main className="flex-1">
        <Suspense fallback={<CoverSkeleton />}>
          <CoverFromData />
        </Suspense>
        <Suspense fallback={null}>
          <Sections />
        </Suspense>
        <JoinBand />
      </main>
      <SiteFooter />
    </Blue>
  );
}
