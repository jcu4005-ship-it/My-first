import type { Metadata } from "next";
import Link from "next/link";

import { Night } from "@/components/layout/night";
import { CategoryChips } from "@/components/meetups/category-chips";
import { CircleGrid } from "@/components/meetups/circle-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PILLARS, isPillar, pillarInfo } from "@/config/pillars";
import { listCategories, listUpcomingMeetups } from "@/lib/meetups/queries";
import { normalizeQuery, searchMeetups } from "@/lib/meetups/search";
import { getHostReviewSummaries } from "@/lib/reviews/queries";

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
  const trust = await getHostReviewSummaries(meetups.flatMap((m) => (m.host ? [m.host.user_id] : [])));

  return (
    <Night>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
          <h1 className="text-[34px] leading-tight font-display font-bold tracking-[-0.02em] break-keep sm:text-[52px]">
            {active ? active.name : info ? info.ko : "지금 열린 원"}
          </h1>
          <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">
            {active ? active.description : info ? info.description : "한 사람을 중심으로 4~10명이 둘러앉는 자리. 가까운 날짜 순으로 보여 드려요."}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <form action="/meetups" method="get" role="search" className="flex w-full gap-2 sm:max-w-md" data-testid="program-search">
              {active ? <input type="hidden" name="category" value={active.slug} /> : pillar && <input type="hidden" name="pillar" value={pillar} />}
              <label htmlFor="search" className="sr-only">프로그램 검색</label>
              <input
                id="search"
                name="q"
                type="search"
                defaultValue={q}
                maxLength={40}
                placeholder="무엇을, 누구에게 배우고 싶나요? (예: 사진, 용산)"
                className="h-12 min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none sm:text-sm"
              />
              <button type="submit" className="h-12 shrink-0 rounded-2xl bg-foreground px-5 text-sm font-bold text-background hover:bg-foreground/90">검색</button>
            </form>
            <nav aria-label="대분류" className="flex max-w-full gap-1.5 overflow-x-auto no-scrollbar">
              {[{ slug: undefined, label: "All", ko: "전체" }, ...PILLARS].map((p) => (
                <Link
                  key={p.label}
                  href={p.slug ? `/meetups?pillar=${p.slug}` : "/meetups"}
                  aria-current={pillar === p.slug ? "page" : undefined}
                  data-testid="pillar-tab"
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm whitespace-nowrap transition-colors ${pillar === p.slug ? "border-foreground bg-foreground font-bold text-background" : "border-border bg-card text-foreground/80 hover:border-foreground/40"}`}
                >
                  {p.ko}
                  <span className="sr-only"> ({p.label})</span>
                </Link>
              ))}
            </nav>
          </div>
        </section>
        <div className="sticky top-16 z-20 mt-3 border-b border-border/70 bg-background/95 backdrop-blur">
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
            <CircleGrid meetups={meetups} categoryNames={names} trust={trust} />
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
              <p className="text-xl font-extrabold">아직 열린 원이 없어요</p>
              <p className="mt-2 text-sm text-muted-foreground">
                곧 새로운 프로그램이 열립니다. 이 분야의 전문가라면 호스트로 신청해 주세요.
              </p>
              <Link href="/become-a-host/apply" className="mt-5 inline-block text-sm font-semibold text-gold underline-offset-4 hover:underline">
                호스트 지원하기
              </Link>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </Night>
  );
}
