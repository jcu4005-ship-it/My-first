import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SampleBadge, seatsLeft } from "@/components/meetups/badges";
import { Photo } from "@/components/media/photo";
import { categoryStyle } from "@/components/meetups/category-style";
import { EditorialCover } from "@/components/meetups/editorial-cover";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getCurrentMember } from "@/lib/auth/session";
import { myConfirmedSessionIds } from "@/lib/bookings/queries";
import { durationLabel, formatDate, formatPrice, formatTime } from "@/lib/format";
import { getMeetup, listCategories } from "@/lib/meetups/queries";
import { CLASS_LEVEL_LABEL } from "@/lib/validation/meetup";

import { BookingForm } from "./booking-form";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/meetups/[id]">): Promise<Metadata> {
  const { id } = await params;
  const meetup = await getMeetup(id);
  return meetup ? { title: meetup.title, description: meetup.summary } : { title: "프로그램을 찾을 수 없습니다" };
}

function InfoBlock({ eyebrow, title, children, id }: { eyebrow: string; title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24 border-t py-10 sm:py-12">
      <p className="eyebrow text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-2 mb-6 font-display text-2xl font-medium">{title}</h2>
      {children}
    </section>
  );
}

export default async function MeetupDetailPage({ params }: PageProps<"/meetups/[id]">) {
  const { id } = await params;
  const [meetup, categories, member] = await Promise.all([getMeetup(id), listCategories(), getCurrentMember()]);
  if (!meetup) notFound();
  const mine = member ? await myConfirmedSessionIds(member.id, meetup.upcomingSessions.map((s) => s.id)) : new Set<string>();
  const viewerState = meetup.is_sample ? "sample" : !member ? "guest" : meetup.host?.user_id === member.id ? "own" : "ok";
  const bookingSessions = meetup.upcomingSessions.map((s) => ({
    id: s.id,
    starts_at: s.starts_at,
    area: s.area,
    left: seatsLeft(s),
    open: s.status === "open",
    mine: mine.has(s.id),
  }));
  const category = categories.find((c) => c.slug === meetup.category_slug);
  const next = meetup.nextSession;
  const anyOpen = meetup.upcomingSessions.some((s) => s.status === "open" && seatsLeft(s) > 0);

  const style = categoryStyle(meetup.category_slug);
  const outcomes = meetup.learning_outcomes.split("\n").map((line) => line.trim()).filter(Boolean);

  return (
    <>
      <SiteHeader />
      <main className="flex-1 pb-28 lg:pb-0">
        {/* 1. 대표 이미지 */}
        <div className={`relative w-full overflow-hidden bg-espresso ${meetup.cover_image_url ? "aspect-[4/5] sm:aspect-[21/9]" : "aspect-[16/9] sm:aspect-[3/1]"}`}>
          <Photo
            src={meetup.cover_image_url}
            alt={meetup.title}
            priority
            sizes="100vw"
            fallback={<EditorialCover category={meetup.category_slug} title={meetup.title} area={next?.area} size="hero" showTitle={false} />}
          />
        </div>

        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 pt-10 sm:px-8 sm:pt-14 lg:grid-cols-[1fr_360px] lg:gap-16">
          <article>
            {/* 2. 제목·소개 */}
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/meetups?category=${meetup.category_slug}`} className="eyebrow text-muted-foreground hover:text-foreground">
                {style.label} <span className="sr-only">{category?.name}</span>
              </Link>
              <span className="border border-current/40 px-2 py-0.5 text-xs" data-testid="class-level">
                {CLASS_LEVEL_LABEL[meetup.level] ?? "누구나"}
              </span>
              {meetup.is_sample && <SampleBadge />}
            </div>
            <h1 className="mt-4 font-display text-3xl leading-tight font-medium break-keep sm:text-5xl" data-testid="meetup-title">
              {meetup.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{meetup.summary}</p>
            {next && (
              <dl className="mt-8 grid grid-cols-2 gap-px bg-border text-sm sm:grid-cols-4">
                {[
                  ["Date", `${formatDate(next.starts_at)}`],
                  ["Time", `${formatTime(next.starts_at)} · ${durationLabel(next.starts_at, next.ends_at)}`],
                  ["Place", next.area],
                  ["Price", formatPrice(meetup.price)],
                ].map(([k, v]) => (
                  <div key={k} className="bg-background py-3 pr-3">
                    <dt className="eyebrow text-muted-foreground">{k}</dt>
                    <dd className="mt-1 font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            )}

            {meetup.is_sample && (
              <p className="mt-8 bg-notice px-4 py-3 text-sm text-notice-foreground">
                서비스 준비 중 보여 드리는 <strong>샘플 프로그램</strong>입니다. 실제로 열리지 않으며 신청할 수 없어요.
              </p>
            )}

            {/* 3. 호스트 */}
            {meetup.host && (
              <InfoBlock eyebrow="Who will teach you" title="호스트">
                <Link
                  href={`/hosts/${meetup.host.user_id}`}
                  className="group grid grid-cols-[4.5rem_1fr] gap-5 sm:grid-cols-[6rem_1fr]"
                  data-testid="host-link"
                >
                  <span className="flex aspect-[4/5] items-center justify-center bg-espresso font-display text-3xl text-sand-light">
                    {meetup.host.display_name.slice(0, 1)}
                  </span>
                  <span>
                    <span className="block font-display text-xl font-medium group-hover:underline group-hover:underline-offset-4">
                      {meetup.host.display_name}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{meetup.host.headline}</span>
                    {meetup.host.career && (
                      <span className="mt-3 block border-l-2 border-terracotta pl-3 text-sm leading-relaxed" data-testid="host-career">
                        경력 · {meetup.host.career}
                      </span>
                    )}
                  </span>
                </Link>
              </InfoBlock>
            )}

            {/* 4. 배우는 것·가져가는 것 */}
            {(outcomes.length > 0 || meetup.materials_note) && (
              <InfoBlock eyebrow="What you will learn" title="수업이 끝나면 이렇게 할 수 있어요">
                {outcomes.length > 0 && (
                  <ol className="flex flex-col" data-testid="learning-outcomes">
                    {outcomes.map((line, i) => (
                      <li key={i} className="grid grid-cols-[2.5rem_1fr] border-b py-4 leading-relaxed">
                        <span className="font-display text-terracotta-deep">{String(i + 1).padStart(2, "0")}</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {meetup.materials_note && (
                  <p className="mt-6 bg-sand px-4 py-3 text-sm leading-relaxed">
                    <span className="eyebrow mr-2 text-muted-foreground">Materials</span>
                    {meetup.materials_note}
                  </p>
                )}
              </InfoBlock>
            )}

            <InfoBlock eyebrow="About this class" title="프로그램 소개">
              <p className="leading-relaxed whitespace-pre-line">{meetup.description}</p>
            </InfoBlock>

            {/* 5. 커리큘럼 */}
            {meetup.agenda.length > 0 && (
              <InfoBlock eyebrow="Curriculum" title="진행 순서">
                <ol className="flex flex-col">
                  {meetup.agenda.map((a, i) => (
                    <li key={i} className="grid grid-cols-[4.5rem_1fr] border-b py-4">
                      <span className="text-sm text-muted-foreground tabular-nums">{a.time}</span>
                      <p className="font-medium">{a.title}</p>
                    </li>
                  ))}
                </ol>
              </InfoBlock>
            )}

            <InfoBlock eyebrow="Details" title="참여 안내">
              <dl className="grid gap-6 text-sm sm:grid-cols-2">
                {meetup.target_audience && (
                  <div>
                    <dt className="eyebrow text-muted-foreground">이런 분께 추천해요</dt>
                    <dd className="mt-2 leading-relaxed">{meetup.target_audience}</dd>
                  </div>
                )}
                {meetup.what_to_bring && (
                  <div>
                    <dt className="eyebrow text-muted-foreground">준비물</dt>
                    <dd className="mt-2 leading-relaxed">{meetup.what_to_bring}</dd>
                  </div>
                )}
                {meetup.requirements && (
                  <div>
                    <dt className="eyebrow text-muted-foreground">참여 조건</dt>
                    <dd className="mt-2 leading-relaxed">{meetup.requirements}</dd>
                  </div>
                )}
                <div>
                  <dt className="eyebrow text-muted-foreground">장소</dt>
                  <dd className="mt-2 leading-relaxed">
                    {next ? `${next.area} · ${next.venue_name}` : "-"}
                    <span className="block text-xs text-muted-foreground">상세 주소는 참가 확정 후 안내됩니다.</span>
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow text-muted-foreground">1회 신청 인원</dt>
                  <dd className="mt-2">최대 {meetup.max_quantity_per_booking}명</dd>
                </div>
              </dl>
            </InfoBlock>

            {/* 6. 일정 선택·신청 */}
            <InfoBlock eyebrow="Schedule" title="일정 선택" id="booking-section">
              {mine.size > 0 && (
                <p className="mb-4 bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="already-booked">
                  이 프로그램에 신청한 일정이 있어요. <Link href="/me/bookings" className="underline underline-offset-4">신청 내역 보기</Link>
                </p>
              )}
              {bookingSessions.length ? (
                <BookingForm
                  meetupId={meetup.id}
                  price={meetup.price}
                  maxQuantity={meetup.max_quantity_per_booking}
                  sessions={bookingSessions}
                  state={viewerState}
                />
              ) : (
                <p className="text-sm text-muted-foreground">예정된 일정이 없습니다.</p>
              )}
            </InfoBlock>

            {/* 7. 참가자 후기 — 후기 기능이 생기면 이 자리에 실제 후기만 표시합니다 (지금은 숨김) */}

            {meetup.refund_policy_text && (
              <InfoBlock eyebrow="Cancellation" title="취소 및 환불">
                <p className="text-sm leading-relaxed text-muted-foreground">{meetup.refund_policy_text}</p>
              </InfoBlock>
            )}
          </article>

          {/* 8. 가격·예약 (데스크톱 고정) */}
          <aside className="hidden lg:block">
            <div className="sticky top-8 bg-espresso p-8 text-sand-light">
              <p className="eyebrow text-sand/70">Reserve</p>
              <p className="mt-3 font-display text-4xl">{formatPrice(meetup.price)}</p>
              {next && (
                <p className="mt-3 text-sm text-sand/80">
                  가장 가까운 일정 · {formatDate(next.starts_at)} {formatTime(next.starts_at)}
                </p>
              )}
              <Button asChild size="lg" variant="secondary" className="mt-8 w-full">
                <a href="#booking">{anyOpen ? "일정 선택하고 신청하기" : "모집 마감"}</a>
              </Button>
              <p className="mt-4 text-xs leading-relaxed text-sand/70">일정과 남은 자리를 확인한 뒤 신청해 주세요.</p>
            </div>
          </aside>
        </div>

        {/* 모바일: 하단 고정 신청 바 */}
        <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-espresso px-4 py-3 text-sand-light lg:hidden" data-testid="mobile-cta">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <p className="font-display text-xl">{formatPrice(meetup.price)}</p>
              <p className="text-xs text-sand/75">{anyOpen ? "1인 기준" : "모집 마감"}</p>
            </div>
            <Button asChild size="lg" variant="secondary">
              <a href="#booking">{anyOpen ? "신청하기" : "일정 보기"}</a>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
