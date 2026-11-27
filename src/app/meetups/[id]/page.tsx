import { COUPONS_ENABLED } from "@/config/platform-policy";
import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarDays, CircleHelp, CreditCard, MapPin, Package, Users } from "lucide-react";
import { notFound } from "next/navigation";

import { SeatCircle, SeatLegend } from "@/components/brand/seat-circle";
import { Blue } from "@/components/layout/blue";
import { brand } from "@/config/brand";
import { FollowButton } from "@/components/hosts/follow-button";
import { SampleBadge, seatsLeft } from "@/components/meetups/badges";
import { Photo } from "@/components/media/photo";
import { RecordRecentlyViewed } from "@/components/recently-viewed";
import { categoryStyle } from "@/components/meetups/category-style";
import { SaveButton } from "@/components/saved";
import { EditorialCover } from "@/components/meetups/editorial-cover";
import { CircleCard, seatLine } from "@/components/meetups/circle-card";
import { ShareBar } from "@/components/meetups/share-bar";
import { ReviewSection } from "@/components/reviews/review-list";
import { getReviewSummary, listPublicReviews } from "@/lib/reviews/queries";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getCurrentMember } from "@/lib/auth/session";
import { myConfirmedSessionIds } from "@/lib/bookings/queries";
import { durationLabel, formatDate, formatPrice, formatTime, secondsUntil } from "@/lib/format";
import { getFollowState } from "@/lib/hosting/follows";
import { getHost, getMeetup, listCategories, listHostActivity, listUpcomingMeetups } from "@/lib/meetups/queries";
import { isDemoProfile } from "@/lib/hosting/demo";
import { REFUND_RULES, refundNowLine } from "@/lib/payments/refund-policy";
import { RefundLadder } from "@/components/trust/proofs";
import { getAppSettings } from "@/lib/settings/queries";
import { CLASS_LEVEL_LABEL } from "@/lib/validation/meetup";

import { BookingForm } from "./booking-form";
import { WaitlistPanel } from "./waitlist-panel";
import { listMyWaitlist } from "@/lib/bookings/waitlist";
import { creatorPhoto, hostHref } from "@/lib/hosting/avatar";
import { isNotYetOpen, opensLabel } from "@/lib/meetups/drops";
import { listMyOpenAlerts } from "@/lib/meetups/open-alerts";
import { OpensCountdown } from "@/components/meetups/opens-countdown";
import { OpenAlertButton } from "@/components/meetups/open-alert-button";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/meetups/[id]">): Promise<Metadata> {
  const { id } = await params;
  const meetup = await getMeetup(id);
  return meetup ? { title: meetup.title, description: meetup.summary } : { title: "프로그램을 찾을 수 없습니다" };
}

