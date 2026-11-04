import Link from "next/link";
import { Suspense } from "react";

import { brand } from "@/config/brand";
import { brandImages } from "@/config/brand-images";
import { Photo } from "@/components/media/photo";
import { categoryStyle } from "@/components/meetups/category-style";
import { MeetupCard } from "@/components/meetups/meetup-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { listCategories, listFeaturedHosts, listUpcomingMeetups, type MeetupCardData } from "@/lib/meetups/queries";

/* ---------- 공통 조각 ---------- */

function SectionHeading({ eyebrow, title, id, children }: { eyebrow: string; title: string; id: string; children?: React.ReactNode }) {
  return (
    <div className="mb-10 flex flex-col gap-4 sm:mb-14 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow text-muted-foreground">{eyebrow}</p>
        <h2 id={id} className="mt-3 max-w-2xl font-display text-3xl leading-tight font-medium break-keep sm:text-5xl">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

/** 인기순: 예약률이 높은 순 (같으면 가까운 일정 순) */
function byPopularity(a: MeetupCardData, b: MeetupCardData) {
  const rate = (m: MeetupCardData) => m.nextSession.reserved_count / Math.max(1, m.nextSession.capacity);
  return rate(b) - rate(a) || a.nextSession.starts_at.localeCompare(b.nextSession.starts_at);
}

/* ---------- 1. HERO ---------- */

function Hero() {
  const img = brandImages.hero;
  return (
    <section className="section-dark relative isolate flex min-h-[86svh] items-end overflow-hidden" aria-labelledby="hero-title">
      {img ? (
        <>
          <Photo src={img.src} alt={img.alt} priority sizes="100vw" fallback={null} className="-z-10" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-espresso via-espresso/55 to-espresso/25" />
        </>
      ) : (
        // 사진이 준비되기 전: 큰 타이포그래피와 가는 선으로 구성한 표지
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-x-0 top-[22%] h-px bg-sand-light/10" />
          <div className="absolute top-0 bottom-0 left-[62%] hidden w-px bg-sand-light/10 sm:block" />
          <span className="absolute -right-[0.06em] -bottom-[0.18em] font-display text-[44vw] leading-none font-bold text-sand-light/[0.05] select-none sm:text-[30vw]">
            G
          </span>
        </div>
      )}
      <div className="mx-auto w-full max-w-7xl px-4 pt-40 pb-16 sm:px-8 sm:pb-24">
        <p className="eyebrow text-muted-foreground">Urban Lifestyle &amp; Culture Club</p>
        <h1 id="hero-title" className="mt-5 max-w-4xl font-display text-[2.75rem] leading-[1.08] font-medium sm:text-8xl">
          {brand.englishTagline}
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-sand sm:text-lg">{brand.tagline}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg" variant="secondary">
            <Link href="/meetups">지금 경험 둘러보기</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#club">{brand.name} 알아보기</Link>
          </Button>
        </div>
        {img?.credit && <p className="mt-10 text-[11px] text-muted-foreground">Photo · {img.credit}</p>}
      </div>
    </section>
  );
}

/* ---------- 2~4. 데이터가 필요한 섹션 ---------- */

async function DiscoverAndTrending() {
  const [categories, meetups, hosts] = await Promise.all([listCategories(), listUpcomingMeetups(), listFeaturedHosts(4)]);
  const counts = meetups.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.category_slug]: (acc[m.category_slug] ?? 0) + 1 }), {});
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const trending = [...meetups].sort(byPopularity).slice(0, 6);
  const hasSample = trending.some((m) => m.is_sample);
  const firstClassOf = (hostId: string) => meetups.find((m) => m.host?.user_id === hostId);

  return (
    <>
      {/* 2. DISCOVER NEW EXPERIENCES */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-24 sm:px-8 sm:pt-32" aria-labelledby="discover-title">
        <SectionHeading eyebrow="Discover New Experiences" title="오늘의 취향을 따라, 새로운 경험으로" id="discover-title" />
        <ul className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          {categories.map((c) => {
            const st = categoryStyle(c.slug);
            const img = brandImages.categories[c.slug];
            return (
              <li key={c.slug} className="bg-background">
                <Link
                  href={`/meetups?category=${c.slug}`}
                  className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden p-4 sm:aspect-[4/5] sm:p-6"
                  style={img ? undefined : { backgroundColor: st.bg, color: st.fg }}
                  data-testid="category-tile"
                >
                  {img && (
                    <>
                      <Photo src={img.src} alt={img.alt} sizes="(min-width: 640px) 25vw, 50vw" fallback={null}
                        className="transition-transform duration-700 group-hover:scale-105" />
                      <span className="absolute inset-0 bg-gradient-to-t from-espresso/80 to-transparent" />
                    </>
                  )}
                  <span aria-hidden className="absolute top-3 right-4 font-display text-6xl leading-none font-bold opacity-10 sm:text-8xl">
                    {st.label.slice(0, 1)}
                  </span>
                  <span className={`relative ${img ? "text-sand-light" : ""}`}>
                    <span className="eyebrow block">{st.label}</span>
                    <span className="mt-2 block font-display text-lg font-medium sm:text-2xl">{c.name}</span>
                    <span className="mt-1 block text-xs opacity-75">{counts[c.slug] ? `${counts[c.slug]}개 클래스` : "곧 열려요"}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 3. TRENDING EXPERIENCES */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-24 sm:px-8 sm:pt-32" aria-labelledby="trending-title">
        <SectionHeading eyebrow="Trending Experiences" title="지금 많이 찾는 클래스" id="trending-title">
          <Link href="/meetups" className="eyebrow self-start border-b border-current pb-1 sm:self-auto">
            View all
            <span className="sr-only"> 모든 클래스 보기</span>
          </Link>
        </SectionHeading>
        {hasSample && (
          <p className="mb-10 bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="sample-notice">
            지금 보이는 클래스는 서비스 준비 중 보여 드리는 <strong>샘플</strong>입니다. 실제로 신청할 수 없어요.
          </p>
        )}
        {trending.length ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3" data-testid="meetup-grid">
            {trending.map((m) => (
              <MeetupCard key={m.id} meetup={m} categoryName={names[m.category_slug] ?? m.category_slug} />
            ))}
          </div>
        ) : (
          <p className="py-16 text-center text-muted-foreground">곧 첫 클래스가 열립니다.</p>
        )}
      </section>

      {/* 4. OUR EXPERTS */}
      {hosts.length > 0 && (
        <section className="mt-24 bg-sand sm:mt-32" aria-labelledby="hosts-title">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-8 sm:py-28">
            <SectionHeading eyebrow="Our Experts" title="클래스를 여는 사람들" id="hosts-title">
              <Link href="/experts" className="eyebrow self-start border-b border-current pb-1 sm:self-auto">
                All experts
                <span className="sr-only"> 모든 전문가 보기</span>
              </Link>
            </SectionHeading>
            <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {hosts.map((h) => {
                const cls = firstClassOf(h.user_id);
                return (
                  <li key={h.user_id} className="flex flex-col">
                    <Link href={`/hosts/${h.user_id}`} className="group flex flex-col" data-testid="expert-card">
                      <span className="relative flex aspect-[4/5] items-end overflow-hidden bg-espresso p-5 text-sand-light">
                        <span aria-hidden className="absolute -top-4 -right-2 font-display text-[9rem] leading-none font-bold opacity-[0.08]">
                          {h.display_name.slice(0, 1)}
                        </span>
                        <span className="relative eyebrow text-sand">{h.expertise.slice(0, 2).join(" · ") || "Expert"}</span>
                      </span>
                      <span className="mt-4 font-display text-xl font-medium group-hover:underline group-hover:underline-offset-4">
                        {h.display_name}
                      </span>
                      <span className="mt-1 text-sm leading-relaxed text-muted-foreground">{h.headline}</span>
                      {h.is_sample && <span className="mt-1 text-[11px] text-muted-foreground">샘플 호스트</span>}
                    </Link>
                    {cls && (
                      <Link href={`/meetups/${cls.id}`} className="mt-3 border-t border-espresso/20 pt-3 text-sm hover:underline hover:underline-offset-4">
                        <span className="eyebrow mr-2 text-muted-foreground">Class</span>
                        {cls.title}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}

function SectionsSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 pt-24 sm:grid-cols-3 sm:px-8">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse bg-muted" />
      ))}
    </div>
  );
}

/* ---------- 5. GATHERING CLUB ---------- */

const CLUB_POINTS = [
  { no: "01", title: "적은 인원, 깊은 대화", body: "한 사람 한 사람에게 눈을 맞출 수 있는 인원으로 열어요." },
  { no: "02", title: "검증된 호스트", body: "운영팀이 경력과 포트폴리오를 확인한 전문가와 크리에이터만 클래스를 열어요." },
  { no: "03", title: "수업 그 다음", body: "같은 것에 마음이 움직인 사람들과 자연스럽게 이야기가 이어져요." },
];

function Club() {
  const img = brandImages.club;
  return (
    <section id="club" className="section-dark mt-24 scroll-mt-8 sm:mt-32" aria-labelledby="club-title">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:gap-20">
        <div className="relative min-h-[22rem] overflow-hidden bg-espresso-soft">
          {img ? (
            <Photo src={img.src} alt={img.alt} sizes="(min-width: 1024px) 50vw, 100vw" fallback={null} />
          ) : (
            <div aria-hidden className="absolute inset-0 flex flex-col justify-between p-8">
              <span className="eyebrow text-muted-foreground">{brand.name} Club</span>
              <span className="font-display text-7xl leading-[0.95] font-medium text-sand/80 sm:text-8xl">
                Learn.
                <br />
                Meet.
                <br />
                Stay.
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center">
          <p className="eyebrow text-muted-foreground">{brand.name} Club</p>
          <h2 id="club-title" className="mt-4 font-display text-4xl leading-tight font-medium sm:text-6xl">
            More than a class.
            <br />A community.
          </h2>
          <p className="mt-6 max-w-md leading-relaxed text-sand">배움을 넘어, 새로운 사람과 연결되고 더 넓은 세상을 만나는 곳.</p>
          <ol className="mt-12 flex flex-col">
            {CLUB_POINTS.map((p) => (
              <li key={p.no} className="grid grid-cols-[3rem_1fr] gap-2 border-t py-5">
                <span className="eyebrow pt-1 text-muted-foreground">{p.no}</span>
                <span>
                  <span className="block font-medium">{p.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{p.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* 6. ORIGINALS — 실제 운영 중인 Originals 프로그램이 생기면 추가합니다 (지금은 숨김). */

/* ---------- 7. BECOME A HOST ---------- */

function BecomeHost() {
  const img = brandImages.host;
  return (
    <section id="host" className="mx-auto w-full max-w-7xl px-4 pt-24 sm:px-8 sm:pt-32" aria-labelledby="host-title">
      <div className="grid gap-10 border-t border-espresso pt-12 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
        <div>
          <p className="eyebrow text-muted-foreground">Become a Host</p>
          <h2 id="host-title" className="mt-4 font-display text-4xl leading-tight font-medium break-keep sm:text-6xl">
            당신의 전문성을 새로운 경험으로.
          </h2>
          <p className="mt-6 max-w-lg leading-relaxed text-muted-foreground">
            경력과 포트폴리오를 보내 주시면 운영팀이 확인 후 승인해 드려요. 승인되면 바로 클래스를 만들고 참가자를 모집할 수 있어요.
          </p>
          <Button asChild size="lg" className="mt-10">
            <Link href="/host/apply">호스트 지원하기</Link>
          </Button>
        </div>
        <div className="flex flex-col">
          {img && (
            <div className="relative mb-8 aspect-[4/3] overflow-hidden">
              <Photo src={img.src} alt={img.alt} sizes="(min-width: 1024px) 40vw, 100vw" fallback={null} />
            </div>
          )}
          <ul className="flex flex-col">
            {[
              "자신의 전문성을 사람들과 나누고 싶은 분",
              "나만의 클래스를 만들어 보고 싶은 크리에이터",
              `${brand.name}과 함께 새로운 경험을 기획하고 싶은 분`,
            ].map((t) => (
              <li key={t} className="border-b py-5 font-display text-lg">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <div className="relative">
        <SiteHeader overlay />
        <Hero />
      </div>
      <main className="flex-1">
        <Suspense fallback={<SectionsSkeleton />}>
          <DiscoverAndTrending />
        </Suspense>
        <Club />
        <BecomeHost />
      </main>
      <SiteFooter />
    </>
  );
}
