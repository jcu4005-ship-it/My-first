import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { HostCard } from "@/components/hosts/host-card";
import { Night } from "@/components/layout/night";
import { chipClass } from "@/components/meetups/category-chips";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PILLARS, isPillar, pillarInfo } from "@/config/pillars";
import { listHosts } from "@/lib/meetups/queries";

export const instant = false;
export const metadata: Metadata = { title: "크리에이터", description: "자기만의 작업과 전문성을 가진 크리에이터를 소개합니다." };

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
          <h2 id="featured-title" className="font-display text-[23px] font-bold tracking-[-0.02em] sm:text-[27px]">이번에 소개하는 크리에이터</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">추천은 운영팀이 직접 고릅니다. 팔로워 수와는 관계없어요.</p>
          <div className="mt-5 grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-6">
            {featured.map((h) => (
              <HostCard key={h.user_id} host={h} representative={h.representative} />
            ))}
          </div>
        </section>
      )}
      <section aria-labelledby="all-hosts-title">
        <h2 id="all-hosts-title" className="mb-5 font-display text-[23px] font-bold tracking-[-0.02em] sm:text-[27px]" data-testid="host-count">
          {q ? `"${q}" 검색 결과 ${hosts.length}명` : `${pillarInfo(pillar)?.ko ?? "모든"} 크리에이터 ${hosts.length}명`}
        </h2>
        {hosts.length ? (
          <ul className="grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-6">
            {hosts.map((h) => (
              <li key={h.user_id}>
                <HostCard host={h} representative={h.representative} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-3xl border border-dashed border-border px-6 py-16 text-center" data-testid="empty-state">
            <p className="text-xl font-extrabold">{q ? "찾는 크리에이터가 없어요" : "아직 이 분류의 크리에이터가 없어요"}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              {q ? "다른 이름이나 분야로 검색해 보세요." : "이 분야의 전문가라면 크리에이터로 함께해 주세요."}
            </p>
            <Link href={q ? "/hosts" : "/become-a-host"} className="mt-5 inline-block text-sm font-semibold text-gold underline-offset-4 hover:underline">
              {q ? "전체 크리에이터 보기" : "크리에이터 지원 안내"}
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
    <Night>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-[34px] leading-tight font-display font-bold tracking-[-0.02em] break-keep sm:text-[52px]">{info ? info.ko : "크리에이터"}</h1>
              <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">
                {info ? info.description : "자기만의 작업과 시선을 가진 사람들. 팔로우하면 그 사람의 새 원 소식을 먼저 받아요."}
              </p>
            </div>
            <form action="/hosts" method="get" role="search" className="flex w-full gap-2 sm:max-w-sm" data-testid="host-search">
              {pillar && <input type="hidden" name="pillar" value={pillar} />}
              <label htmlFor="host-q" className="sr-only">크리에이터 검색</label>
              <input
                id="host-q"
                name="q"
                defaultValue={q}
                maxLength={40}
                placeholder="이름, 분야로 찾기 (예: 사진, 철학)"
                className="h-12 min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none sm:text-sm"
              />
              <button type="submit" className="h-12 shrink-0 rounded-2xl bg-foreground px-5 text-sm font-bold text-background hover:bg-foreground/90">검색</button>
            </form>
          </div>
        </section>
        <div className="sticky top-16 z-20 mt-3 border-b border-border/70 bg-background/95 backdrop-blur">
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
    </Night>
  );
}
