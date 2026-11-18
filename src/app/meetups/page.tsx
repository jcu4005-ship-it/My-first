import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/layout/page-parts";
import { CategoryChips } from "@/components/meetups/category-chips";
import { MeetupGrid } from "@/components/meetups/meetup-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PILLARS, isPillar, pillarInfo } from "@/config/pillars";
import { listCategories, listUpcomingMeetups } from "@/lib/meetups/queries";
import { normalizeQuery, searchMeetups } from "@/lib/meetups/search";

export const metadata: Metadata = { title: "프로그램 둘러보기" };
export const instant = false;

export default async function MeetupsPage({ searchParams }: PageProps<"/meetups">) {
  const sp = (await searchParams) as { category?: string; pillar?: string; q?: string };
  const q = normalizeQuery(sp.q);
  const categories = await listCategories();
  const active = categories.find((c) => c.slug === sp.category);
  // 세부 분야를 고르면 그 분야의 대분류가 자동으로 선택됨
  const pillar = active?.pillar ?? (isPillar(sp.pillar) ? sp.pillar : undefined);
  const pillarCategories = pillar ? categories.filter((c) => c.pillar === pillar) : categories;
  // 한 번만 읽고 화면에서 나눔: 세부 분야 칩에 개수를 보여 주고, 프로그램이 없는 분야는 숨기기 위해
  const all = await listUpcomingMeetups();
  const pillarSlugs = new Set(pillarCategories.map((c) => c.slug));
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const inScope = all.filter((m) => (active ? m.category_slug === active.slug : pillar ? pillarSlugs.has(m.category_slug) : true));
  const meetups = searchMeetups(inScope, q, { categoryName: (slug) => names[slug] });
  const counts = all.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.category_slug]: (acc[m.category_slug] ?? 0) + 1 }), {});
  const chipCategories = pillarCategories.filter((c) => counts[c.slug] || c.slug === active?.slug);
  const info = pillarInfo(pillar);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          title={active ? active.name : info ? info.ko : "모든 프로그램"}
          description={active ? active.description : info ? info.description : "검증된 전문가와 함께하는, 곧 열리는 프로그램을 가까운 날짜 순으로 보여 드려요."}
        >
          <nav aria-label="대분류" className="mt-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-linen p-1 no-scrollbar">
            {[{ slug: undefined, label: "All", ko: "전체" }, ...PILLARS].map((p) => (
              <Link
                key={p.label}
                href={p.slug ? `/meetups?pillar=${p.slug}` : "/meetups"}
                aria-current={pillar === p.slug ? "page" : undefined}
                data-testid="pillar-tab"
                className={`shrink-0 rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors ${pillar === p.slug ? "bg-white font-semibold text-forest shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {p.ko}
                <span className="sr-only"> ({p.label})</span>
              </Link>
            ))}
          </nav>
          <form action="/meetups" method="get" role="search" className="mt-5 flex max-w-md gap-2" data-testid="program-search">
            {active ? <input type="hidden" name="category" value={active.slug} /> : pillar && <input type="hidden" name="pillar" value={pillar} />}
            <label htmlFor="search" className="sr-only">프로그램 검색</label>
            <input
              id="search"
              name="q"
              type="search"
              defaultValue={q}
              maxLength={40}
              placeholder="프로그램, 크리에이터, 동네로 검색 (예: 사진, 용산)"
              className="h-12 min-w-0 flex-1 rounded-full border border-border bg-white px-5 text-base placeholder:text-muted-foreground focus:border-foreground focus:outline-none sm:text-sm"
            />
            <button type="submit" className="h-12 shrink-0 rounded-full bg-foreground px-6 text-sm font-semibold text-background hover:bg-foreground/90">검색</button>
          </form>
        </PageHero>
        <div className="sticky top-16 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <CategoryChips categories={chipCategories} counts={counts} active={active?.slug} allHref={pillar ? `/meetups?pillar=${pillar}` : "/meetups"} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
          <p className="mb-5 text-sm text-muted-foreground" data-testid="result-count">
            {q ? (
              <>
                &ldquo;{q}&rdquo; 검색 결과 {meetups.length}개 ·{" "}
                <Link href={active ? `/meetups?category=${active.slug}` : pillar ? `/meetups?pillar=${pillar}` : "/meetups"} className="underline underline-offset-4" data-testid="clear-search">
                  검색 지우기
                </Link>
              </>
            ) : (
              <>{meetups.length}개의 프로그램</>
            )}
          </p>
          {meetups.some((m) => m.is_sample) && (
            <p className="mb-6 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground">
              &lsquo;샘플&rsquo; 표시가 있는 프로그램은 서비스 준비 중 보여 드리는 예시입니다.
            </p>
          )}
          {meetups.length ? (
            <MeetupGrid meetups={meetups} categoryNames={names} pillarOf={Object.fromEntries(categories.map((c) => [c.slug, c.pillar]))} />
          ) : q ? (
            <div className="rounded-3xl border border-dashed border-border px-6 py-16 text-center" data-testid="search-empty">
              <p className="text-xl font-extrabold">&ldquo;{q}&rdquo;에 맞는 프로그램이 없어요</p>
              <p className="mt-2 text-sm text-muted-foreground">다른 단어로 찾아보거나, 크리에이터를 먼저 둘러보세요.</p>
              <Link href={`/hosts?q=${encodeURIComponent(q)}`} className="mt-5 inline-block text-sm font-semibold underline-offset-4 hover:underline">
                크리에이터에서 &ldquo;{q}&rdquo; 찾기
              </Link>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border px-6 py-16 text-center" data-testid="empty-state">
              <p className="font-display text-xl font-bold text-forest">아직 열린 프로그램이 없어요</p>
              <p className="mt-2 text-sm text-muted-foreground">
                곧 새로운 프로그램이 열립니다. 이 분야의 전문가라면 호스트로 신청해 주세요.
              </p>
              <Link href="/become-a-host/apply" className="mt-5 inline-block text-sm font-semibold text-forest underline-offset-4 hover:underline">
                호스트 지원하기
              </Link>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
