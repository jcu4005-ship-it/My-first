import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarDays, Check, Clock, MapPin, Users } from "lucide-react";
import { notFound } from "next/navigation";

import { FollowButton } from "@/components/hosts/follow-button";
import { SampleBadge, seatsLeft } from "@/components/meetups/badges";
import { Photo } from "@/components/media/photo";
import { RecordRecentlyViewed } from "@/components/recently-viewed";
import { categoryStyle } from "@/components/meetups/category-style";
import { EditorialCover } from "@/components/meetups/editorial-cover";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getCurrentMember } from "@/lib/auth/session";
import { myConfirmedSessionIds } from "@/lib/bookings/queries";
import { durationLabel, formatDate, formatPrice, formatTime } from "@/lib/format";
import { getFollowState } from "@/lib/hosting/follows";
import { getMeetup, listCategories } from "@/lib/meetups/queries";
import { CLASS_LEVEL_LABEL } from "@/lib/validation/meetup";

import { BookingForm } from "./booking-form";
import { hostAvatarUrl, hostHref } from "@/lib/hosting/avatar";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/meetups/[id]">): Promise<Metadata> {
  const { id } = await params;
  const meetup = await getMeetup(id);
  return meetup ? { title: meetup.title, description: meetup.summary } : { title: "프로그램을 찾을 수 없습니다" };
}

function InfoBlock({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border/70 py-8">
      <h2 className="mb-4 text-lg font-bold text-forest">{title}</h2>
      {children}
    </section>
  );
}

