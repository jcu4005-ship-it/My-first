import type { Metadata } from "next";

import { CategoryChips } from "@/components/meetups/category-chips";
import { MeetupGrid } from "@/components/meetups/meetup-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listCategories, listUpcomingMeetups } from "@/lib/meetups/queries";

export const metadata: Metadata = { title: "모임 둘러보기" };
export const instant = false;

export default async function MeetupsPage({ searchParams }: PageProps<"/meetups">) {
  const { category } = (await searchParams) as { category?: string };
  const categories = await listCategories();
  const active = categories.find((c) => c.slug === category);
  const meetups = await listUpcomingMeetups({ category: active?.slug });
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 sm:px-8 sm:pt-10">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{active ? active.name : "모든 모임"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {active ? active.description : "곧 열리는 순서로 보여 드려요."}
        </p>
        <div className="mt-6 mb-8">
          <CategoryChips categories={categories} active={active?.slug} />
        </div>
        {meetups.some((m) => m.is_sample) && (
          <p className="mb-8 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground">
            &lsquo;샘플&rsquo; 표시가 있는 모임은 서비스 준비 중 보여 드리는 예시입니다.
          </p>
        )}
        {meetups.length ? (
          <MeetupGrid meetups={meetups} categoryNames={names} />
        ) : (
          <div className="py-20 text-center" data-testid="empty-state">
            <p className="font-semibold">아직 열린 모임이 없어요</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {active?.slug === "wine" ? "주류가 포함된 모임은 운영 검토를 마친 뒤 열릴 예정입니다." : "곧 새로운 모임이 열립니다."}
            </p>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
