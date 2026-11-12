import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { HostCard } from "@/components/hosts/host-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PILLARS, isPillar, pillarInfo } from "@/config/pillars";
import { listHosts } from "@/lib/meetups/queries";
import { cn } from "@/lib/utils";

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
  const tab = (isActive: boolean) =>
    cn("block shrink-0 whitespace-nowrap border-b-2 py-4 text-sm transition-colors", isActive ? "border-foreground font-semibold" : "border-transparent text-muted-foreground hover:text-foreground");
  return (
    <nav aria-label="분류" className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-6 sm:gap-8">
        <li><Link href={href()} className={tab(!active)} aria-current={!active ? "page" : undefined} data-testid="pillar-tab">전체</Link></li>
        {PILLARS.map((p) => (
          <li key={p.slug}>
            <Link href={href(p.slug)} className={tab(active === p.slug)} aria-current={active === p.slug ? "page" : undefined} data-testid="pillar-tab">
              {p.label} <span className="text-xs opacity-70">{p.ko}</span>
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
        <section className="mb-16" aria-labelledby="featured-title" data-testid="featured-hosts">
          <p className="eyebrow text-muted-foreground">Featured Hosts</p>
          <h2 id="featured-title" className="mt-2 mb-8 font-display text-2xl font-medium">이번에 소개하는 호스트</h2>
          <div className="relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-x-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
            {featured.map((h) => (
              <HostCard key={h.user_id} host={h} representative={h.representative} className="w-[62vw] max-w-[17rem] shrink-0 snap-start sm:w-auto sm:max-w-none" />
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">추천은 운영팀이 직접 고릅니다. 팔로워 수와는 관계없어요.</p>
        </section>
      )}
      <section aria-labelledby="all-hosts-title">
        <p className="eyebrow text-muted-foreground">{browsing ? "All Hosts" : "Results"}</p>
        <h2 id="all-hosts-title" className="mt-2 mb-8 font-display text-2xl font-medium" data-testid="host-count">
          {q ? `"${q}" 검색 결과 ${hosts.length}명` : `${pillarInfo(pillar)?.label ?? "모든"} 호스트 ${hosts.length}명`}
        </h2>
        {hosts.length ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
            {hosts.map((h) => (
              <li key={h.user_id}>
                <HostCard host={h} representative={h.representative} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="border-y py-20 text-center" data-testid="empty-state">
            <p className="font-display text-2xl">{q ? "찾는 호스트가 없어요" : "아직 이 분류의 호스트가 없어요"}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              {q ? "다른 이름이나 분야로 검색해 보세요." : "이 분야의 전문가라면 호스트로 함께해 주세요."}
            </p>
            <Link href={q ? "/hosts" : "/become-a-host"} className="eyebrow mt-8 inline-block border-b border-current pb-1">
              {q ? "전체 호스트 보기" : "Become a host"}
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
        <section className="section-dark">
          <div className="mx-auto w-full max-w-7xl px-4 pt-14 pb-12 sm:px-8 sm:pt-20 sm:pb-16">
            <p className="eyebrow text-muted-foreground">{info ? info.label : "Hosts"}</p>
            <h1 className="mt-4 font-display text-4xl font-medium sm:text-6xl">{info ? info.ko : "프로그램을 여는 사람들"}</h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-linen sm:text-base">
              {info ? info.description : "운영팀이 경력과 포트폴리오를 확인한 호스트만 소개합니다."}
            </p>
            <form action="/hosts" method="get" role="search" className="mt-8 flex max-w-md gap-2" data-testid="host-search">
              {pillar && <input type="hidden" name="pillar" value={pillar} />}
              <label htmlFor="host-q" className="sr-only">호스트 검색</label>
              <input
                id="host-q"
                name="q"
                defaultValue={q}
                maxLength={40}
                placeholder="이름, 분야로 검색 (예: 사진, 철학)"
                className="h-12 min-w-0 flex-1 rounded-[2px] border border-cream/30 bg-transparent px-4 text-sm text-cream placeholder:text-linen/60 focus:border-cream focus:outline-none"
              />
              <button type="submit" className="h-12 shrink-0 rounded-[2px] bg-cream px-5 text-sm font-medium text-forest">검색</button>
            </form>
          </div>
        </section>
        <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-8">
            <PillarTabs active={pillar} q={q || undefined} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-7xl px-4 pt-12 sm:px-8 sm:pt-16">
          <Suspense fallback={<div className="aspect-[4/5] w-full max-w-xs animate-pulse bg-muted" />}>
            <HostList pillar={pillar} q={q || undefined} />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