function CheckList({ items, testId }: { items: string[]; testId?: string }) {
  return (
    <ul className="flex flex-col gap-2.5" data-testid={testId}>
      {items.map((line, i) => (
        <li key={i} className="flex gap-2.5 leading-relaxed">
          <Check aria-hidden className="mt-1 size-4 shrink-0 text-forest" strokeWidth={2.2} />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

const lines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);

export default async function MeetupDetailPage({ params }: PageProps<"/meetups/[id]">) {
  const { id } = await params;
  const [meetup, categories, member] = await Promise.all([getMeetup(id), listCategories(), getCurrentMember()]);
  if (!meetup) notFound();
  const [mine, follow] = await Promise.all([
    member ? myConfirmedSessionIds(member.id, meetup.upcomingSessions.map((s) => s.id)) : Promise.resolve(new Set<string>()),
    meetup.host && !meetup.host.is_sample ? getFollowState(meetup.host.user_id, member?.id ?? null) : Promise.resolve(null),
  ]);
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
  const outcomes = lines(meetup.learning_outcomes);
  const audience = lines(meetup.target_audience);
  const avatar = meetup.host ? hostAvatarUrl(meetup.host.avatar_path) : null;
  const cta = anyOpen ? `참여하기 · ${formatPrice(meetup.price)}` : "모집 마감 · 일정 보기";

  return (
    <>
      <SiteHeader tabBar={false} />
      <RecordRecentlyViewed item={{ kind: "program", href: `/meetups/${meetup.id}`, title: meetup.title }} />
      <main className="flex-1 pb-24 lg:pb-0">
        {/* 1. 대표 이미지 + 제목 (사진 위) */}
        <div className="relative h-[62svh] max-h-[34rem] min-h-[22rem] w-full overflow-hidden bg-forest sm:h-[28rem]">
          <Photo
            src={meetup.cover_image_url}
            alt={meetup.title}
            priority
            sizes="100vw"
            fallback={<EditorialCover category={meetup.category_slug} title={meetup.title} size="hero" showTitle={false} showLabel={false} />}
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-forest-deep/90 via-forest-deep/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-6xl px-4 pb-12 text-white sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/meetups?category=${meetup.category_slug}`} className="pill bg-white/90 text-forest hover:bg-white">
                {category?.name ?? style.label}
              </Link>
              <span className="pill border border-white/50 text-white" data-testid="class-level">
                {CLASS_LEVEL_LABEL[meetup.level] ?? "누구나"}
              </span>
              {meetup.is_sample && <SampleBadge />}
            </div>
            <h1 className="mt-3 max-w-3xl font-display text-3xl leading-tight font-bold break-keep sm:text-5xl" data-testid="meetup-title">
              {meetup.title}
            </h1>
            <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">{meetup.summary}</p>
          </div>
        </div>

        {/* 2. 사진 위로 겹치는 둥근 본문 */}
        <div className="relative -mt-6 rounded-t-3xl bg-background">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-6 sm:px-6 sm:pt-8 lg:grid-cols-[1fr_340px] lg:gap-12">
            <article>
              {/* 호스트 */}
              {meetup.host && (
                <div className="flex items-center gap-3">
                  <Link href={hostHref(meetup.host)} className="group flex min-w-0 flex-1 items-center gap-3" data-testid="host-link">
                    <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest font-display text-xl text-cream">
                      {avatar ? <Photo src={avatar} alt="" sizes="56px" fallback={null} /> : <span aria-hidden>{meetup.host.display_name.slice(0, 1)}</span>}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 font-semibold group-hover:underline group-hover:underline-offset-4">
                        <span className="truncate">{meetup.host.display_name}</span>
                        <BadgeCheck aria-label="운영팀 심사를 통과한 호스트" className="size-4 shrink-0 text-forest" strokeWidth={2} />
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {meetup.host.occupation || meetup.host.headline}
                        {follow && ` · 팔로워 ${follow.count.toLocaleString("ko-KR")}명`}
                      </span>
                    </span>
                  </Link>
                  {follow && member?.id !== meetup.host.user_id && (
                    <FollowButton
                      hostId={meetup.host.user_id}
                      path={`/meetups/${meetup.id}`}
                      following={follow.following}
                      count={follow.count}
                      loggedIn={Boolean(member && member.status === "active")}
                      tone="light"
                    />
                  )}
                </div>
              )}
              {meetup.host?.career && (
                <p className="mt-4 rounded-xl bg-linen/70 px-4 py-3 text-sm leading-relaxed" data-testid="host-career">
                  경력 · {meetup.host.career}
                </p>
              )}

              {/* 바로가기 */}
              <nav aria-label="프로그램 안내 바로가기" className="no-scrollbar mt-6 flex gap-6 overflow-x-auto border-b border-border/70 text-sm whitespace-nowrap">
                {[
                  ["#about", "프로그램 소개"],
                  ...(meetup.agenda.length ? [["#curriculum", "진행 순서"]] : []),
                  ["#booking-section", "일정 선택"],
                ].map(([href, label], i) => (
                  <a key={href} href={href} className={i === 0 ? "-mb-px border-b-2 border-forest pb-3 font-semibold text-forest" : "pb-3 text-muted-foreground hover:text-foreground"}>
                    {label}
                  </a>
                ))}
              </nav>

              {/* 핵심 정보 */}
              <ul className="mt-6 flex flex-col gap-3 text-[15px]" id="about">
                {next && (
                  <>
                    <li className="flex items-center gap-3">
                      <CalendarDays aria-hidden className="size-5 shrink-0 text-forest" strokeWidth={1.6} />
                      {formatDate(next.starts_at)} {formatTime(next.starts_at)}
                      {meetup.upcomingSessions.length > 1 && <span className="text-muted-foreground">외 {meetup.upcomingSessions.length - 1}회</span>}
                    </li>
                    <li className="flex items-center gap-3">
                      <Clock aria-hidden className="size-5 shrink-0 text-forest" strokeWidth={1.6} />
                      {durationLabel(next.starts_at, next.ends_at)}
                    </li>
                    <li className="flex items-start gap-3">
                      <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-forest" strokeWidth={1.6} />
                      <span>
                        {next.area} · {next.venue_name}
                        <span className="block text-xs text-muted-foreground">상세 주소는 참가 확정 후 안내됩니다.</span>
                      </span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Users aria-hidden className="size-5 shrink-0 text-forest" strokeWidth={1.6} />
                      최대 {next.capacity}명 · {anyOpen ? `${seatsLeft(next)}자리 남음` : "모집 마감"}
                    </li>
                  </>
                )}
              </ul>

              {meetup.is_sample && (
                <p className="mt-6 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground">
                  서비스 준비 중 보여 드리는 <strong>샘플 프로그램</strong>입니다. 실제로 열리지 않으며 신청할 수 없어요.
                </p>
              )}

              <div className="mt-8">
                {audience.length > 0 && (
                  <InfoBlock title="이런 분께 추천해요">
                    <CheckList items={audience} />
                  </InfoBlock>
                )}

                {(outcomes.length > 0 || meetup.materials_note) && (
                  <InfoBlock title="수업이 끝나면 이렇게 할 수 있어요">
                    {outcomes.length > 0 && <CheckList items={outcomes} testId="learning-outcomes" />}
                    {meetup.materials_note && (
                      <p className="mt-4 rounded-xl bg-linen/70 px-4 py-3 text-sm leading-relaxed">
                        <span className="mr-2 font-semibold">재료·자료</span>
                        {meetup.materials_note}
                      </p>
                    )}
                  </InfoBlock>
                )}

                <InfoBlock title="프로그램 소개">
                  <p className="leading-relaxed whitespace-pre-line">{meetup.description}</p>
                </InfoBlock>

                {meetup.agenda.length > 0 && (
                  <InfoBlock title="진행 순서" id="curriculum">
                    <ol className="flex flex-col gap-3">
                      {meetup.agenda.map((a, i) => (
                        <li key={i} className="flex gap-4">
                          <span className="w-14 shrink-0 text-sm text-muted-foreground tabular-nums">{a.time}</span>
                          <span className="font-medium">{a.title}</span>
                        </li>
                      ))}
                    </ol>
                  </InfoBlock>
                )}

                {(meetup.what_to_bring || meetup.requirements) && (
                  <InfoBlock title="참여 안내">
                    <dl className="flex flex-col gap-4 text-sm">
                      {meetup.what_to_bring && (
                        <div>
                          <dt className="font-semibold">준비물</dt>
                          <dd className="mt-1 leading-relaxed text-muted-foreground">{meetup.what_to_bring}</dd>
                        </div>
                      )}
                      {meetup.requirements && (
                        <div>
                          <dt className="font-semibold">참여 조건</dt>
                          <dd className="mt-1 leading-relaxed text-muted-foreground">{meetup.requirements}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="font-semibold">1회 신청 인원</dt>
                        <dd className="mt-1 text-muted-foreground">최대 {meetup.max_quantity_per_booking}명</dd>
                      </div>
                    </dl>
                  </InfoBlock>
                )}

                {/* 일정 선택·신청 */}
                <InfoBlock title="일정 선택" id="booking-section">
                  {mine.size > 0 && (
                    <p className="mb-4 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="already-booked">
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
                      acceptCoupons={meetup.accept_coupons && meetup.price > 0}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">예정된 일정이 없습니다.</p>
                  )}
                </InfoBlock>

                {/* 참가자 후기 — 후기 기능이 생기면 이 자리에 실제 후기만 표시합니다 (지금은 숨김) */}

                {meetup.refund_policy_text && (
                  <InfoBlock title="취소 및 환불">
                    <p className="text-sm leading-relaxed text-muted-foreground">{meetup.refund_policy_text}</p>
                  </InfoBlock>
                )}
              </div>
            </article>

            {/* PC: 오른쪽 고정 신청 상자 */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-6">
                <p className="text-sm text-muted-foreground">참가비 (1인)</p>
                <p className="mt-1 text-3xl font-bold text-forest">{formatPrice(meetup.price)}</p>
                {next && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    가장 가까운 일정 · {formatDate(next.starts_at)} {formatTime(next.starts_at)}
                  </p>
                )}
                <Button asChild size="lg" className="mt-6 w-full">
                  <a href="#booking">{cta}</a>
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">일정과 남은 자리를 확인한 뒤 신청해 주세요.</p>
              </div>
            </aside>
          </div>
        </div>

        {/* 휴대폰: 아래 고정 신청 버튼 */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden" data-testid="mobile-cta">
          <Button asChild size="lg" className="w-full">
            <a href="#booking">{cta}</a>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
