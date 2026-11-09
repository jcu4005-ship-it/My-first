import type { Metadata } from "next";
import Link from "next/link";

import { CategoryChips } from "@/components/meetups/category-chips";
import { categoryStyle } from "@/components/meetups/category-style";
import { MeetupGrid } from "@/components/meetups/meetup-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PILLARS, isPillar, pillarInfo } from "@/config/pillars";
import { listCategories, listUpcomingMeetups } from "@/lib/meetups/queries";

export const metadata: Metadata = { title: "프로그램 둘러보기" };
export const instant = false;

export default async function MeetupsPage({ searchParams }: PageProps<"/meetups">) {
  const sp = (await searchParams) as { category?: string; pillar?: string };
  const categories = await listCategories();
  const active = categories.find((c) => c.slug === sp.category);
  // 세부 분야를 고르면 그 분야의 대분류가 자동으로 선택됨
  const pillar = active?.pillar ?? (isPillar(sp.pillar) ? sp.pillar : undefined);
  const pillarCategories = pillar ? categories.filter((c) => c.pillar === pillar) : categories;
  const meetups = await listUpcomingMeetups(
    active ? { category: active.slug } : pillar ? { categories: pillarCategories.map((c) => c.slug) } : {},
  );
  const info = pillarInfo(pillar);
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="section-dark">
          <div className="mx-auto w-full max-w-7xl px-4 pt-14 pb-12 sm:px-8 sm:pt-20 sm:pb-16">
            <p className="eyebrow text-muted-foreground">
              {info ? info.label : "Programs"}
              {active && <> <span className="opacity-50">/</span> {categoryStyle(active.slug).label}</>}
            </p>
            <h1 className="mt-4 font-display text-4xl font-medium sm:text-6xl">{active ? active.name : info ? info.ko : "모든 프로그램"}</h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-sand sm:text-base">
              {active ? active.description : info ? info.description : "검증된 전문가와 함께하는, 곧 열리는 프로그램을 가까운 날짜 순으로 보여 드려요."}
            </p>
            <nav aria-label="대분류" className="mt-8 flex flex-wrap gap-2">
              {[{ slug: undefined, label: "All" }, ...PILLARS].map((p) => (
                <Link
                  key={p.label}
                  href={p.slug ? `/meetups?pillar=${p.slug}` : "/meetups"}
                  aria-current={pillar === p.slug ? "page" : undefined}
                  data-testid="pillar-tab"
                  className={`eyebrow border px-3 py-2 transition-colors ${pillar === p.slug ? "border-sand-light bg-sand-light text-espresso" : "border-sand-light/30 text-sand hover:border-sand-light"}`}
                >
                  {p.label}
                </Link>
              ))}
            </nav>
          </div>
        </section>
        <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-8">
            <CategoryChips categories={pillarCategories} active={active?.slug} allHref={pillar ? `/meetups?pillar=${pillar}` : "/meetups"} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-8 sm:pt-14">
          <p className="mb-8 text-sm text-muted-foreground" data-testid="result-count">
            {meetups.length}개의 프로그램
          </p>
          {meetups.some((m) => m.is_sample) && (
            <p className="mb-10 bg-notice px-4 py-3 text-sm text-notice-foreground">
              &lsquo;샘플&rsquo; 표시가 있는 프로그램은 서비스 준비 중 보여 드리는 예시입니다.
            </p>
          )}
          {meetups.length ? (
            <MeetupGrid meetups={meetups} categoryNames={names} />
          ) : (
            <div className="border-y py-24 text-center" data-testid="empty-state">
              <p className="font-display text-2xl">아직 열린 프로그램이 없어요</p>
              <p className="mt-3 text-sm text-muted-foreground">
                곧 새로운 프로그램이 열립니다. 이 분야의 전문가라면 호스트로 신청해 주세요.
              </p>
              <Link href="/host/apply" className="eyebrow mt-8 inline-block border-b border-current pb-1">
                Become a host
              </Link>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
