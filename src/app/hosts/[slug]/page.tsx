import type { Metadata } from "next";
import Link from "next/link";
import { AtSign, BadgeCheck } from "lucide-react";
import { notFound, permanentRedirect } from "next/navigation";

import { Photo } from "@/components/media/photo";
import { ContentGrid } from "@/components/contents/content-card";
import { FollowButton } from "@/components/hosts/follow-button";
import { CircleGrid } from "@/components/meetups/circle-card";
import { Blue } from "@/components/layout/blue";
import { VerifiedChecklist } from "@/components/trust/proofs";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { pillarInfo } from "@/config/pillars";
import { getCurrentMember } from "@/lib/auth/session";
import { listPublishedContents } from "@/lib/contents/queries";
import { creatorPhoto } from "@/lib/hosting/avatar";
import { getFollowState } from "@/lib/hosting/follows";
import {
  getHost,
  listCategories,
  listHostActivity,
  listUpcomingMeetups,
} from "@/lib/meetups/queries";
import { ReviewSection } from "@/components/reviews/review-list";
import { getReviewSummary, listPublicReviews } from "@/lib/reviews/queries";
import { formatDate } from "@/lib/format";

export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOON_MS = 7 * 24 * 60 * 60 * 1000;

/** 7일 안에 다음 일정이 있으면 "곧 열리는", 그 뒤면 "예정된" */
function splitBySoon<T extends { nextSession: { starts_at: string } }>(
  list: T[],
) {
  const now = Date.now();
  const isSoon = (m: T) =>
    new Date(m.nextSession.starts_at).getTime() - now <= SOON_MS;
  return { soon: list.filter(isSoon), later: list.filter((m) => !isSoon(m)) };
}

export async function generateMetadata({
  params,
}: PageProps<"/hosts/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const host = await getHost(slug);
  return host
    ? {
        title: host.display_name,
        description: host.occupation || host.headline,
      }
    : { title: "호스트를 찾을 수 없습니다" };
}

