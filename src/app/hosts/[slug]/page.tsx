import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { Photo } from "@/components/media/photo";
import { FollowButton } from "@/components/hosts/follow-button";
import { MeetupGrid } from "@/components/meetups/meetup-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { pillarInfo } from "@/config/pillars";
import { getCurrentMember } from "@/lib/auth/session";
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

function Section({ eyebrow, title, children, testId }: { eyebrow: string; title: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="border-t py-10 sm:py-12" data-testid={testId}>
      <p className="eyebrow text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-2 mb-6 font-display text-2xl font-medium">{title}</h2>
      {children}
    </section>
  );
}

export default async function HostPage({ params }: PageProps<"/hosts/[slug]">) {
  const { slug } = await params;
  const host = await getHost(slug);
  if (!host) notFound();
  // 예전 주소(/hosts/사용자id) → 이름 주소로
  if (UUID.test(slug) && host.slug) permanentRedirect(`/hosts/${host.slug}`);

  const member = await getCurrentMember();
  const [meetups, categories, follow] = await Promise.all([
    listUpcomingMeetups({ hostId: host.user_id }),
    listCategories(),
    getFollowState(host.user_id, member?.id ?? null),
  ]);
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const { soon, later } = splitBySoon(meetups);
  const pillar = pillarInfo(host.primary_pillar);
  const avatar = hostAvatarUrl(host.avatar_path);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* 1~2. 사진 · 이름 · 전문 분야 */}
        <section className="section-dark">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-8 sm:py-20 lg:grid-cols-[340px_1fr] lg:gap-16">
            <div className="relative aspect-[4/5] w-full max-w-[22rem] overflow-hidden bg-espresso-soft" data-testid="host-avatar">
              <Photo
                src={avatar}
                alt={`${host.display_name} 프로필 사진`}
                priority
                sizes="(min-width: 1024px) 340px, 90vw"
                fallback={
                  <div className="absolute inset-0 flex items-end p-6">
                    <span aria-hidden className="absolute -top-6 -right-2 font-display text-[12rem] leading-none font-bold text-sand-light/[0.07]">
                      {host.display_name.slice(0, 1)}
                    </span>
                    <span className="relative eyebrow text-muted-foreground">{host.expertise.slice(0, 3).join(" · ") || "Host"}</span>
                  </div>
                }
              />
            </div>
            <div className="flex flex-col justify-end">
              <p className="eyebrow text-muted-foreground">
                {pillar ? `${pillar.label} · ${pillar.ko}` : "Host"}
                {host.is_sample ? " · 샘플" : ""}
              </p>
              <h1 className="mt-4 font-display text-4xl font-medium sm:text-6xl" data-testid="host-name">
                {host.display_name}
              </h1>
              {host.occupation && <p className="mt-3 text-base text-sand" data-testid="host-occupation">{host.occupation}</p>}
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-sand">{host.headline}</p>
              {host.expertise.length > 0 && (
                <ul className="mt-6 flex flex-wrap gap-2">
                  {host.expertise.map((e) => (
                    <li key={e} className="border border-sand-light/30 px-3 py-1 text-xs text-sand">
                      {e}
                    </li>
                  ))}
                </ul>
              )}
              {!host.is_sample && member?.id !== host.user_id && (
                <FollowButton
                  hostId={host.user_id}
                  path={`/hosts/${host.slug ?? host.user_id}`}
                  following={follow.following}
                  count={follow.count}
                  loggedIn={Boolean(member && member.status === "active")}
                />
              )}
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

        <div className="mx-auto w-full max-w-4xl px-4 sm:px-8">
          {/* 3. 소개 */}
          <Section eyebrow="About" title="호스트 소개">
            <p className="leading-relaxed whitespace-pre-line">{host.bio}</p>
          </Section>

          {/* 4. 전문성·경력 */}
          {(host.career || host.credentials || host.teaching_experience) && (
            <Section eyebrow="Expertise" title="전문성과 경력" testId="host-credentials">
              <dl className="flex flex-col text-sm">
                {host.career && (
                  <div className="border-b py-4">
                    <dt className="eyebrow text-muted-foreground">Career · 경력</dt>
                    <dd className="mt-2 leading-relaxed whitespace-pre-line">{host.career}</dd>
                  </div>
                )}
                {host.credentials && (
                  <div className="border-b py-4">
                    <dt className="eyebrow text-muted-foreground">Credentials · 자격·수상</dt>
                    <dd className="mt-2 leading-relaxed">{host.credentials}</dd>
                  </div>
                )}
                {host.teaching_experience && (
                  <div className="border-b py-4">
                    <dt className="eyebrow text-muted-foreground">Teaching · 가르친 경험</dt>
                    <dd className="mt-2 leading-relaxed">{host.teaching_experience}</dd>
                  </div>
                )}
              </dl>
            </Section>
          )}

          {/* 5. 작업 철학 */}
          {host.philosophy && (
            <Section eyebrow="Philosophy" title="작업 철학" testId="host-philosophy">
              <blockquote className="border-l-2 border-terracotta pl-5 font-display text-xl leading-relaxed break-keep whitespace-pre-line">
                {host.philosophy}
              </blockquote>
            </Section>
          )}

          {/* 6. 포트폴리오 (작품 콘텐츠는 콘텐츠 기능과 함께 추가 예정) */}
          {host.portfolio_url && (
            <Section eyebrow="Portfolio" title="포트폴리오">
              <a href={host.portfolio_url} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline underline-offset-4">
                {host.portfolio_url}
              </a>
            </Section>
          )}
        </div>

        {/* 8~9. 곧 열리는 / 예정된 프로그램 */}
        <section className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-8" data-testid="host-programs">
          {meetups.length === 0 ? (
            <div className="border-y py-12">
              <p className="eyebrow text-muted-foreground">Programs</p>
              <p className="mt-3 text-muted-foreground">지금 모집 중인 프로그램이 없어요.</p>
              <Link href="/meetups" className="eyebrow mt-6 inline-block border-b border-current pb-1">다른 프로그램 둘러보기</Link>
            </div>
          ) : (
            <>
              {soon.length > 0 && (
                <div className="mb-16" data-testid="host-programs-soon">
                  <p className="eyebrow text-muted-foreground">This Week</p>
                  <h2 className="mt-2 mb-8 font-display text-2xl font-medium">곧 열리는 프로그램</h2>
                  <MeetupGrid meetups={soon} categoryNames={names} />
                </div>
              )}
              {later.length > 0 && (
                <div data-testid="host-programs-later">
                  <p className="eyebrow text-muted-foreground">Upcoming</p>
                  <h2 className="mt-2 mb-8 font-display text-2xl font-medium">예정된 프로그램</h2>
                  <MeetupGrid meetups={later} categoryNames={names} />
                </div>
              )}
            </>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
