import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { notFound, permanentRedirect } from "next/navigation";

import { Photo } from "@/components/media/photo";
import { ContentGrid } from "@/components/contents/content-card";
import { FollowButton } from "@/components/hosts/follow-button";
import { MeetupGrid } from "@/components/meetups/meetup-card";
import { Card, Section, SectionTitle } from "@/components/layout/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { pillarInfo } from "@/config/pillars";
import { getCurrentMember } from "@/lib/auth/session";
import { listPublishedContents } from "@/lib/contents/queries";
import { hostAvatarUrl } from "@/lib/hosting/avatar";
import { getFollowState } from "@/lib/hosting/follows";
import { getHost, listCategories, listUpcomingMeetups } from "@/lib/meetups/queries";

export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOON_MS = 7 * 24 * 60 * 60 * 1000;

/** 7일 안에 다음 일정이 있으면 "곧 열리는", 그 뒤면 "예정된" */
function splitBySoon<T extends { nextSession: { starts_at: string } }>(list: T[]) {
  const now = Date.now();
  const isSoon = (m: T) => new Date(m.nextSession.starts_at).getTime() - now <= SOON_MS;
  return { soon: list.filter(isSoon), later: list.filter((m) => !isSoon(m)) };
}

export async function generateMetadata({ params }: PageProps<"/hosts/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const host = await getHost(slug);
  return host
    ? { title: host.display_name, description: host.occupation || host.headline }
    : { title: "호스트를 찾을 수 없습니다" };
}