/** 본문 묶음: 위 선 + 제목 (종이 시트 안) */
function Block({ title, children, id, testId }: { title: string; children: React.ReactNode; id?: string; testId?: string }) {
  return (
    <section id={id} className="mb-10 scroll-mt-24 last:mb-0" data-testid={testId}>
      <h2 className="font-display border-t border-foreground pt-3 text-[24px]">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** 번호 목록 (얻는 것·추천 대상) */
function NumberedList({ items, testId }: { items: string[]; testId?: string }) {
  return (
    <ol data-testid={testId}>
      {items.map((line, i) => (
        <li key={i} className="grid grid-cols-[1.75rem_1fr] border-b border-border py-3 text-[15.5px] leading-relaxed">
          <span aria-hidden className="pt-1 text-[14px] font-extrabold text-clay">—</span>
          <span>{line}</span>
        </li>
      ))}
    </ol>
  );
}

const lines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);

export default async function MeetupDetailPage({ params }: PageProps<"/meetups/[id]">) {
  const { id } = await params;
  const [meetup, categories, member, settings] = await Promise.all([getMeetup(id), listCategories(), getCurrentMember(), getAppSettings()]);
  if (!meetup) notFound();
  const [mine, follow, reviews, reviewSummary, myWaitlist, hostPrograms, hostFull, activity, hostReviews, myAlerts] = await Promise.all([
    member ? myConfirmedSessionIds(member.id, meetup.upcomingSessions.map((s) => s.id)) : Promise.resolve(new Set<string>()),
    meetup.host ? getFollowState(meetup.host.user_id, member?.id ?? null) : Promise.resolve(null),
    listPublicReviews({ meetupId: meetup.id }),
    getReviewSummary({ meetupId: meetup.id }),
    member ? listMyWaitlist() : Promise.resolve([]),
    meetup.host ? listUpcomingMeetups({ hostId: meetup.host.user_id }) : Promise.resolve([]),
    meetup.host ? getHost(meetup.host.user_id).catch(() => null) : Promise.resolve(null),
    meetup.host ? listHostActivity(meetup.host.user_id, 6) : Promise.resolve([]),
    meetup.host ? getReviewSummary({ hostId: meetup.host.user_id }) : Promise.resolve({ count: 0, avg: null }),
    member ? listMyOpenAlerts() : Promise.resolve([]),
  ]);
  const alertOn = new Set(myAlerts.map((a) => a.session_id));
  const otherPrograms = hostPrograms.filter((m) => m.id !== meetup.id).slice(0, 3);
  const waiting = new Set(myWaitlist.map((w) => w.session_id));
  // 비공개 베타: 유료 프로그램 신청 막음 (DB도 한 번 더 막음)
  const betaPaid = meetup.price > 0 && !settings.paid_bookings_enabled;
  const viewerState = meetup.is_sample ? "sample" : betaPaid ? "beta_paid" : !member ? "guest" : meetup.host?.user_id === member.id ? "own" : "ok";
  const bookingSessions = meetup.upcomingSessions.map((s) => ({
    id: s.id,
    starts_at: s.starts_at,
    area: s.area,
    left: seatsLeft(s),
    capacity: s.capacity,
    reserved: s.reserved_count,
    open: s.status === "open",
    mine: mine.has(s.id),
    opensAt: s.opens_at,
    notYetOpen: isNotYetOpen(s),
  }));
  const category = categories.find((c) => c.slug === meetup.category_slug);
  const next = meetup.nextSession;
  const anyOpen = meetup.upcomingSessions.some((s) => s.status === "open" && seatsLeft(s) > 0 && !isNotYetOpen(s));
  // 열림 시각(드롭)이 아직 안 된 일정 — 가장 가까운 열림 순
  const unopened = meetup.upcomingSessions.filter((s) => s.status === "open" && isNotYetOpen(s)).sort((a, b) => (a.opens_at as string).localeCompare(b.opens_at as string));
  const nextUnopened = unopened[0] ?? null;
  const loggedIn = Boolean(member && member.status === "active");

  const style = categoryStyle(meetup.category_slug);
  const outcomes = lines(meetup.learning_outcomes);
  const audience = lines(meetup.target_audience);
  const avatar = meetup.host ? creatorPhoto(meetup.host) : null;
  // 신청할 수 없는 프로그램(샘플·베타 유료)은 버튼이 신청되는 것처럼 보이지 않게
  const cannotBook = viewerState === "sample" || viewerState === "beta_paid";
  const ctaShort = cannotBook ? (viewerState === "sample" ? "예시 프로그램 · 신청 불가" : "지금은 신청 불가 · 일정 보기") : anyOpen ? "이 자리에 앉기" : nextUnopened ? "열리면 알림 받기" : "대기 · 일정 보기";
  const cta = cannotBook ? ctaShort : anyOpen ? `이 자리에 앉기 · ${formatPrice(meetup.price)}` : nextUnopened ? `${opensLabel(nextUnopened.opens_at as string)}에 열려요` : "원이 가득 찼어요 · 일정 보기";
  // 소개를 아직 쓰지 않은 호스트(이름·분야만 등록)에게는 "심사 통과" 표시를 붙이지 않음
  const hostVerified = Boolean(meetup.host && (meetup.host.bio || meetup.host.headline) && !isDemoProfile(meetup.host));
  const more = meetup.upcomingSessions.length - 1;
  // 맨 위 사진: 크리에이터 사진 우선(대표 결정), 없으면 프로그램 대표 사진
  const coverPhoto = avatar ?? meetup.cover_image_url;
  const coverIsCreator = Boolean(avatar);
  const nextLeft = next ? seatsLeft(next) : 0;
  const nextNotOpen = next ? isNotYetOpen(next) : false;
  const nextLine = next ? (nextNotOpen ? { text: `${opensLabel(next.opens_at as string)}에 열려요`, closed: false, left: nextLeft } : seatLine(next)) : null;
  const initial = meetup.host?.display_name.slice(0, 1) ?? meetup.title.slice(0, 1);

  /** 원 + 먼저 앉은 사람 (다음 일정 기준, 실제 예약 수) */
  const circle = next && (
    <div className="flex flex-col items-center">
      <div className="w-[min(56vw,220px)] lg:w-[260px]">
        <SeatCircle
          capacity={next.capacity}
          taken={next.reserved_count}
          you={nextLine?.closed || cannotBook || nextNotOpen ? false : "open"}
          closed={nextNotOpen}
          face={avatar ?? meetup.cover_image_url}
          initial={initial}
          label={nextLine?.closed || cannotBook || nextNotOpen ? undefined : "당신 자리"}
        />
      </div>
      <SeatLegend className="mt-3" closed={nextNotOpen} />
      <p className={`mt-3 text-center text-[17px] font-bold tracking-[-0.02em] ${nextLine?.closed ? "text-muted-foreground" : "text-forest"}`} data-testid="seat-line">
        {nextLine?.text}
      </p>
    </div>
  );

  return (
    <Blue>
      <SiteHeader tabBar={false} />
      <RecordRecentlyViewed item={{ kind: "program", href: `/meetups/${meetup.id}`, title: meetup.title }} />
      <main className="flex-1 pb-28 lg:pb-0">
        <div className="mx-auto grid w-full max-w-6xl gap-8 sm:px-6 lg:grid-cols-[1fr_430px] lg:gap-11 lg:pt-8">
          <div className="min-w-0">
            {/* 1. 표지: 크리에이터 사진(없으면 프로그램 대표 사진) + 제목 */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted sm:rounded-[28px] lg:aspect-[16/11]">
              <Photo
                src={coverPhoto}
                alt={coverIsCreator ? `${meetup.host?.display_name ?? ""} 사진` : meetup.title}
                priority
                sizes="(min-width: 1024px) 58vw, 100vw"
                className={coverIsCreator ? "object-[50%_18%]" : undefined}
                fallback={<EditorialCover category={meetup.category_slug} title={meetup.title} size="hero" showTitle={false} showLabel={false} className="!bg-[#dfe6e0] !text-[#111827]" />}
              />
              <SaveButton
                item={{ id: meetup.id, title: meetup.title, meta: next ? `${formatDate(next.starts_at)} · ${next.area}` : "" }}
                tone="dark"
                className="absolute top-3 right-3"
              />
            </div>

            <div className="px-4 pt-5 sm:px-0 sm:pt-6">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/meetups?category=${meetup.category_slug}`} className="cap cap-kr border border-border bg-card px-3 py-1.5 hover:border-foreground/40">
                  {category?.name ?? style.label}
                </Link>
                <span className="cap cap-kr border border-border bg-card px-3 py-1.5" data-testid="class-level">
                  {CLASS_LEVEL_LABEL[meetup.level] ?? "누구나"}
                </span>
                {meetup.is_sample && <SampleBadge />}
              </div>
              <h1 className="mt-3 font-display text-[29px] leading-[1.22] break-keep sm:text-[44px]" data-testid="meetup-title">
                {meetup.title}
              </h1>
            </div>

            {/* 2. 크리에이터 */}
            <div className="px-4 sm:px-0">
              {meetup.host && (
                <div className="mt-5 flex items-center gap-3">
                  <Link href={hostHref(meetup.host)} className="group flex min-w-0 flex-1 items-center gap-2.5" data-testid="host-link">
                    <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-display text-base font-bold text-forest">
                      {avatar ? <Photo src={avatar} alt="" sizes="44px" fallback={null} className="object-[50%_15%]" /> : <span aria-hidden>{initial}</span>}
                    </span>
                    <span className="min-w-0 text-[15px]">
                      <span className="flex items-center gap-1">
                        <b className="truncate group-hover:underline group-hover:underline-offset-4">{meetup.host.display_name}</b>
                        {hostVerified && <BadgeCheck aria-label="운영팀 심사를 통과한 크리에이터" className="size-4 shrink-0 text-forest" strokeWidth={2} />}
                      </span>
                      <span className="block truncate text-[13.5px] text-muted-foreground">
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
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">
                  경력 · {meetup.host.career}
                </p>
              )}

              {/* 3. 휴대폰: 원 (PC는 오른쪽에) */}
              <div className="mt-8 lg:hidden">{circle}</div>

              {/* 4. 신청 전 확인하세요 — 결제 전에 필요한 정보 전부 */}
              <section className="mt-8 rounded-[22px] border border-border bg-card px-5 pt-5 pb-2" data-testid="before-you-pay">
                <h2 className="font-display text-[26px]">신청 전 확인하세요</h2>
                <dl className="mt-2 text-[15px]">
                  {next && (
                    <div className="grid grid-cols-[1.5rem_5rem_1fr] items-start border-b border-border py-3.5">
                      <CalendarDays aria-hidden className="mt-0.5 size-[18px] text-muted-foreground" strokeWidth={1.7} />
                      <dt className="font-semibold text-muted-foreground">일정</dt>
                      <dd>
                        {formatDate(next.starts_at)} {formatTime(next.starts_at)} · {durationLabel(next.starts_at, next.ends_at)}
                        {more > 0 && <span className="block text-[14px] text-muted-foreground">다른 일정 {more}개 더 있어요</span>}
                      </dd>
                    </div>
                  )}
                  {next && (
                    <div className="grid grid-cols-[1.5rem_5rem_1fr] items-start border-b border-border py-3.5">
                      <MapPin aria-hidden className="mt-0.5 size-[18px] text-muted-foreground" strokeWidth={1.7} />
                      <dt className="font-semibold text-muted-foreground">장소</dt>
                      <dd>
                        {next.area} · {next.venue_name}
                        <span className="block text-[14px] text-muted-foreground">상세 주소는 참가 확정 후 안내됩니다</span>
                      </dd>
                    </div>
                  )}
                  {next && (
                    <div className="grid grid-cols-[1.5rem_5rem_1fr] items-start border-b border-border py-3.5">
                      <Users aria-hidden className="mt-0.5 size-[18px] text-muted-foreground" strokeWidth={1.7} />
                      <dt className="font-semibold text-muted-foreground">인원</dt>
                      <dd>
                        정원 {next.capacity}명 · {next.status !== "open" || nextLeft === 0 ? "마감" : <b className="text-forest">{next.reserved_count > 0 ? `${next.reserved_count}명 신청 · ` : "아직 신청 전 · "}{nextLeft}자리 남음</b>}
                        <span className="block text-[14px] text-muted-foreground">난이도 {CLASS_LEVEL_LABEL[meetup.level] ?? "누구나"} · 한 번에 최대 {meetup.max_quantity_per_booking}명 신청</span>
                      </dd>
                    </div>
                  )}
                  <div className="grid grid-cols-[1.5rem_5rem_1fr] items-start border-b border-border py-3.5">
                    <CreditCard aria-hidden className="mt-0.5 size-[18px] text-muted-foreground" strokeWidth={1.7} />
                    <dt className="font-semibold text-muted-foreground">참가비</dt>
                    <dd>
                      <b className="font-num text-[17px] font-semibold">{meetup.price > 0 ? formatPrice(meetup.price) : "무료"}</b> <span className="text-muted-foreground">(1인)</span>
                      {meetup.materials_note && <span className="block text-[14px] text-muted-foreground">포함 · {meetup.materials_note}</span>}
                      <span className="block text-[14px] text-muted-foreground">결제는 {brand.name} 안에서만 · 지금은 테스트 결제(실제 청구 없음)</span>
                    </dd>
                  </div>
                  {(meetup.what_to_bring || meetup.requirements) && (
                    <div className="grid grid-cols-[1.5rem_5rem_1fr] items-start border-b border-border py-3.5">
                      <Package aria-hidden className="mt-0.5 size-[18px] text-muted-foreground" strokeWidth={1.7} />
                      <dt className="font-semibold text-muted-foreground">준비</dt>
                      <dd>
                        {meetup.what_to_bring && <span className="block">준비물 · {meetup.what_to_bring}</span>}
                        {meetup.requirements && <span className="block text-[14px] text-muted-foreground">참여 조건 · {meetup.requirements}</span>}
                      </dd>
                    </div>
                  )}
                  <div className="grid grid-cols-[1.5rem_5rem_1fr] items-start py-3.5">
                    <CircleHelp aria-hidden className="mt-0.5 size-[18px] text-muted-foreground" strokeWidth={1.7} />
                    <dt className="font-semibold text-muted-foreground">취소</dt>
                    <dd>
                      {next ? (
                        <>
                          <b data-testid="refund-now-line">{refundNowLine(next.starts_at)}</b>
                          <RefundLadder startsAt={next.starts_at} className="mt-2.5" />
                          <span className="mt-1.5 block text-[13.5px] text-muted-foreground">프로그램 날짜 기준(한국 시간)</span>
                        </>
                      ) : (
                        "3일 전까지 100% · 2~1일 전 50% · 당일 환불 없음"
                      )}
                      <span className="mt-1 block text-[14px] text-muted-foreground">
                        크리에이터 사정으로 취소되면 전액 환불 ·{" "}
                        <a href="#refund" className="underline underline-offset-4">자세히</a> · <Link href="/help/contact" className="underline underline-offset-4">문의하기</Link>
                      </span>
                    </dd>
                  </div>
                </dl>
              </section>
              <ShareBar
                title={meetup.title}
                path={`/meetups/${meetup.id}`}
                calendarHref={next && !meetup.is_sample ? `/meetups/${meetup.id}/calendar?session=${next.id}` : undefined}
              />

              {/* 5. 자리와 신청 */}
              <section id="booking-section" className="mt-10 scroll-mt-24">
                <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">자리 고르기</h2>
                <div className="mt-4">
                  {meetup.is_sample && (
                    <p className="mb-4 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground">
                      서비스 준비 중 보여 드리는 <strong>샘플 프로그램</strong>이에요. 실제로 열리지 않으며 신청할 수 없어요.
                    </p>
                  )}
                  {mine.size > 0 && (
                    <p className="mb-4 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="already-booked">
                      이 프로그램에 앉은 자리가 있어요. <Link href="/me/bookings" className="underline underline-offset-4">내 자리 보기</Link>
                    </p>
                  )}
                  {unopened.length > 0 && !cannotBook && (
                    <div className="mb-5 rounded-[22px] border border-gold/50 bg-card p-5" data-testid="drop-panel">
                      <p className="text-[13.5px] font-bold text-forest">정해진 시각에 열려요</p>
                      <p className="mt-1 font-display text-[22px] font-bold tracking-[-0.02em]" data-testid="drop-opens-label">
                        {opensLabel(nextUnopened!.opens_at as string)}에 열려요
                      </p>
                      <p className="mt-1 text-[15px] text-muted-foreground">
                        열리기 전에는 신청할 수 없어요. 열리는 순간 먼저 신청한 분부터 자리가 정해져요. 자리 수는 실제 정원이에요.
                      </p>
                      <OpensCountdown className="mt-4" opensAt={nextUnopened!.opens_at as string} initialSeconds={secondsUntil(nextUnopened!.opens_at as string)} />
                      {viewerState !== "own" && (
                        <div className="mt-4 flex flex-col gap-2.5">
                          {unopened.slice(0, 3).map((u) => (
                            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3" data-testid="drop-session">
                              <span className="text-[15px]">
                                {formatDate(u.starts_at)} {formatTime(u.starts_at)} 프로그램 · <b>{opensLabel(u.opens_at as string)}</b> 오픈
                              </span>
                              <OpenAlertButton meetupId={meetup.id} sessionId={u.id} on={alertOn.has(u.id)} loggedIn={loggedIn} size="sm" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {bookingSessions.length ? (
                    <BookingForm
                      meetupId={meetup.id}
                      price={meetup.price}
                      maxQuantity={meetup.max_quantity_per_booking}
                      sessions={bookingSessions}
                      state={viewerState}
                      acceptCoupons={COUPONS_ENABLED && meetup.accept_coupons && meetup.price > 0}
                      face={avatar ?? meetup.cover_image_url}
                      initial={initial}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">예정된 일정이 없어요.</p>
                  )}
                  {(viewerState === "ok" || viewerState === "guest") && (
                    <WaitlistPanel
                      meetupId={meetup.id}
                      sessions={bookingSessions.filter((s) => s.open && s.left === 0 && !s.mine)}
                      waiting={waiting}
                      loggedIn={viewerState === "ok"}
                    />
                  )}
                  {!meetup.is_sample && meetup.price > 0 && (
                    <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground" data-testid="payment-safety">
                      참가비는 {brand.name}에서만 결제해요. 계좌 송금이나 현장 결제를 요청받으면{" "}
                      <Link href="/help/contact" className="underline underline-offset-4">고객센터</Link>로 알려 주세요.
                    </p>
                  )}
                </div>
              </section>

              {/* 6. 프로그램 소개 (아이보리) */}
              <article className="sheet mt-10 rounded-[24px] px-5 py-7 sm:px-8 sm:py-9" data-testid="program-intro">
                <p className="text-[14px] font-semibold text-muted-foreground">프로그램 소개</p>
                <h2 className="mt-1 font-display text-[24px] leading-snug font-bold tracking-[-0.02em] break-keep">{meetup.title}</h2>
                <div className="mt-6">
                  <Block title="이런 시간이에요">
                    {coverIsCreator && meetup.cover_image_url && (
                      <figure className="relative mb-5 aspect-[16/10] overflow-hidden rounded-[14px] bg-linen" data-testid="program-photo">
                        <Photo src={meetup.cover_image_url} alt={meetup.title} sizes="(min-width: 1024px) 58vw, 100vw" fallback={null} />
                      </figure>
                    )}
                    <p className="text-[16.5px] leading-[1.9] whitespace-pre-line">{meetup.description}</p>
                  </Block>
                  {audience.length > 0 && (
                    <Block title="이런 분께 추천해요">
                      <NumberedList items={audience} />
                    </Block>
                  )}
                  {(outcomes.length > 0 || meetup.materials_note) && (
                    <Block title="이 프로그램에서 얻는 것">
                      {outcomes.length > 0 && <NumberedList items={outcomes} testId="learning-outcomes" />}
                      {meetup.materials_note && (
                        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                          <b className="mr-2 text-foreground">재료·자료</b>
                          {meetup.materials_note}
                        </p>
                      )}
                    </Block>
                  )}
                  {meetup.agenda.length > 0 && (
                    <Block title="그날의 순서" id="curriculum">
                      <ol>
                        {meetup.agenda.map((a, i) => (
                          <li key={i} className="grid grid-cols-[4rem_1fr] border-b border-border py-3 text-[16px]">
                            <span className="pt-0.5 text-[14px] font-bold text-clay tabular-nums">{a.time}</span>
                            <span>{a.title}</span>
                          </li>
                        ))}
                      </ol>
                    </Block>
                  )}
                </div>
              </article>

              {/* 7. 크리에이터 소개 (아이보리) — 실제 등록된 정보만 */}
              {meetup.host && (
                <section className="sheet mt-6 rounded-[24px] px-5 py-7 sm:px-8 sm:py-9" data-testid="host-intro">
                  <p className="text-[14px] font-semibold text-muted-foreground">크리에이터 소개</p>
                  <div className="mt-3 flex items-center gap-4">
                    <span className="relative flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-display text-2xl font-bold text-forest">
                      {avatar ? <Photo src={avatar} alt={`${meetup.host.display_name} 사진`} sizes="72px" fallback={null} className="object-[50%_15%]" /> : <span aria-hidden>{initial}</span>}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[21px] font-bold tracking-[-0.02em]">
                        {meetup.host.display_name}
                        {hostVerified && <BadgeCheck aria-label="운영팀 심사를 통과한 크리에이터" className="size-5 shrink-0 text-forest" strokeWidth={2} />}
                      </p>
                      <p className="text-[15px] text-muted-foreground">{hostFull?.occupation || meetup.host.occupation || meetup.host.headline}</p>
                      {hostReviews.count > 0 && hostReviews.avg != null && (
                        <p className="mt-0.5 text-[14px]">★ <b>{hostReviews.avg.toFixed(1)}</b> · 후기 {hostReviews.count}개</p>
                      )}
                    </div>
                  </div>
                  {hostFull?.headline && <p className="mt-5 text-[17px] leading-relaxed font-semibold break-keep">{hostFull.headline}</p>}
                  {hostFull?.bio ? (
                    <p className="mt-3 text-[16px] leading-[1.85] whitespace-pre-line">{hostFull.bio}</p>
                  ) : (
                    <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-3 text-[15px] text-muted-foreground" data-testid="host-intro-pending">
                      소개 준비 중 · {meetup.host.display_name} 크리에이터가 직접 소개를 쓰고 있어요.
                    </p>
                  )}
                  {(hostFull?.career || hostFull?.credentials || hostFull?.teaching_experience || (hostFull?.expertise?.length ?? 0) > 0) && (
                    <dl className="mt-5 text-[15px]">
                      {hostFull?.expertise && hostFull.expertise.length > 0 && (
                        <div className="grid grid-cols-[5.5rem_1fr] gap-2 border-t border-border py-3">
                          <dt className="font-bold">전문 분야</dt>
                          <dd>{hostFull.expertise.join(" · ")}</dd>
                        </div>
                      )}
                      {hostFull?.career && (
                        <div className="grid grid-cols-[5.5rem_1fr] gap-2 border-t border-border py-3" data-testid="host-career">
                          <dt className="font-bold">경력</dt>
                          <dd className="leading-relaxed whitespace-pre-line">{hostFull.career}</dd>
                        </div>
                      )}
                      {hostFull?.credentials && (
                        <div className="grid grid-cols-[5.5rem_1fr] gap-2 border-t border-border py-3">
                          <dt className="font-bold">자격·수상</dt>
                          <dd className="leading-relaxed">{hostFull.credentials}</dd>
                        </div>
                      )}
                      {hostFull?.teaching_experience && (
                        <div className="grid grid-cols-[5.5rem_1fr] gap-2 border-t border-border py-3">
                          <dt className="font-bold">함께해 본 경험</dt>
                          <dd className="leading-relaxed">{hostFull.teaching_experience}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                  {/* 활동 기록: 라운디에서 실제로 열린 회차만 */}
                  <div className="mt-5 border-t border-border pt-4" data-testid="host-activity">
                    <p className="text-[15px] font-bold">라운디 활동 기록</p>
                    {activity.length ? (
                      <ul className="mt-2 text-[15px]">
                        {activity.map((a) => (
                          <li key={`${a.meetup_id}-${a.starts_at}`} className="flex justify-between gap-3 py-1.5">
                            <span className="truncate">
                              {formatDate(a.starts_at)} · {a.title}
                              {a.is_sample && " (샘플)"}
                            </span>
                            <span className="shrink-0 text-muted-foreground">
                              {a.reserved_count}/{a.capacity}명 신청
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1.5 text-[15px] text-muted-foreground">아직 라운디에서 열린 원이 없어요. 이번이 첫 원이에요.</p>
                    )}
                  </div>
                  <Link href={hostHref(meetup.host)} className="mt-5 inline-flex h-11 items-center rounded-xl border border-border px-4 text-[15px] font-semibold hover:border-foreground/50">
                    {meetup.host.display_name} 페이지 전체 보기
                  </Link>
                </section>
              )}

              {/* 8. 참가 후기 — 실제 참가자가 쓴 후기만 (샘플 프로그램은 후기 자리 없음) */}
              {!meetup.is_sample && (
                <div className="sheet mt-6 rounded-[24px] px-5 pb-6 sm:px-8 [&>section]:mt-0 [&>section]:pt-7">
                  <ReviewSection reviews={reviews} summary={reviewSummary} />
                </div>
              )}

              {/* 9. 취소 및 환불 */}
              <div className="sheet mt-6 rounded-[24px] px-5 py-7 sm:px-8">
                <Block title="취소 및 환불" testId="refund-summary" id="refund">
                  <ul className="text-[14.5px]">
                    {REFUND_RULES.map((r) => (
                      <li key={r.when} className="flex justify-between border-b border-border py-2.5">
                        <span>{r.when}</span>
                        <b className="tabular-nums">{r.percent === 0 ? "환불 없음" : `${r.percent}% 환불`}</b>
                      </li>
                    ))}
                    <li className="flex justify-between border-b border-border py-2.5">
                      <span>크리에이터 사정으로 취소</span>
                      <b>전액 환불</b>
                    </li>
                  </ul>
                  <p className="mt-2.5 text-[14px] text-muted-foreground">
                    모든 프로그램에 같은 기준이 적용돼요. <Link href="/refund" className="underline underline-offset-4">자세히 보기</Link>
                  </p>
                  {meetup.refund_policy_text && !meetup.is_sample && (
                    <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
                      <b className="mr-1.5 text-foreground">크리에이터 안내</b>
                      {meetup.refund_policy_text}
                    </p>
                  )}
                </Block>
              </div>

              {otherPrograms.length > 0 && meetup.host && (
                <section className="mt-12" data-testid="host-other-programs">
                  <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">{meetup.host.display_name}의 다른 원</h2>
                  <div className="mt-4 grid gap-3">
                    {otherPrograms.map((m) => (
                      <CircleCard key={m.id} meetup={m} categoryName={categories.find((c) => c.slug === m.category_slug)?.name ?? ""} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* PC: 오른쪽 고정 — 원 + 앉기 */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-[28px] border border-border bg-card p-7">
              {circle}
              <div className="mt-6 flex items-baseline justify-between">
                <b className="font-num text-[26px] font-semibold">{meetup.price > 0 ? formatPrice(meetup.price) : "무료"}</b>
                {next && <span className="text-[14px] text-muted-foreground">{formatDate(next.starts_at)} {formatTime(next.starts_at)}</span>}
              </div>
              <Button asChild size="lg" variant={cannotBook ? "outline" : "default"} className={`mt-4 h-14 w-full rounded-xl text-[16px] font-bold ${cannotBook ? "" : "bg-gold text-gold-ink hover:bg-gold/90"}`}>
                <a href="#booking">{cta}</a>
              </Button>
              <p className="mt-3 text-center text-[13px] text-muted-foreground">결제는 {brand.name}에서만 · 지금은 테스트 결제</p>
            </div>
          </aside>
        </div>

        {/* 휴대폰: 아래 고정 버튼 */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden" data-testid="mobile-cta">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <p className="shrink-0 text-[13px] text-muted-foreground">
              1인<b className="block font-num text-base font-semibold text-foreground">{meetup.price > 0 ? formatPrice(meetup.price) : "무료"}</b>
            </p>
            <Button asChild size="lg" variant={cannotBook ? "outline" : "default"} className={`h-12 flex-1 rounded-xl text-[16px] font-bold ${cannotBook ? "" : "bg-gold text-gold-ink hover:bg-gold/90"}`}>
              <a href="#booking">{ctaShort}</a>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </Blue>
  );
}
