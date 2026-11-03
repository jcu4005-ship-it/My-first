import Link from "next/link";
import { Suspense } from "react";

import { brand } from "@/config/brand";
import { CategoryChips } from "@/components/meetups/category-chips";
import { MeetupGrid } from "@/components/meetups/meetup-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { listCategories, listFeaturedHosts, listUpcomingMeetups } from "@/lib/meetups/queries";

async function UpcomingSection() {
  const [categories, meetups] = await Promise.all([listCategories(), listUpcomingMeetups({ limit: 6 })]);
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const hasSample = meetups.some((m) => m.is_sample);
  return (
    <>
      <div className="mb-8">
        <CategoryChips categories={categories} />
      </div>
      {hasSample && (
        <p className="mb-8 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="sample-notice">
          지금 보이는 모임은 서비스 준비 중 보여 드리는 <strong>샘플</strong>입니다. 실제로 신청할 수 없어요.
        </p>
      )}
      {meetups.length ? (
        <MeetupGrid meetups={meetups} categoryNames={names} />
      ) : (
        <p className="py-16 text-center text-muted-foreground">곧 첫 모임이 열립니다.</p>
      )}
      <div className="mt-12 flex justify-center">
        <Button asChild variant="outline" size="lg">
          <Link href="/meetups">모든 모임 보기</Link>
        </Button>
      </div>
    </>
  );
}

async function HostsSection() {
  const hosts = await listFeaturedHosts(4);
  if (!hosts.length) return null;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {hosts.map((h) => (
        <li key={h.user_id}>
          <Link
            href={`/hosts/${h.user_id}`}
            className="flex h-full flex-col gap-3 rounded-2xl border p-5 transition-colors hover:border-foreground"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary font-display text-lg font-bold">
              {h.display_name.slice(0, 1)}
            </span>
            <span className="font-semibold">{h.display_name}</span>
            <span className="text-sm leading-relaxed text-muted-foreground">{h.headline}</span>
            {h.is_sample && <span className="mt-auto text-[11px] text-muted-foreground">샘플 호스트</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

const STEPS = [
  { no: "01", title: "취향으로 고르기", body: "독서, 음악, 사진, 러닝까지. 관심사와 날짜, 동네로 모임을 찾아요." },
  { no: "02", title: "혼자서도 가볍게", body: "대부분의 참가자가 혼자 옵니다. 호스트가 처음 온 사람도 편하게 이끌어요." },
  { no: "03", title: "다음 만남으로", body: "좋았던 호스트를 팔로우하고, 비슷한 취향의 다른 모임으로 이어가요." },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 pb-16 sm:px-8 sm:pt-20 sm:pb-24">
          <p className="mb-5 text-xs tracking-[0.3em] text-accent">OFFLINE COMMUNITY</p>
          <h1 className="max-w-3xl font-display text-[2.6rem] leading-[1.15] font-bold break-keep sm:text-7xl">
            {brand.tagline}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            호스트가 자신의 취향과 경험으로 기획한 작은 모임들. 마음에 드는 하루를 골라, 새로운 사람들과 만나 보세요.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/meetups">모임 둘러보기</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#host">호스트가 되고 싶다면</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 sm:px-8" aria-labelledby="upcoming-title">
          <div className="mb-6 flex items-end justify-between">
            <h2 id="upcoming-title" className="font-display text-2xl font-bold sm:text-3xl">
              곧 열리는 모임
            </h2>
          </div>
          <Suspense fallback={<GridSkeleton />}>
            <UpcomingSection />
          </Suspense>
        </section>

        <section className="mx-auto mt-24 w-full max-w-6xl px-4 sm:px-8" aria-labelledby="how-title">
          <h2 id="how-title" className="font-display text-2xl font-bold sm:text-3xl">
            이렇게 참여해요
          </h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.no} className="border-t border-foreground pt-5">
                <span className="text-xs tracking-[0.2em] text-accent">{s.no}</span>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto mt-24 w-full max-w-6xl px-4 sm:px-8" aria-labelledby="hosts-title">
          <h2 id="hosts-title" className="mb-8 font-display text-2xl font-bold sm:text-3xl">
            모임을 여는 사람들
          </h2>
          <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-muted" />}>
            <HostsSection />
          </Suspense>
        </section>

        <section id="host" className="mx-auto mt-24 w-full max-w-6xl px-4 sm:px-8">
          <div className="rounded-3xl bg-foreground px-6 py-12 text-background sm:px-12 sm:py-16">
            <p className="text-xs tracking-[0.3em] opacity-70">BECOME A HOST</p>
            <h2 className="mt-4 max-w-xl font-display text-3xl leading-snug font-bold break-keep sm:text-4xl">
              당신의 취향도 누군가에게는 기다리던 모임이 됩니다
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed opacity-80">
              기획 템플릿과 운영 가이드, 홍보까지 함께합니다. 호스트 신청은 곧 열려요. 먼저 가입해 두시면 오픈 소식을 가장 먼저 알려 드릴게요.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8">
              <Link href="/signup">먼저 가입하기</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