export default async function HostPage({ params }: PageProps<"/hosts/[slug]">) {
  const { slug } = await params;
  const host = await getHost(slug);
  if (!host) notFound();
  // 예전 주소(/hosts/사용자id) → 이름 주소로
  if (UUID.test(slug) && host.slug) permanentRedirect(`/hosts/${host.slug}`);

  const member = await getCurrentMember();
  const [meetups, categories, follow, contents] = await Promise.all([
    listUpcomingMeetups({ hostId: host.user_id }),
    listCategories(),
    getFollowState(host.user_id, member?.id ?? null),
    listPublishedContents({ hostId: host.user_id }),
  ]);
  const portfolio = contents.filter((c) => c.type === "portfolio");
  const stories = contents.filter((c) => c.type !== "portfolio");
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const { soon, later } = splitBySoon(meetups);
  const pillar = pillarInfo(host.primary_pillar);
  const avatar = hostAvatarUrl(host.avatar_path);
  const expertise = [
    host.career && { key: "career", label: "경력", value: host.career, pre: true },
    host.credentials && { key: "credentials", label: "자격·수상", value: host.credentials, pre: false },
    host.teaching_experience && { key: "teaching", label: "가르친 경험", value: host.teaching_experience, pre: false },
  ].filter(Boolean) as { key: string; label: string; value: string; pre: boolean }[];

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* 1. 프로필: 사진 · 이름 · 하는 일 · 팔로우 */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 size-[26rem] rounded-full bg-mint/30 blur-3xl" />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-10 pb-4 sm:flex-row sm:items-center sm:gap-8 sm:px-6 sm:pt-14">
            <div
              className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest font-display text-5xl text-cream sm:size-36"
              data-testid="host-avatar"
            >
              <Photo
                src={avatar}
                alt={`${host.display_name} 프로필 사진`}
                priority
                sizes="144px"
                fallback={<span aria-hidden>{host.display_name.slice(0, 1)}</span>}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {pillar && <span className="pill bg-forest/10 text-forest">{pillar.ko}</span>}
                {host.is_sample && <span className="pill bg-linen text-muted-foreground">샘플</span>}
              </div>
              <h1 className="mt-2 flex items-center gap-2 font-display text-3xl font-bold text-forest sm:text-4xl">
                <span data-testid="host-name">{host.display_name}</span>
                <BadgeCheck aria-label="운영팀 심사를 통과한 호스트" className="size-6 shrink-0" strokeWidth={1.8} />
              </h1>
              {host.occupation && <p className="mt-1 text-muted-foreground" data-testid="host-occupation">{host.occupation}</p>}
              <p className="mt-3 max-w-2xl leading-relaxed">{host.headline}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                {!host.is_sample && member?.id !== host.user_id && (
                  <FollowButton
                    hostId={host.user_id}
                    path={`/hosts/${host.slug ?? host.user_id}`}
                    following={follow.following}
                    count={follow.count}
                    loggedIn={Boolean(member && member.status === "active")}
                    tone="light"
                    showCount
                  />
                )}
                {host.instagram_handle && (
                  <a
                    href={`https://www.instagram.com/${host.instagram_handle}/`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Instagram @{host.instagram_handle}
                  </a>
                )}
              </div>
              {host.expertise.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {host.expertise.map((e) => (
                    <li key={e} className="pill bg-linen text-foreground/80">
                      {e}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* 2. 프로그램 (가장 먼저) */}
        <Section className="mt-10 sm:mt-12" data-testid="host-programs">
          {meetups.length === 0 ? (
            <Card className="text-center">
              <p className="text-muted-foreground">지금 모집 중인 프로그램이 없어요.</p>
              <Link href="/meetups" className="mt-3 inline-block text-sm font-semibold text-forest underline-offset-4 hover:underline">
                다른 프로그램 둘러보기
              </Link>
            </Card>
          ) : (
            <div className="flex flex-col gap-10">
              {soon.length > 0 && (
                <div data-testid="host-programs-soon">
                  <SectionTitle>곧 열리는 프로그램</SectionTitle>
                  <MeetupGrid meetups={soon} categoryNames={names} />
                </div>
              )}
              {later.length > 0 && (
                <div data-testid="host-programs-later">
                  <SectionTitle>예정된 프로그램</SectionTitle>
                  <MeetupGrid meetups={later} categoryNames={names} />
                </div>
              )}
            </div>
          )}
        </Section>

        {/* 3. 소개 · 경력 · 철학 */}
        <Section>
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <Card>
              <h2 className="text-lg font-bold text-forest">호스트 소개</h2>
              <p className="mt-3 leading-relaxed whitespace-pre-line">{host.bio}</p>
              {host.philosophy && (
                <div className="mt-6" data-testid="host-philosophy">
                  <h3 className="text-sm font-semibold text-muted-foreground">작업 철학</h3>
                  <blockquote className="mt-2 rounded-xl bg-linen/70 px-4 py-3 font-display text-lg leading-relaxed break-keep whitespace-pre-line">
                    {host.philosophy}
                  </blockquote>
                </div>
              )}
            </Card>
            {(expertise.length > 0 || (host.portfolio_url && portfolio.length === 0)) && (
              <Card data-testid={expertise.length ? "host-credentials" : undefined}>
                <h2 className="text-lg font-bold text-forest">전문성과 경력</h2>
                <dl className="mt-3 flex flex-col gap-4 text-sm">
                  {expertise.map((e) => (
                    <div key={e.key}>
                      <dt className="font-semibold">{e.label}</dt>
                      <dd className={`mt-1 leading-relaxed text-muted-foreground ${e.pre ? "whitespace-pre-line" : ""}`}>{e.value}</dd>
                    </div>
                  ))}
                  {host.portfolio_url && portfolio.length === 0 && (
                    <div>
                      <dt className="font-semibold">포트폴리오</dt>
                      <dd className="mt-1">
                        <a href={host.portfolio_url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-forest underline underline-offset-4">
                          {host.portfolio_url}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </Card>
            )}
          </div>
        </Section>

        {/* 4. 포트폴리오 · 호스트의 글 (운영팀 검토를 거쳐 공개된 글만) */}
        {portfolio.length > 0 && (
          <Section data-testid="host-portfolio">
            <SectionTitle>포트폴리오</SectionTitle>
            <ContentGrid contents={portfolio} />
            {host.portfolio_url && (
              <a href={host.portfolio_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-5 inline-block text-sm font-semibold text-forest underline-offset-4 hover:underline">
                외부 포트폴리오 보기
              </a>
            )}
          </Section>
        )}
        {stories.length > 0 && (
          <Section data-testid="host-journal">
            <SectionTitle>호스트의 글</SectionTitle>
            <ContentGrid contents={stories} />
          </Section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
