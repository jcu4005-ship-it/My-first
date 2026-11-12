import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { HostCard } from "@/components/hosts/host-card";
import { PageHero, SectionTitle } from "@/components/layout/page-parts";
import { chipClass } from "@/components/meetups/category-chips";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PILLARS, isPillar, pillarInfo } from "@/config/pillars";
import { listHosts } from "@/lib/meetups/queries";

export const instant = false;
export const metadata: Metadata = { title: "호스트", description: "운영팀이 경력과 포트폴리오를 확인한 호스트를 소개합니다." };

type Search = { pillar?: string; q?: string };

function PillarTabs({ active, q }: { active?: string; q?: string }) {
  const href = (p?: string) => {
    const params = new URLSearchParams();
    if (p) params.set("pillar", p);
    if (q) params.set("q", q);
    const s = params.toString();
    return s ? `/hosts?${s}` : "/hosts";
  };
  const tab = chipClass;
  return (
    <nav aria-label="분류" className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 py-3">
        <li><Link href={href()} className={tab(!active)} aria-current={!active ? "page" : undefined} data-testid="pillar-tab">전체</Link></li>
        {PILLARS.map((p) => (
          <li key={p.slug}>
            <Link href={href(p.slug)} className={tab(active === p.slug)} aria-current={active === p.slug ? "page" : undefined} data-testid="pillar-tab">
              {p.ko}
              <span className="sr-only"> ({p.label})</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

async function HostList({ pillar, q }: { pillar?: "knowledge" | "creators" | "experts"; q?: string }) {
  const hosts = await listHosts({ pillar, q });
  const browsing = !pillar && !q;
  const featured = browsing ? hosts.filter((h) => h.is_featured).sort((a, b) => (a.featured_order ?? 99) - (b.featured_order ?? 99)) : [];
  return (
    <>
      {featured.length > 0 && (
        <section className="mb-12" aria-labelledby="featured-title" data-testid="featured-hosts">
          <SectionTitle id="featured-title" description="추천은 운영팀이 직접 고릅니다. 팔로워 수와는 관계없어요.">이번에 소개하는 호스트</SectionTitle>
          <div className="relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
            {featured.map((h) => (
              <HostCard key={h.user_id} host={h} representative={h.representative} className="w-[76vw] max-w-[20rem] shrink-0 snap-start sm:w-auto sm:max-w-none" />
            ))}
          </div>
        </section>
      )}
      <section aria-labelledby="all-hosts-title">
        <h2 id="all-hosts-title" className="mb-5 font-display text-2xl font-bold text-forest" data-testid="host-count">
          {q ? `"${q}" 검색 결과 ${hosts.length}명` : `${pillarInfo(pillar)?.ko ?? "모든"} 호스트 ${hosts.length}명`}
        </h2>
        {hosts.length ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {hosts.map((h) => (
              <li key={h.user_id}>
                <HostCard host={h} representative={h.representative} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-3xl border border-dashed border-border px-6 py-16 text-center" data-testid="empty-state">
            <p className="font-display text-xl font-bold text-forest">{q ? "찾는 호스트가 없어요" : "아직 이 분류의 호스트가 없어요"}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              {q ? "다른 이름이나 분야로 검색해 보세요." : "이 분야의 전문가라면 호스트로 함께해 주세요."}
            </p>
            <Link href={q ? "/hosts" : "/become-a-host"} className="mt-5 inline-block text-sm font-semibold text-forest underline-offset-4 hover:underline">
              {q ? "전체 호스트 보기" : "호스트 지원 안내"}
            </Link>
          </div>
        )}
      </section>
    </>
  );
}

export default async function HostsPage({ searchParams }: PageProps<"/hosts">) {
  const sp = (await searchParams) as Search;
  const pillar = isPillar(sp.pillar) ? sp.pillar : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 40) : "";
  const info = pillarInfo(pillar);
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          title={info ? info.ko : "프로그램을 여는 사람들"}
          description={info ? info.description : "운영팀이 경력과 포트폴리오를 확인한 호스트만 소개합니다."}
        >
          <form action="/hosts" method="get" role="search" className="mt-6 flex max-w-md gap-2" data-testid="host-search">
            {pillar && <input type="hidden" name="pillar" value={pillar} />}
            <label htmlFor="host-q" className="sr-only">호스트 검색</label>
            <input
              id="host-q"
              name="q"
              defaultValue={q}
              maxLength={40}
              placeholder="이름, 분야로 검색 (예: 사진, 철학)"
              className="h-12 min-w-0 flex-1 rounded-full border border-border bg-white px-5 text-base placeholder:text-muted-foreground focus:border-forest focus:outline-none sm:text-sm"
            />
            <button type="submit" className="h-12 shrink-0 rounded-full bg-forest px-6 text-sm font-semibold text-white hover:bg-forest/90">검색</button>
          </form>
        </PageHero>
        <div className="sticky top-16 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <PillarTabs active={pillar} q={q || undefined} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
          <Suspense fallback={<div className="h-40 w-full max-w-xs animate-pulse rounded-2xl bg-muted" />}>
            <HostList pillar={pillar} q={q || undefined} />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
