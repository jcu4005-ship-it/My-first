import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MeetupGrid } from "@/components/meetups/meetup-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getHost, listCategories, listUpcomingMeetups } from "@/lib/meetups/queries";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/hosts/[id]">): Promise<Metadata> {
  const { id } = await params;
  const host = await getHost(id);
  return { title: host ? host.display_name : "호스트를 찾을 수 없습니다" };
}

export default async function HostPage({ params }: PageProps<"/hosts/[id]">) {
  const { id } = await params;
  const host = await getHost(id);
  if (!host) notFound();
  const [meetups, categories] = await Promise.all([listUpcomingMeetups({ hostId: host.user_id }), listCategories()]);
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 sm:px-8 sm:pt-14">
        <section className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
          <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-3xl font-bold sm:size-28 sm:text-4xl">
            {host.display_name.slice(0, 1)}
          </span>
          <div className="max-w-2xl">
            <p className="text-xs tracking-[0.25em] text-accent">HOST{host.is_sample ? " · 샘플" : ""}</p>
            <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl" data-testid="host-name">
              {host.display_name}
            </h1>
            <p className="mt-3 text-lg leading-relaxed">{host.headline}</p>
            <p className="mt-4 leading-relaxed whitespace-pre-line text-muted-foreground">{host.bio}</p>
            {host.expertise.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {host.expertise.map((e) => (
                  <li key={e} className="rounded-full bg-secondary px-3 py-1 text-xs">
                    {e}
                  </li>
                ))}
              </ul>
            )}
            {host.instagram_handle && (
              <p className="mt-4 text-sm text-muted-foreground">Instagram @{host.instagram_handle}</p>
            )}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="mb-8 font-display text-2xl font-bold">열리는 모임</h2>
          {meetups.length ? (
            <MeetupGrid meetups={meetups} categoryNames={names} />
          ) : (
            <p className="py-10 text-muted-foreground">지금 모집 중인 모임이 없어요.</p>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
