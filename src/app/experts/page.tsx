import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listFeaturedHosts } from "@/lib/meetups/queries";

export const metadata: Metadata = { title: "전문가" };

async function ExpertList() {
  const hosts = await listFeaturedHosts(60);
  if (!hosts.length) {
    return <p className="border-y py-16 text-center text-muted-foreground" data-testid="empty-state">곧 첫 전문가를 소개해 드릴게요.</p>;
  }
  return (
    <ul className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
      {hosts.map((h) => (
        <li key={h.user_id}>
          <Link href={`/hosts/${h.user_id}`} className="group flex flex-col" data-testid="expert-card">
            <span className="relative flex aspect-[4/5] items-end overflow-hidden bg-espresso p-5 text-sand-light">
              <span aria-hidden className="absolute -top-4 -right-2 font-display text-[9rem] leading-none font-bold opacity-[0.08]">
                {h.display_name.slice(0, 1)}
              </span>
              <span className="relative eyebrow text-sand">{h.expertise.slice(0, 2).join(" · ") || "Expert"}</span>
            </span>
            <span className="mt-4 font-display text-xl font-medium group-hover:underline group-hover:underline-offset-4">{h.display_name}</span>
            <span className="mt-1 text-sm leading-relaxed text-muted-foreground">{h.headline}</span>
            {h.career && <span className="mt-3 line-clamp-2 border-t pt-3 text-xs leading-relaxed text-muted-foreground">{h.career}</span>}
            {h.is_sample && <span className="mt-1 text-[11px] text-muted-foreground">샘플 호스트</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ExpertsPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="section-dark">
          <div className="mx-auto w-full max-w-7xl px-4 pt-14 pb-12 sm:px-8 sm:pt-20 sm:pb-16">
            <p className="eyebrow text-muted-foreground">Our Experts</p>
            <h1 className="mt-4 font-display text-4xl font-medium sm:text-6xl">클래스를 여는 사람들</h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-sand sm:text-base">
              운영팀이 경력과 포트폴리오를 확인한 전문가와 크리에이터를 소개합니다.
            </p>
          </div>
        </section>
        <div className="mx-auto w-full max-w-7xl px-4 pt-14 sm:px-8">
          <Suspense fallback={<div className="aspect-[4/5] w-full max-w-xs animate-pulse bg-muted" />}>
            <ExpertList />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
