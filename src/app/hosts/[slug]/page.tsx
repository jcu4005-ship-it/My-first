import type { Metadata } from "next";
import Link from "next/link";
import { AtSign, BadgeCheck } from "lucide-react";
import { notFound, permanentRedirect } from "next/navigation";

import { Photo } from "@/components/media/photo";
import { ContentGrid } from "@/components/contents/content-card";
import { FollowButton } from "@/components/hosts/follow-button";
import { MeetupGrid } from "@/components/meetups/meetup-card";
import { Seal } from "@/components/brand/seat-table";
import { Section, SectionTitle } from "@/components/layout/page-parts";
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
  const pillarOf = Object.fromEntries(categories.map((c) => [c.slug, c.pillar]));
  const { soon, later } = splitBySoon(meetups);
  const pillar = pillarInfo(host.primary_pillar);
  const avatar = hostAvatarUrl(host.avatar_path);
  const expertise = [
    host.career && { key: "career", label: "경력", value: host.career, pre: true },
    host.credentials && { key: "credentials", label: "자격·수상", value: host.credentials, pre: false },
    host.teaching_experience && { key: "teaching", label: "가르친 경험", value: host.teaching_experience, pre: false },
  ].filter(Boolean) as { key: string; label: string; value: string; pre: boolean }[];

  const canFollow = member?.id !== host.user_id;
  const sheet = "rounded-[20px] bg-card shadow-[0_2px_0_rgb(35_51_42/0.08),0_14px_24px_-14px_rgb(35_51_42/0.4)]";

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* 1. 호스트 명함 */}
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 sm:pt-10">
          <section className={`relative px-5 pt-6 pb-5 sm:px-7 ${sheet}`}>
            <Seal className="absolute -top-3 right-4">심사<br />통과</Seal>
            <div className="flex items-center gap-4">
              <div
                className="relative flex size-[76px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest font-display text-3xl text-cream shadow-[0_0_0_4px_#fff,0_0_0_5px_var(--border)] sm:size-24"
                data-testid="host-avatar"
              >
                <Photo src={avatar} alt={`${host.display_name} 프로필 사진`} priority sizes="96px" fallback={<span aria-hidden>{host.display_name.slice(0, 1)}</span>} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1.5">
                  {pillar && <span className="pill bg-forest/10 text-forest">{pillar.ko}</span>}
                  {host.is_sample && <span className="pill bg-linen text-muted-foreground">샘플</span>}
                </div>
                <h1 className="mt-1.5 flex items-center gap-1.5 font-display text-2xl font-bold sm:text-3xl">
                  <span data-testid="host-name">{host.display_name}</span>
                  <BadgeCheck aria-label="운영팀 심사를 통과한 호스트" className="size-5 shrink-0 text-forest" strokeWidth={2} />
                </h1>
                {host.occupation && <p className="mt-0.5 text-[13px] text-muted-foreground" data-testid="host-occupation">{host.occupation}</p>}
              </div>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed">{host.headline}</p>
            {host.expertise.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {host.expertise.map((e) => (
                  <li key={e} className="pill bg-[#f2ede3] text-foreground/80">{e}</li>
                ))}
              </ul>
            )}
            {/* 숫자는 모두 실제 데이터 */}
            <dl className="mt-4 grid grid-cols-3 border-t-[1.5px] border-dashed border-[#cfc6b5] pt-3.5 text-center">
              <div className="flex flex-col-reverse">
                <dt className="text-[11.5px] text-muted-foreground">열린 테이블</dt>
                <dd className="font-display text-xl font-bold">{meetups.length}</dd>
              </div>
              <div className="flex flex-col-reverse border-x border-border/70">
                <dt className="text-[11.5px] text-muted-foreground">팔로워</dt>
                <dd className="font-display text-xl font-bold">{follow.count.toLocaleString("ko-KR")}</dd>
              </div>
              <div className="flex flex-col-reverse">
                <dt className="text-[11.5px] text-muted-foreground">쓴 글</dt>
                <dd className="font-display text-xl font-bold">{contents.length}</dd>
              </div>
            </dl>
            {(canFollow || host.instagram_handle) && (
              <div className="mt-4 flex items-start gap-2">
                {canFollow && (
                  <FollowButton
                    hostId={host.user_id}
                    path={`/hosts/${host.slug ?? host.user_id}`}
                    following={follow.following}
                    count={follow.count}
                    loggedIn={Boolean(member && member.status === "active")}
                    tone="light"
                    showCount={false}
                    stretch
                  />
                )}
                {host.instagram_handle && (
                  <a
                    href={`https://www.instagram.com/${host.instagram_handle}/`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[#d6cdbc] text-sm font-bold hover:border-forest/50"
                  >
                    <AtSign aria-hidden className="size-4" strokeWidth={1.8} />
                    Instagram
                    <span className="sr-only"> @{host.instagram_handle}</span>
                  </a>
                )}
              </div>
            )}
            {/* 팔로워 수 (화면 읽기·검사용 문장) */}
            <p className="sr-only" data-testid="follower-count">팔로워 {follow.count.toLocaleString("ko-KR")}명</p>
          </section>
        </div>

        {/* 2. 이 호스트의 테이블 */}
        <Section className="mt-10 max-w-3xl sm:mt-12" data-testid="host-programs">
          <SectionTitle>{host.display_name}의 테이블</SectionTitle>
          {meetups.length === 0 ? (
            <div className="rounded-[18px] border-[1.5px] border-dashed border-[#cfc6b5] bg-card/60 px-5 py-8 text-center">
              <p className="text-muted-foreground">지금 모집 중인 프로그램이 없어요.</p>
              <Link href="/meetups" className="mt-3 inline-block text-sm font-semibold text-forest underline-offset-4 hover:underline">
                다른 테이블 둘러보기
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {soon.length > 0 && (
                <div data-testid="host-programs-soon">
                  {later.length > 0 && <h3 className="mb-2 text-sm font-semibold text-muted-foreground">곧 열려요</h3>}
                  <MeetupGrid meetups={soon} categoryNames={names} pillarOf={pillarOf} />
                </div>
              )}
              {later.length > 0 && (
                <div data-testid="host-programs-later">
                  {soon.length > 0 && <h3 className="mb-2 text-sm font-semibold text-muted-foreground">예정된 테이블</h3>}
                  <MeetupGrid meetups={later} categoryNames={names} pillarOf={pillarOf} />
                </div>
              )}
            </div>
          )}
        </Section>

        {/* 3. 호스트의 편지: 작업 철학 + 소개 + 서명 */}
        <Section className="max-w-3xl">
          <SectionTitle>{host.display_name}의 편지</SectionTitle>
          <div className={`px-5 py-5 sm:px-7 ${sheet}`}>
            {host.philosophy && (
              <blockquote className="rounded-xl bg-[#f6f1e7] px-4 py-3 font-display text-[17px] leading-relaxed break-keep whitespace-pre-line" data-testid="host-philosophy">
                {host.philosophy}
              </blockquote>
            )}
            <p className={`text-[15px] leading-[1.8] whitespace-pre-line text-[#2b3b32] ${host.philosophy ? "mt-4" : ""}`}>{host.bio}</p>
            <p className="sign mt-3 text-right text-sm">— {host.display_name} 드림</p>
          </div>
        </Section>

        {/* 4. 경력과 자격 */}
        {(expertise.length > 0 || (host.portfolio_url && portfolio.length === 0)) && (
          <Section className="max-w-3xl">
            <SectionTitle>경력과 자격</SectionTitle>
            <dl className={`px-5 sm:px-7 ${sheet}`} data-testid={expertise.length ? "host-credentials" : undefined}>
              {expertise.map((e) => (
                <div key={e.key} className="grid grid-cols-[5.5rem_1fr] gap-2 border-b border-dashed border-[#ddd3c2] py-3 text-sm last:border-0">
                  <dt className="font-bold text-forest">{e.label}</dt>
                  <dd className={`leading-relaxed ${e.pre ? "whitespace-pre-line" : ""}`}>{e.value}</dd>
                </div>
              ))}
              {host.portfolio_url && portfolio.length === 0 && (
                <div className="grid grid-cols-[5.5rem_1fr] gap-2 py-3 text-sm">
                  <dt className="font-bold text-forest">포트폴리오</dt>
                  <dd>
                    <a href={host.portfolio_url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-forest underline underline-offset-4">
                      {host.portfolio_url}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </Section>
        )}

        {/* 5. 포트폴리오 · 호스트의 글 (운영팀 검토를 거쳐 공개된 글만) */}
        {portfolio.length > 0 && (
          <Section className="max-w-3xl" data-testid="host-portfolio">
            <SectionTitle>포트폴리오</SectionTitle>
            <ContentGrid contents={portfolio} />
            {host.portfolio_url && (
              <a href={host.portfolio_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-4 inline-block text-sm font-semibold text-forest underline-offset-4 hover:underline">
                외부 포트폴리오 보기
              </a>
            )}
          </Section>
        )}
        {stories.length > 0 && (
          <Section className="max-w-3xl" data-testid="host-journal">
            <SectionTitle>{host.display_name}의 글</SectionTitle>
            <ContentGrid contents={stories} />
          </Section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
