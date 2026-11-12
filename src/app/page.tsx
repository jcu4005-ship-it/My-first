import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Suspense } from "react";

import { brand } from "@/config/brand";
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

/* ---------- 1. 첫 화면 ---------- */

function Hero() {
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      {/* 장식: 은은한 초록 원 (사진이 준비되기 전) */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-[28rem] rounded-full bg-mint/35 blur-3xl sm:size-[36rem]" />
      <div className="relative mx-auto w-full max-w-6xl px-4 pt-12 pb-12 sm:px-6 sm:pt-20 sm:pb-16">
        <h1 id="hero-title" className="max-w-2xl font-display text-[2.1rem] leading-[1.25] font-bold break-keep text-forest sm:text-6xl sm:leading-[1.2]">
          어제보다 나은 나를
          <br />
          발견하는 시간.
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">{brand.tagline}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/meetups">
              프로그램 둘러보기
              <ArrowRight aria-hidden strokeWidth={1.8} />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-forest">
            <Link href="/become-a-host">호스트 지원</Link>
          </Button>
        </div>
      </div>
    </section>
  );
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
  const hasSample = picks.some((m) => m.is_sample);
  const firstClassOf = (hostId: string) => meetups.find((m) => m.host?.user_id === hostId);

  return (
    <>
      {/* 2. 세 갈래 */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6" aria-label="분야로 찾기" data-testid="home-pillars">
        <ul className="grid grid-cols-3 gap-2 sm:gap-4">
          {PILLARS.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/meetups?pillar=${p.slug}`}
                className="flex h-full flex-col rounded-2xl border border-border/70 bg-card px-3 py-4 transition-colors hover:border-forest/40 sm:px-5 sm:py-5"
                data-testid="pillar-tile"
              >
                <span className="text-[15px] font-semibold text-forest sm:text-lg">{p.ko}</span>
                <span className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">{p.label}</span>
                <span className="mt-3 hidden text-sm leading-relaxed text-muted-foreground sm:block">{p.description}</span>
                <span className="mt-3 text-xs font-medium text-forest">
                  {pillarCounts[p.slug] ? `${pillarCounts[p.slug]}개 프로그램` : "둘러보기"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. 추천 프로그램 */}
      <section className="mt-10 bg-linen/60 py-10 sm:mt-14 sm:rounded-none sm:py-14" aria-labelledby="picks-title" data-testid="home-this-week">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <SectionHeading title={thisWeek ? "이번 주 추천" : "곧 열리는 프로그램"} id="picks-title" href="/meetups" />
          {hasSample && (
            <p className="mb-5 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="sample-notice">
              지금 보이는 프로그램은 서비스 준비 중 보여 드리는 <strong>샘플</strong>입니다. 실제로 신청할 수 없어요.
            </p>
          )}
          {picks.length ? (
            <div className={`${rail} sm:grid-cols-2 lg:grid-cols-3`} data-testid="meetup-grid">
              {picks.map((m) => (
                <div key={m.id} className={railItem}>
                  <MeetupCard meetup={m} categoryName={names[m.category_slug] ?? m.category_slug} />
                </div>
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-muted-foreground">곧 첫 프로그램이 열립니다.</p>
          )}
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
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 px-4 sm:grid-cols-3 sm:px-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}

/* ---------- 6. 믿을 수 있는 이유 (실제 운영 중인 절차만) + 멤버십(준비 중) + 호스트 지원 ---------- */

const CURATION = [
  { title: "호스트 심사", body: "경력·포트폴리오와 기획안을 운영팀이 직접 확인해요." },
  { title: "공개 전 검수", body: "모든 프로그램과 글은 검수를 거친 뒤에만 공개돼요." },
  { title: "작은 정원", body: "한 사람 한 사람을 볼 수 있는 인원으로 열어요." },
  { title: "추천은 사람이", body: "팔로워 수가 아니라 운영팀이 직접 골라요." },
];

function TrustAndJoin() {
  return (
    <section className="mx-auto mt-12 w-full max-w-6xl px-4 sm:mt-16 sm:px-6" aria-labelledby="curation-title">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-border/70 bg-card p-6 sm:p-8" data-testid="home-curation">
          <h2 id="curation-title" className="font-display text-2xl font-bold text-forest">
            아무나 열 수 없는 프로그램
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {CURATION.map((c) => (
              <li key={c.title} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest">
                  <Check aria-hidden className="size-3.5" strokeWidth={2.2} />
                </span>
                <span>
                  <span className="block font-semibold">{c.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{c.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4">
          <div id="host" className="flex flex-1 flex-col rounded-3xl bg-forest p-6 text-cream sm:p-8">
            <h2 className="font-display text-2xl font-bold">당신의 전문성을 새로운 경험으로</h2>
            <p className="mt-2 text-sm leading-relaxed text-cream/80">입장료 없이, 프로그램이 판매될 때만 함께 나눠요.</p>
            <div className="mt-auto pt-6">
              <Button asChild variant="secondary">
                <Link href="/become-a-host/apply">
                  호스트 지원하기
                  <ArrowRight aria-hidden strokeWidth={1.8} />
                </Link>
              </Button>
            </div>
          </div>
          <div className="rounded-3xl border border-dashed border-border p-5" data-testid="membership-soon">
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
        <Hero />
        <Suspense fallback={<SectionsSkeleton />}>
          <HomeSections />
        </Suspense>
        <TrustAndJoin />
      </main>
      <SiteFooter />
    </>
  );
}
