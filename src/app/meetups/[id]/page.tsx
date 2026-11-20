import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { SeatCircle, SeatLegend } from "@/components/brand/seat-circle";
import { Dusk } from "@/components/layout/dusk";
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
import { durationLabel, formatDate, formatPrice, formatTime } from "@/lib/format";
import { getFollowState } from "@/lib/hosting/follows";
import { getMeetup, listCategories, listUpcomingMeetups } from "@/lib/meetups/queries";
import { REFUND_RULES } from "@/lib/payments/refund-policy";
import { getAppSettings } from "@/lib/settings/queries";
import { CLASS_LEVEL_LABEL } from "@/lib/validation/meetup";

import { BookingForm } from "./booking-form";
import { WaitlistPanel } from "./waitlist-panel";
import { listMyWaitlist } from "@/lib/bookings/waitlist";
import { creatorPhoto, hostHref } from "@/lib/hosting/avatar";

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
      <h2 className="border-t-2 border-foreground pt-3 text-[19px] font-extrabold tracking-[-0.02em]">{title}</h2>
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
          <span aria-hidden className="pt-1 text-[13px] font-extrabold text-ember">—</span>
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
  const [mine, follow, reviews, reviewSummary, myWaitlist, hostPrograms] = await Promise.all([
    member ? myConfirmedSessionIds(member.id, meetup.upcomingSessions.map((s) => s.id)) : Promise.resolve(new Set<string>()),
    meetup.host ? getFollowState(meetup.host.user_id, member?.id ?? null) : Promise.resolve(null),
    listPublicReviews({ meetupId: meetup.id }),
    getReviewSummary({ meetupId: meetup.id }),
    member ? listMyWaitlist() : Promise.resolve([]),
    meetup.host ? listUpcomingMeetups({ hostId: meetup.host.user_id }) : Promise.resolve([]),
  ]);
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
  }));
  const category = categories.find((c) => c.slug === meetup.category_slug);
  const next = meetup.nextSession;
  const anyOpen = meetup.upcomingSessions.some((s) => s.status === "open" && seatsLeft(s) > 0);

  const style = categoryStyle(meetup.category_slug);
  const outcomes = lines(meetup.learning_outcomes);
  const audience = lines(meetup.target_audience);
  const avatar = meetup.host ? creatorPhoto(meetup.host) : null;
  // 신청할 수 없는 프로그램(샘플·베타 유료)은 버튼이 신청되는 것처럼 보이지 않게
  const cannotBook = viewerState === "sample" || viewerState === "beta_paid";
  const ctaShort = cannotBook ? (viewerState === "sample" ? "예시 프로그램 · 신청 불가" : "지금은 신청 불가 · 일정 보기") : anyOpen ? "이 자리에 앉기" : "대기 · 일정 보기";
  const cta = cannotBook ? ctaShort : anyOpen ? `이 자리에 앉기 · ${formatPrice(meetup.price)}` : "원이 가득 찼어요 · 일정 보기";
  // 소개를 아직 쓰지 않은 호스트(이름·분야만 등록)에게는 "심사 통과" 표시를 붙이지 않음
  const hostVerified = Boolean(meetup.host && (meetup.host.bio || meetup.host.headline));
  const more = meetup.upcomingSessions.length - 1;
  // 맨 위 사진: 크리에이터 사진 우선(대표 결정), 없으면 프로그램 대표 사진
  const coverPhoto = avatar ?? meetup.cover_image_url;
  const coverIsCreator = Boolean(avatar);
  const nextLeft = next ? seatsLeft(next) : 0;
  const nextLine = next ? seatLine(next) : null;
  const initial = meetup.host?.display_name.slice(0, 1) ?? meetup.title.slice(0, 1);

  /** 원 + 먼저 앉은 사람 (다음 일정 기준, 실제 예약 수) */
  const circle = next && (
    <div className="flex flex-col items-center">
      <div className="w-[min(64vw,260px)] lg:w-[300px]">
        <SeatCircle
          capacity={next.capacity}
          taken={next.reserved_count}
          you={nextLine?.closed || cannotBook ? false : "open"}
          face={avatar ?? meetup.cover_image_url}
          initial={initial}
          label={nextLine?.closed || cannotBook ? undefined : "당신 자리"}
        />
      </div>
      <SeatLegend className="mt-3" />
      <p className={`mt-3 text-center text-[16px] font-extrabold tracking-[-0.02em] ${nextLine?.closed ? "text-muted-foreground" : "text-amber"}`} data-testid="seat-line">
        {nextLine?.text}
      </p>
    </div>
  );

  return (
    <Dusk>
      <SiteHeader tabBar={false} />
      <RecordRecentlyViewed item={{ kind: "program", href: `/meetups/${meetup.id}`, title: meetup.title }} />
      <main className="flex-1 pb-28 lg:pb-0">
        <div className="mx-auto grid w-full max-w-6xl gap-8 sm:px-6 lg:grid-cols-[1fr_430px] lg:gap-11 lg:pt-8">
          <div className="min-w-0">
            {/* 1. 표지: 크리에이터 사진(없으면 프로그램 대표 사진) + 제목 */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-dusk-2 sm:rounded-[28px] lg:aspect-[16/11]">
              <Photo
                src={coverPhoto}
                alt={coverIsCreator ? `${meetup.host?.display_name ?? ""} 사진` : meetup.title}
                priority
                sizes="(min-width: 1024px) 58vw, 100vw"
                className={coverIsCreator ? "object-[50%_18%] [filter:sepia(.12)]" : undefined}
                fallback={<EditorialCover category={meetup.category_slug} title={meetup.title} size="hero" showTitle={false} showLabel={false} className="!bg-dusk-2 !text-cream" />}
              />
              <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgb(23_17_13/0.35),transparent_30%,transparent_45%,rgb(23_17_13/0.92))]" />
              <SaveButton
                item={{ id: meetup.id, title: meetup.title, meta: next ? `${formatDate(next.starts_at)} · ${next.area}` : "" }}
                tone="dark"
                className="absolute top-3 right-3"
              />
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-7">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/meetups?category=${meetup.category_slug}`} className="rounded-full bg-cream px-2.5 py-1 text-[12px] font-extrabold text-ember-ink hover:bg-cream/90">
                    {category?.name ?? style.label}
                  </Link>
                  <span className="rounded-full border border-cream/50 px-2.5 py-1 text-[12px] font-semibold text-cream" data-testid="class-level">
                    {CLASS_LEVEL_LABEL[meetup.level] ?? "누구나"}
                  </span>
                  {meetup.is_sample && <SampleBadge />}
                </div>
                <h1 className="mt-2.5 text-[28px] leading-[1.15] font-black tracking-[-0.045em] break-keep text-cream sm:text-[44px]" data-testid="meetup-title">
                  {meetup.title}
                </h1>
              </div>
            </div>

            {/* 2. 크리에이터 */}
            <div className="px-4 sm:px-0">
              {meetup.host && (
                <div className="mt-5 flex items-center gap-3">
                  <Link href={hostHref(meetup.host)} className="group flex min-w-0 flex-1 items-center gap-2.5" data-testid="host-link">
                    <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ember-glow text-sm font-black text-ember-ink">
                      {avatar ? <Photo src={avatar} alt="" sizes="44px" fallback={null} className="object-[50%_15%]" /> : <span aria-hidden>{initial}</span>}
                    </span>
                    <span className="min-w-0 text-[15px]">
                      <span className="flex items-center gap-1">
                        <b className="truncate group-hover:underline group-hover:underline-offset-4">{meetup.host.display_name}</b>
                        {hostVerified && <BadgeCheck aria-label="운영팀 심사를 통과한 크리에이터" className="size-4 shrink-0 text-amber" strokeWidth={2} />}
                      </span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">
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
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground" data-testid="host-career">
                  경력 · {meetup.host.career}
                </p>
              )}

              {/* 3. 휴대폰: 원 (PC는 오른쪽에) */}
              <div className="mt-8 lg:hidden">{circle}</div>

              {/* 4. 일정·장소·인원·참가비 */}
              <dl className="mt-7 rounded-[22px] border border-border bg-card px-5 py-2 text-[14.5px]">
                {next && (
                  <div className="grid grid-cols-[4.5rem_1fr] border-b border-border py-3">
                    <dt className="text-[12.5px] font-bold text-muted-foreground">일정</dt>
                    <dd>
                      {formatDate(next.starts_at)} {formatTime(next.starts_at)} · {durationLabel(next.starts_at, next.ends_at)}
                      {more > 0 && <span className="text-muted-foreground"> · 외 {more}회</span>}
                    </dd>
                  </div>
                )}
                {next && (
                  <div className="grid grid-cols-[4.5rem_1fr] border-b border-border py-3">
                    <dt className="text-[12.5px] font-bold text-muted-foreground">장소</dt>
                    <dd>
                      {next.area} · {next.venue_name}
                      <span className="block text-[12px] text-muted-foreground">상세 주소는 참가 확정 후 안내됩니다</span>
                    </dd>
                  </div>
                )}
                {next && (
                  <div className="grid grid-cols-[4.5rem_1fr] border-b border-border py-3">
                    <dt className="text-[12.5px] font-bold text-muted-foreground">인원</dt>
                    <dd>
                      최대 {next.capacity}명 · {next.status !== "open" || nextLeft === 0 ? "마감" : <b className="text-amber">{nextLeft}자리 남음</b>}
                    </dd>
                  </div>
                )}
                <div className="grid grid-cols-[4.5rem_1fr] py-3">
                  <dt className="text-[12.5px] font-bold text-muted-foreground">참가비</dt>
                  <dd className="font-num text-[17px] font-semibold">{meetup.price > 0 ? formatPrice(meetup.price) : "무료"}</dd>
                </div>
              </dl>
              <ShareBar
                title={meetup.title}
                path={`/meetups/${meetup.id}`}
                calendarHref={next && !meetup.is_sample ? `/meetups/${meetup.id}/calendar?session=${next.id}` : undefined}
              />

              {/* 5. 자리와 신청 */}
              <section id="booking-section" className="mt-10 scroll-mt-24">
                <h2 className="text-[22px] font-black tracking-[-0.03em]">자리 고르기</h2>
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
                  {bookingSessions.length ? (
                    <BookingForm
                      meetupId={meetup.id}
                      price={meetup.price}
                      maxQuantity={meetup.max_quantity_per_booking}
                      sessions={bookingSessions}
                      state={viewerState}
                      acceptCoupons={meetup.accept_coupons && meetup.price > 0}
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
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground" data-testid="payment-safety">
                      참가비는 {brand.name}에서만 결제해요. 계좌 송금이나 현장 결제를 요청받으면{" "}
                      <Link href="/help/contact" className="underline underline-offset-4">고객센터</Link>로 알려 주세요.
                    </p>
                  )}
                </div>
              </section>

              {/* 6. 읽는 정보는 밝은 종이 시트에 */}
              <article className="sheet mt-10 rounded-[24px] px-5 py-7 sm:px-8 sm:py-9">
                <Block title="크리에이터가 들려주는 이야기">
                  {coverIsCreator && meetup.cover_image_url && (
                    <figure className="relative mb-5 aspect-[16/10] overflow-hidden rounded-[14px] bg-linen" data-testid="program-photo">
                      <Photo src={meetup.cover_image_url} alt={meetup.title} sizes="(min-width: 1024px) 58vw, 100vw" fallback={null} />
                    </figure>
                  )}
                  <p className="text-[16px] leading-[1.85] whitespace-pre-line text-foreground/85">{meetup.description}</p>
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
                      <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
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
                        <li key={i} className="grid grid-cols-[4rem_1fr] border-b border-border py-3 text-[15.5px]">
                          <span className="pt-0.5 text-[13px] font-extrabold text-ember tabular-nums">{a.time}</span>
                          <span>{a.title}</span>
                        </li>
                      ))}
                    </ol>
                  </Block>
                )}

                {(meetup.requirements || meetup.what_to_bring || meetup.max_quantity_per_booking > 1) && (
                  <Block title="참여 안내">
                    <dl className="text-[14.5px]">
                      {meetup.what_to_bring && (
                        <div className="grid grid-cols-[6.5rem_1fr] border-b border-border py-2.5">
                          <dt className="font-semibold">준비물</dt>
                          <dd className="text-muted-foreground">{meetup.what_to_bring}</dd>
                        </div>
                      )}
                      {meetup.requirements && (
                        <div className="grid grid-cols-[6.5rem_1fr] border-b border-border py-2.5">
                          <dt className="font-semibold">참여 조건</dt>
                          <dd className="text-muted-foreground">{meetup.requirements}</dd>
                        </div>
                      )}
                      <div className="grid grid-cols-[6.5rem_1fr] border-b border-border py-2.5">
                        <dt className="font-semibold">한 번에 신청</dt>
                        <dd className="text-muted-foreground">최대 {meetup.max_quantity_per_booking}명</dd>
                      </div>
                    </dl>
                  </Block>
                )}

                {/* 참가 후기 — 실제 참가자가 쓴 후기만 (샘플 프로그램은 후기 자리 없음) */}
                {!meetup.is_sample && <ReviewSection reviews={reviews} summary={reviewSummary} />}

                <Block title="취소 및 환불" testId="refund-summary">
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
                  <p className="mt-2.5 text-[13px] text-muted-foreground">
                    모든 프로그램에 같은 기준이 적용돼요. <Link href="/refund" className="underline underline-offset-4">자세히 보기</Link>
                  </p>
                  {meetup.refund_policy_text && !meetup.is_sample && (
                    <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
                      <b className="mr-1.5 text-foreground">크리에이터 안내</b>
                      {meetup.refund_policy_text}
                    </p>
                  )}
                </Block>
              </article>

              {otherPrograms.length > 0 && meetup.host && (
                <section className="mt-12" data-testid="host-other-programs">
                  <h2 className="text-[22px] font-black tracking-[-0.03em]">{meetup.host.display_name}의 다른 원</h2>
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
                {next && <span className="text-[13px] text-muted-foreground">{formatDate(next.starts_at)} {formatTime(next.starts_at)}</span>}
              </div>
              <Button asChild size="lg" variant={cannotBook ? "outline" : "default"} className="mt-4 h-14 w-full rounded-full text-[16px] font-black shadow-[0_12px_34px_-12px_rgb(255_106_43/0.8)]">
                <a href="#booking">{cta}</a>
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">결제는 {brand.name}에서만 · 지금은 테스트 결제</p>
            </div>
          </aside>
        </div>

        {/* 휴대폰: 아래 고정 버튼 */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden" data-testid="mobile-cta">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <p className="shrink-0 text-xs text-muted-foreground">
              1인<b className="block font-num text-base font-semibold text-foreground">{meetup.price > 0 ? formatPrice(meetup.price) : "무료"}</b>
            </p>
            <Button asChild size="lg" variant={cannotBook ? "outline" : "default"} className="h-12 flex-1 rounded-full font-black">
              <a href="#booking">{ctaShort}</a>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </Dusk>
  );
}