export default async function HostPage({ params }: PageProps<"/hosts/[slug]">) {
  const { slug } = await params;
  const host = await getHost(slug);
  if (!host) notFound();
  // 예전 주소(/hosts/사용자id) → 이름 주소로
  if (UUID.test(slug) && host.slug) permanentRedirect(`/hosts/${host.slug}`);

  const member = await getCurrentMember();
  const [meetups, categories, follow, contents, activity, reviews, reviewSummary] = await Promise.all([
    listUpcomingMeetups({ hostId: host.user_id }),
    listCategories(),
    getFollowState(host.user_id, member?.id ?? null),
    listPublishedContents({ hostId: host.user_id }),
    listHostActivity(host.user_id, 10),
    listPublicReviews({ hostId: host.user_id }, 10),
    getReviewSummary({ hostId: host.user_id }),
  ]);
  const portfolio = contents.filter((c) => c.type === "portfolio");
  const stories = contents.filter((c) => c.type !== "portfolio");
  const names = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  const { soon, later } = splitBySoon(meetups);
  const pillar = pillarInfo(host.primary_pillar);
  const avatar = creatorPhoto(host);
  // 이름·분야만 먼저 올린 호스트(소개 미작성): "심사 통과" 표시 대신 "소개 준비 중"
  const introPending = !host.philosophy && !host.bio && !host.headline;
  const expertise = [
    host.career && {
      key: "career",
      label: "경력",
      value: host.career,
      pre: true,
    },
    host.credentials && {
      key: "credentials",
      label: "자격·수상",
      value: host.credentials,
      pre: false,
    },
    host.teaching_experience && {
      key: "teaching",
      label: "가르친 경험",
      value: host.teaching_experience,
      pre: false,
    },
  ].filter(Boolean) as {
    key: string;
    label: string;
    value: string;
    pre: boolean;
  }[];

  const canFollow = member?.id !== host.user_id;
  const title = (t: string) => <h2 className="mb-4 font-display text-[23px] font-bold tracking-[-0.02em] sm:text-[27px]">{t}</h2>;
  const wrap = "mx-auto mt-12 w-full max-w-3xl px-4 sm:px-6";

  return (
    <Blue>
      <SiteHeader />
      <main className="flex-1">
        {/* 1. 크리에이터: 큰 사진 + 이름 */}
        <div className="mx-auto w-full max-w-3xl sm:px-6 sm:pt-8">
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted sm:aspect-[16/11] sm:rounded-[28px]" data-testid="host-avatar">
            <Photo
              src={avatar}
              alt={`${host.display_name} 프로필 사진`}
              priority
              sizes="(min-width: 768px) 720px, 100vw"
              className="object-[50%_18%] "
              fallback={<span aria-hidden className="absolute inset-0 flex items-center justify-center bg-navy-3 font-display text-[8rem] font-bold text-lit">{host.display_name.slice(0, 1)}</span>}
            />
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgb(16_29_56/0.35),transparent_30%,transparent_45%,rgb(16_29_56/0.94))]" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
              <div className="flex flex-wrap gap-1.5">
                {pillar && <span className="rounded-full bg-cream px-2.5 py-1 text-[13.5px] font-extrabold text-gold-ink">{pillar.ko}</span>}
                {host.is_sample && <span className="rounded-full border border-cream/50 px-2.5 py-1 text-[13.5px] font-semibold text-cream">샘플</span>}
              </div>
              <h1 className="mt-2 flex items-center gap-2 font-display text-[38px] leading-none font-bold tracking-[-0.02em] text-cream sm:text-[50px]">
                <span data-testid="host-name">{host.display_name}</span>
                {!introPending && <BadgeCheck aria-label="운영팀 심사를 통과한 호스트" className="size-6 shrink-0 text-gold" strokeWidth={2} />}
              </h1>
              {host.occupation && (
                <p className="mt-1.5 text-[15px] text-cream/85" data-testid="host-occupation">
                  {host.occupation}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          {(canFollow || host.instagram_handle) && (
            <div className="mt-5 flex items-start gap-2">
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
                  className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-border text-sm font-bold hover:border-foreground/50"
                >
                  <AtSign aria-hidden className="size-4" strokeWidth={1.8} />
                  Instagram
                  <span className="sr-only"> @{host.instagram_handle}</span>
                </a>
              )}
            </div>
          )}
          {host.headline && <p className="mt-5 text-[16px] leading-relaxed">{host.headline}</p>}
          {host.expertise.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {host.expertise.map((e) => (
                <li key={e} className="pill border border-border bg-card text-foreground/85">
                  {e}
                </li>
              ))}
            </ul>
          )}
          {/* 숫자는 모두 실제 데이터 */}
          <dl className="mt-5 grid grid-cols-4 rounded-[20px] border border-border bg-card py-3 text-center">
            <div className="flex flex-col-reverse">
              <dt className="text-[13px] text-muted-foreground">열린 원</dt>
              <dd className="font-num text-xl font-semibold">{meetups.length}</dd>
            </div>
            <div className="flex flex-col-reverse border-l border-border">
              <dt className="text-[13px] text-muted-foreground">지난 원</dt>
              <dd className="font-num text-xl font-semibold">{activity.length}{activity.length >= 10 ? "+" : ""}</dd>
            </div>
            <div className="flex flex-col-reverse border-x border-border">
              <dt className="text-[13px] text-muted-foreground">팔로워</dt>
              <dd className="font-num text-xl font-semibold">{follow.count.toLocaleString("ko-KR")}</dd>
            </div>
            <div className="flex flex-col-reverse">
              <dt className="text-[13px] text-muted-foreground">후기</dt>
              <dd className="font-num text-xl font-semibold">{reviewSummary.count}</dd>
            </div>
          </dl>
          <p className="mt-2 px-1 text-[13.5px] leading-relaxed text-muted-foreground">숫자는 라운디에서 실제로 일어난 것만 보여요.</p>
          {!introPending && !host.is_sample && <VerifiedChecklist className="mt-4" />}
          {/* 팔로워 수 (화면 읽기·검사용 문장) */}
          <p className="sr-only" data-testid="follower-count">
            팔로워 {follow.count.toLocaleString("ko-KR")}명
          </p>
        </div>

        {/* 2. 이 사람의 원 */}
        <section className={wrap} data-testid="host-programs">
          {title(`${host.display_name}의 원`)}
          {meetups.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-border px-5 py-8 text-center">
              <p className="text-muted-foreground">지금 열린 원이 없어요. 팔로우하면 새 원이 열릴 때 알려 드려요.</p>
              <Link href="/meetups" className="mt-3 inline-block text-sm font-semibold text-forest underline-offset-4 hover:underline">
                다른 원 둘러보기
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {soon.length > 0 && (
                <div data-testid="host-programs-soon">
                  {later.length > 0 && <h3 className="mb-2 text-sm font-semibold text-muted-foreground">곧 열려요</h3>}
                  <CircleGrid meetups={soon} categoryNames={names} />
                </div>
              )}
              {later.length > 0 && (
                <div data-testid="host-programs-later">
                  {soon.length > 0 && <h3 className="mb-2 text-sm font-semibold text-muted-foreground">예정된 원</h3>}
                  <CircleGrid meetups={later} categoryNames={names} />
                </div>
              )}
            </div>
          )}
        </section>

        {/* 2-1. 라운디 활동 기록 + 참가 후기 (실제 데이터만) */}
        <section className={wrap} data-testid="host-activity">
          {title("라운디 활동 기록")}
          {activity.length ? (
            <ul className="rounded-[20px] border border-border bg-card px-5 py-2 text-[15px]">
              {activity.map((a) => (
                <li key={`${a.meetup_id}-${a.starts_at}`} className="flex justify-between gap-3 border-b border-border py-3 last:border-0">
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground">{formatDate(a.starts_at)}</span> · {a.title}
                    {a.is_sample && " (샘플)"}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{a.reserved_count}/{a.capacity}명 신청</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[20px] border border-dashed border-border px-5 py-6 text-center text-[15px] text-muted-foreground">아직 라운디에서 열린 원이 없어요.</p>
          )}
        </section>
        <section className={wrap}>
          <div className="sheet rounded-[22px] px-5 pb-6 sm:px-7 [&>section]:mt-0 [&>section]:pt-6">
            <ReviewSection reviews={reviews} summary={reviewSummary} showProgram />
          </div>
        </section>

        {/* 3. 이야기 — 읽는 글은 밝은 종이에 */}
        <section className={wrap}>
          {title(`${host.display_name}의 이야기`)}
          {introPending ? (
            <div className="rounded-[20px] border border-dashed border-border px-5 py-8 text-center" data-testid="host-intro-pending">
              <p className="font-semibold">소개 준비 중</p>
              <p className="mt-1 text-sm text-muted-foreground">{host.display_name} 크리에이터가 직접 소개를 쓰고 있어요.</p>
              <Link href="/help" className="mt-3 inline-block text-sm font-semibold text-forest underline underline-offset-4">궁금한 점은 운영팀에 1:1로 물어보세요</Link>
            </div>
          ) : (
            <div className="sheet rounded-[22px] px-5 py-6 sm:px-7">
              {host.philosophy && (
                <blockquote className="rounded-xl bg-muted px-4 py-3 font-display text-[17px] leading-relaxed break-keep whitespace-pre-line" data-testid="host-philosophy">
                  {host.philosophy}
                </blockquote>
              )}
              <p className={`text-[15px] leading-[1.8] whitespace-pre-line ${host.philosophy ? "mt-4" : ""}`}>{host.bio}</p>
              <p className="sign mt-3 text-right text-sm">— {host.display_name} 드림</p>
            </div>
          )}
        </section>

        {/* 4. 경력과 자격 */}
        {(expertise.length > 0 || (host.portfolio_url && portfolio.length === 0)) && (
          <section className={wrap}>
            {title("경력과 자격")}
            <dl className="sheet rounded-[22px] px-5 sm:px-7" data-testid={expertise.length ? "host-credentials" : undefined}>
              {expertise.map((e) => (
                <div key={e.key} className="grid grid-cols-[5.5rem_1fr] gap-2 border-b border-border py-3 text-sm last:border-0">
                  <dt className="font-bold">{e.label}</dt>
                  <dd className={`leading-relaxed ${e.pre ? "whitespace-pre-line" : ""}`}>{e.value}</dd>
                </div>
              ))}
              {host.portfolio_url && portfolio.length === 0 && (
                <div className="grid grid-cols-[5.5rem_1fr] gap-2 py-3 text-sm">
                  <dt className="font-bold">포트폴리오</dt>
                  <dd>
                    <a href={host.portfolio_url} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline underline-offset-4">
                      {host.portfolio_url}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* 5. 포트폴리오 · 크리에이터의 글 (운영팀 검토를 거쳐 공개된 글만) */}
        {portfolio.length > 0 && (
          <section className={wrap} data-testid="host-portfolio">
            {title("포트폴리오")}
            <ContentGrid contents={portfolio} />
            {host.portfolio_url && (
              <a href={host.portfolio_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-4 inline-block text-sm font-semibold text-forest underline-offset-4 hover:underline">
                외부 포트폴리오 보기
              </a>
            )}
          </section>
        )}
        {stories.length > 0 && (
          <section className={wrap} data-testid="host-journal">
            {title(`${host.display_name}의 글`)}
            <ContentGrid contents={stories} />
          </section>
        )}
      </main>
      <SiteFooter />
    </Blue>
  );
}
