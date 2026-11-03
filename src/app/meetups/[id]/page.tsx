import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SampleBadge, SeatsBadge, seatsLeft } from "@/components/meetups/badges";
import { EditorialCover } from "@/components/meetups/editorial-cover";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { durationLabel, formatDate, formatPrice, formatTime } from "@/lib/format";
import { getMeetup, listCategories } from "@/lib/meetups/queries";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/meetups/[id]">): Promise<Metadata> {
  const { id } = await params;
  const meetup = await getMeetup(id);
  return meetup ? { title: meetup.title, description: meetup.summary } : { title: "모임을 찾을 수 없습니다" };
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t py-8">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function MeetupDetailPage({ params }: PageProps<"/meetups/[id]">) {
  const { id } = await params;
  const [meetup, categories] = await Promise.all([getMeetup(id), listCategories()]);
  if (!meetup) notFound();
  const category = categories.find((c) => c.slug === meetup.category_slug);
  const next = meetup.nextSession;
  const anyOpen = meetup.upcomingSessions.some((s) => s.status === "open" && seatsLeft(s) > 0);

  return (
    <>
      <SiteHeader />
      <main className="flex-1 pb-28 sm:pb-0">
        <div className="mx-auto w-full max-w-6xl sm:px-8">
          <div className="relative overflow-hidden sm:rounded-3xl">
            <EditorialCover
              category={meetup.category_slug}
              categoryName={category?.name ?? ""}
              title={meetup.title}
              area={next?.area}
              size="hero"
            />
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-8 sm:px-8 lg:grid-cols-[1fr_340px]">
          <article>
            <div className="flex items-center gap-2">
              <Link href={`/meetups?category=${meetup.category_slug}`} className="text-sm text-accent">
                {category?.name}
              </Link>
              {meetup.is_sample && <SampleBadge />}
            </div>
            <h1 className="mt-2 font-display text-3xl leading-snug font-bold break-keep sm:text-4xl" data-testid="meetup-title">
              {meetup.title}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">{meetup.summary}</p>

            {meetup.is_sample && (
              <p className="mt-6 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground">
                서비스 준비 중 보여 드리는 <strong>샘플 모임</strong>입니다. 실제로 열리지 않으며 신청할 수 없어요.
              </p>
            )}

            <InfoBlock title="일정 선택">
              {meetup.upcomingSessions.length ? (
                <ul className="flex flex-col gap-3" data-testid="session-list">
                  {meetup.upcomingSessions.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-xl border px-4 py-3" data-testid="session-row">
                      <div>
                        <p className="font-medium">{formatDate(s.starts_at)}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatTime(s.starts_at)} · {durationLabel(s.starts_at, s.ends_at)} · {s.area}
                        </p>
                      </div>
                      <SeatsBadge session={s} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">예정된 일정이 없습니다.</p>
              )}
            </InfoBlock>

            <InfoBlock title="모임 소개">
              <p className="leading-relaxed whitespace-pre-line">{meetup.description}</p>
            </InfoBlock>

            {meetup.agenda.length > 0 && (
              <InfoBlock title="진행 순서">
                <ol className="relative flex flex-col gap-5 border-l pl-6">
                  {meetup.agenda.map((a, i) => (
                    <li key={i} className="relative">
                      <span className="absolute top-1.5 -left-[29px] size-2.5 rounded-full bg-foreground" />
                      <span className="text-sm text-muted-foreground tabular-nums">{a.time}</span>
                      <p className="font-medium">{a.title}</p>
                    </li>
                  ))}
                </ol>
              </InfoBlock>
            )}

            <InfoBlock title="참여 안내">
              <dl className="grid gap-5 text-sm sm:grid-cols-2">
                {meetup.target_audience && (
                  <div>
                    <dt className="text-muted-foreground">이런 분께 추천해요</dt>
                    <dd className="mt-1 leading-relaxed">{meetup.target_audience}</dd>
                  </div>
                )}
                {meetup.what_to_bring && (
                  <div>
                    <dt className="text-muted-foreground">준비물</dt>
                    <dd className="mt-1 leading-relaxed">{meetup.what_to_bring}</dd>
                  </div>
                )}
                {meetup.requirements && (
                  <div>
                    <dt className="text-muted-foreground">참여 조건</dt>
                    <dd className="mt-1 leading-relaxed">{meetup.requirements}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">장소</dt>
                  <dd className="mt-1 leading-relaxed">
                    {next ? `${next.area} · ${next.venue_name}` : "-"}
                    <span className="block text-xs text-muted-foreground">상세 주소는 참가 확정 후 안내됩니다.</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">1회 신청 인원</dt>
                  <dd className="mt-1">최대 {meetup.max_quantity_per_booking}명</dd>
                </div>
              </dl>
            </InfoBlock>

            {meetup.refund_policy_text && (
              <InfoBlock title="취소 및 환불">
                <p className="text-sm leading-relaxed text-muted-foreground">{meetup.refund_policy_text}</p>
              </InfoBlock>
            )}

            {meetup.host && (
              <InfoBlock title="호스트">
                <Link
                  href={`/hosts/${meetup.host.user_id}`}
                  className="flex items-start gap-4 rounded-2xl border p-5 transition-colors hover:border-foreground"
                  data-testid="host-link"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-lg font-bold">
                    {meetup.host.display_name.slice(0, 1)}
                  </span>
                  <span>
                    <span className="block font-semibold">{meetup.host.display_name}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{meetup.host.headline}</span>
                  </span>
                </Link>
              </InfoBlock>
            )}
          </article>

          {/* 데스크톱: 오른쪽 고정 신청 박스 */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 rounded-2xl border p-6">
              <p className="text-2xl font-bold">{formatPrice(meetup.price)}</p>
              {next && (
                <p className="mt-2 text-sm text-muted-foreground">
                  가장 가까운 일정 · {formatDate(next.starts_at)} {formatTime(next.starts_at)}
                </p>
              )}
              <Button size="lg" className="mt-6 w-full" disabled aria-disabled>
                {anyOpen ? "참가 신청 (곧 오픈)" : "모집 마감"}
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">참가 신청과 결제는 준비 중입니다.</p>
            </div>
          </aside>
        </div>

        {/* 모바일: 하단 고정 신청 바 */}
        <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden" data-testid="mobile-cta">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-lg font-bold">{formatPrice(meetup.price)}</p>
              <p className="text-xs text-muted-foreground">참가 신청 준비 중</p>
            </div>
            <Button size="lg" disabled aria-disabled>
              {anyOpen ? "곧 오픈" : "모집 마감"}
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
