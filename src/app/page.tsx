import Link from "next/link";
import { Suspense } from "react";

import { brand } from "@/config/brand";
import { brandImages } from "@/config/brand-images";
import { Photo } from "@/components/media/photo";
import { categoryStyle } from "@/components/meetups/category-style";
import { ExhibitionGallery, type GalleryItem } from "@/components/meetups/exhibition-gallery";
import { HostCard } from "@/components/hosts/host-card";
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
        <p className="eyebrow text-muted-foreground">Learn from people worth learning from</p>
        <h1 id="hero-title" className="mt-5 max-w-4xl font-display text-[2.75rem] leading-[1.08] font-medium sm:text-8xl">
          {brand.englishTagline}
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-sand sm:text-lg">{brand.tagline}</p>
        <div className="mt-10 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
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
  // 갤러리: 분야마다 가장 가까운 프로그램 하나씩 (분야 순서대로)
  const gallery: GalleryItem[] = categories.flatMap((c) => {
    const m = meetups.find((x) => x.category_slug === c.slug);
    return m
      ? [{
          id: m.id,
          title: m.title,
          summary: m.summary,
          categorySlug: c.slug,
          categoryLabel: categoryStyle(c.slug).label,
          categoryName: c.name,
          area: m.nextSession.area,
          coverUrl: m.cover_image_url,
          isSample: m.is_sample,
        }]
      : [];
  });

  return (
    <>
      {/* 2. DISCOVER NEW EXPERIENCES — 전시장 갤러리 */}
      <section className="section-dark overflow-hidden" aria-labelledby="discover-title">
        <div className="mx-auto w-full max-w-7xl px-4 pt-20 sm:px-8 sm:pt-28">
          <SectionHeading eyebrow="Discover New Experiences" title="오늘의 취향을 따라, 새로운 경험으로" id="discover-title" />
        </div>
        {gallery.length > 0 ? (
          <ExhibitionGallery items={gallery} />
        ) : (
          <p className="py-16 text-center text-muted-foreground">곧 첫 프로그램이 열립니다.</p>
        )}
        <nav aria-label="분야별 프로그램" className="mx-auto mt-14 w-full max-w-7xl px-4 pb-20 sm:px-8 sm:pb-28">
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-3 border-t pt-8">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/meetups?category=${c.slug}`} className="eyebrow text-muted-foreground transition-colors hover:text-sand-light" data-testid="category-tile">
                  {categoryStyle(c.slug).label}
                  <span className="sr-only"> {c.name}</span>
                  {counts[c.slug] ? <span className="ml-1.5 opacity-60">{counts[c.slug]}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      {/* 3. TRENDING EXPERIENCES */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-24 sm:px-8 sm:pt-32" aria-labelledby="trending-title">
        <SectionHeading eyebrow="Trending Experiences" title="지금 많이 찾는 프로그램" id="trending-title">
          <Link href="/meetups" className="eyebrow self-start border-b border-current pb-1 sm:self-auto">
            View all
            <span className="sr-only"> 모든 프로그램 보기</span>
          </Link>
        </SectionHeading>
        {hasSample && (
          <p className="mb-10 bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="sample-notice">
            지금 보이는 프로그램은 서비스 준비 중 보여 드리는 <strong>샘플</strong>입니다. 실제로 신청할 수 없어요.
          </p>
        )}
        {trending.length ? (
          // 휴대폰: 옆으로 넘기는 한 줄 (다음 카드가 살짝 보이게), 태블릿·PC: 격자
          <div className="relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 sm:snap-none sm:grid-cols-2 sm:gap-x-6 sm:gap-y-14 lg:grid-cols-3" data-testid="meetup-grid">
            {trending.map((m) => (
              <div key={m.id} className="w-[78vw] max-w-[22rem] shrink-0 snap-start sm:w-auto sm:max-w-none">
                <MeetupCard meetup={m} categoryName={names[m.category_slug] ?? m.category_slug} />
              </div>
            ))}
          </div>
        ) : (
          <p className="py-16 text-center text-muted-foreground">곧 첫 프로그램이 열립니다.</p>
        )}
      </section>

      {/* 4. FEATURED HOSTS (운영팀 추천 먼저) */}
      {hosts.length > 0 && (
        <section className="mt-24 bg-sand sm:mt-32" aria-labelledby="hosts-title">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-8 sm:py-28">
            <SectionHeading eyebrow="Featured Hosts" title="프로그램을 여는 사람들" id="hosts-title">
              <Link href="/hosts" className="eyebrow self-start border-b border-current pb-1 sm:self-auto">
                All hosts
                <span className="sr-only"> 모든 호스트 보기</span>
              </Link>
            </SectionHeading>
            <ul className="relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 sm:snap-none sm:grid-cols-2 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4">
              {hosts.map((h) => (
                <li key={h.user_id} className="flex w-[62vw] max-w-[17rem] shrink-0 snap-start flex-col sm:w-auto sm:max-w-none">
                  <HostCard host={h} representative={firstClassOf(h.user_id)} />
                </li>
              ))}
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
  { no: "02", title: "검증된 호스트", body: "운영팀이 경력과 포트폴리오를 확인한 전문가와 크리에이터만 프로그램을 열어요." },
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
            입장료 없이, 프로그램이 판매될 때만 함께 나눠요. 경력과 포트폴리오를 보내 주시면 운영팀이 확인 후 승인해 드려요.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-3 sm:flex">
            <Button asChild size="lg">
              <Link href="/become-a-host/apply">호스트 지원하기</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/become-a-host">호스트 정책 보기</Link>
            </Button>
          </div>
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
              "나만의 프로그램을 만들어 보고 싶은 크리에이터",
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
