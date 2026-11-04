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
      <main className="flex-1">
        <section className="section-dark">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-8 sm:py-20 lg:grid-cols-[320px_1fr] lg:gap-16">
            <div className="relative flex aspect-[4/5] items-end overflow-hidden bg-espresso-soft p-6">
              <span aria-hidden className="absolute -top-6 -right-2 font-display text-[12rem] leading-none font-bold text-sand-light/[0.07]">
                {host.display_name.slice(0, 1)}
              </span>
              <span className="relative eyebrow text-muted-foreground">{host.expertise.slice(0, 3).join(" · ") || "Expert"}</span>
            </div>
            <div className="flex flex-col justify-end">
              <p className="eyebrow text-muted-foreground">Expert{host.is_sample ? " · 샘플" : ""}</p>
              <h1 className="mt-4 font-display text-4xl font-medium sm:text-6xl" data-testid="host-name">
                {host.display_name}
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-sand">{host.headline}</p>
              {host.instagram_handle && (
                <a
                  href={`https://www.instagram.com/${host.instagram_handle}/`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="eyebrow mt-6 self-start border-b border-current pb-1"
                >
                  Instagram @{host.instagram_handle}
                </a>
              )}
            </div>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 pt-14 sm:px-8 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <section>
            <p className="eyebrow text-muted-foreground">About</p>
            <p className="mt-4 leading-relaxed whitespace-pre-line">{host.bio}</p>
            {host.expertise.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2">
                {host.expertise.map((e) => (
                  <li key={e} className="border border-current/30 px-3 py-1 text-xs">
                    {e}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {(host.career || host.credentials || host.teaching_experience || host.portfolio_url) && (
            <dl className="flex flex-col text-sm" data-testid="host-credentials">
              {host.career && (
                <div className="border-t py-4">
                  <dt className="eyebrow text-muted-foreground">Career · 경력</dt>
                  <dd className="mt-2 leading-relaxed whitespace-pre-line">{host.career}</dd>
                </div>
              )}
              {host.credentials && (
                <div className="border-t py-4">
                  <dt className="eyebrow text-muted-foreground">Credentials · 자격·수상</dt>
                  <dd className="mt-2 leading-relaxed">{host.credentials}</dd>
                </div>
              )}
              {host.teaching_experience && (
                <div className="border-t py-4">
                  <dt className="eyebrow text-muted-foreground">Teaching · 가르친 경험</dt>
                  <dd className="mt-2 leading-relaxed">{host.teaching_experience}</dd>
                </div>
              )}
              {host.portfolio_url && (
                <div className="border-t py-4">
                  <dt className="eyebrow text-muted-foreground">Portfolio · 포트폴리오</dt>
                  <dd className="mt-2 break-all">
                    <a href={host.portfolio_url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
                      {host.portfolio_url}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <section className="mx-auto w-full max-w-7xl px-4 pt-20 sm:px-8">
          <p className="eyebrow text-muted-foreground">Classes</p>
          <h2 className="mt-3 mb-10 font-display text-3xl font-medium">열리는 클래스</h2>
          {meetups.length ? (
            <MeetupGrid meetups={meetups} categoryNames={names} />
          ) : (
            <p className="border-y py-12 text-muted-foreground">지금 모집 중인 클래스가 없어요.</p>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
