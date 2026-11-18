import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { ChairRing } from "@/components/brand/chair-ring";
import { brand } from "@/config/brand";
import { FollowButton } from "@/components/hosts/follow-button";
import { SampleBadge, seatsLeft } from "@/components/meetups/badges";
import { Photo } from "@/components/media/photo";
import { RecordRecentlyViewed } from "@/components/recently-viewed";
import { categoryStyle } from "@/components/meetups/category-style";
import { SaveButton } from "@/components/saved";
import { EditorialCover } from "@/components/meetups/editorial-cover";
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
import { getMeetup, listCategories } from "@/lib/meetups/queries";
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

/** 잡지식 섹션: 굵은 위 선 + 제목 + 작은 영문 표지 */
function Block({ title, label, children, id, testId }: { title: string; label: string; children: React.ReactNode; id?: string; testId?: string }) {
  return (
    <section id={id} className="mb-11 scroll-mt-24" data-testid={testId}>
      <h2 className="flex items-baseline justify-between gap-3 border-t-2 border-foreground pt-3 text-[20px] font-extrabold tracking-[-0.02em]">
        {title}
        <span className="text-[10.5px] font-bold tracking-[0.24em] text-fog">{label}</span>
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** 번호 목록 (얻는 것·추천 대상) */
function NumberedList({ items, testId }: { items: string[]; testId?: string }) {
  return (
    <ol data-testid={testId}>
      {items.map((line, i) => (
        <li key={i} className="grid grid-cols-[2.75rem_1fr] border-b border-border py-3 text-[15.5px] leading-relaxed">
          <span className="pt-0.5 text-[13px] font-extrabold text-ember tabular-nums">{String(i + 1).padStart(2, "0")}</span>
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
  const [mine, follow, reviews, reviewSummary, myWaitlist] = await Promise.all([
    member ? myConfirmedSessionIds(member.id, meetup.upcomingSessions.map((s) => s.id)) : Promise.resolve(new Set<string>()),
    meetup.host ? getFollowState(meetup.host.user_id, member?.id ?? null) : Promise.resolve(null),
    listPublicReviews({ meetupId: meetup.id }),
    getReviewSummary({ meetupId: meetup.id }),
    member ? listMyWaitlist() : Promise.resolve([]),
  ]);
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
  const ctaShort = cannotBook ? (viewerState === "sample" ? "예시 프로그램 · 신청 불가" : "지금은 신청 불가 · 일정 보기") : anyOpen ? "신청하기" : "일정 보기";
  const cta = cannotBook ? ctaShort : anyOpen ? `신청하기 · ${formatPrice(meetup.price)}` : "모집 마감 · 일정 보기";
  // 소개를 아직 쓰지 않은 호스트(이름·분야만 등록)에게는 "심사 통과" 표시를 붙이지 않음
  const hostVerified = Boolean(meetup.host && (meetup.host.bio || meetup.host.headline));
  const more = meetup.upcomingSessions.length - 1;
  const coverPhoto = meetup.cover_image_url ?? avatar;
  const nextLeft = next ? seatsLeft(next) : 0;

  return (
    <>
      <SiteHeader tabBar={false} />
      <RecordRecentlyViewed item={{ kind: "program", href: `/meetups/${meetup.id}`, title: meetup.title }} />
      <main className="flex-1 pb-28 lg:pb-0">
        {/* 1. 표지: 프로그램 대표 사진(없으면 크리에이터 사진) + 제목·정보 */}
        <div className="mx-auto grid w-full max-w-6xl gap-5 sm:px-6 lg:grid-cols-[7fr_5fr] lg:gap-11 lg:pt-2">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-forest sm:rounded-[2px] lg:aspect-[5/4]">
            <Photo
              src={coverPhoto}
              alt={meetup.cover_image_url ? meetup.title : `${meetup.host?.display_name ?? ""} 사진`}
              priority
              sizes="(min-width: 1024px) 58vw, 100vw"
              className={meetup.cover_image_url ? undefined : "object-[50%_18%]"}
              fallback={<EditorialCover category={meetup.category_slug} title={meetup.title} size="hero" showTitle={false} showLabel={false} className="!bg-forest !text-white" />}
            />
            <SaveButton
              item={{ id: meetup.id, title: meetup.title, meta: next ? `${formatDate(next.starts_at)} · ${next.area}` : "" }}
              tone="dark"
              className="absolute top-3 right-3"
            />
          </div>

          <div className="flex flex-col justify-end px-4 sm:px-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Link href={`/meetups?category=${meetup.category_slug}`} className="text-[11px] font-extrabold tracking-[0.26em] text-ember uppercase hover:underline">
                Program · {category?.name ?? style.label}
              </Link>
              <span className="rounded-full border border-foreground/30 px-2 py-0.5 text-[11px] font-semibold" data-testid="class-level">
                {CLASS_LEVEL_LABEL[meetup.level] ?? "누구나"}
              </span>
              {meetup.is_sample && <SampleBadge />}
            </div>
            <h1 className="mt-3 text-[30px] leading-[1.16] font-extrabold tracking-[-0.04em] break-keep sm:text-[42px]" data-testid="meetup-title">
              {meetup.title}
            </h1>

            {meetup.host && (
              <div className="mt-5 flex items-center gap-3">
                <Link href={hostHref(meetup.host)} className="group flex min-w-0 flex-1 items-center gap-2.5" data-testid="host-link">
                  <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest text-sm font-bold text-cream">
                    {avatar ? <Photo src={avatar} alt="" sizes="40px" fallback={null} className="object-[50%_15%]" /> : <span aria-hidden>{meetup.host.display_name.slice(0, 1)}</span>}
                  </span>
                  <span className="min-w-0 text-[15px]">
                    <span className="flex items-center gap-1">
                      <span className="text-foreground/70">with</span>
                      <b className="truncate group-hover:underline group-hover:underline-offset-4">{meetup.host.display_name}</b>
                      {hostVerified && <BadgeCheck aria-label="운영팀 심사를 통과한 크리에이터" className="size-4 shrink-0 text-forest" strokeWidth={2} />}
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

            <dl className="mt-5 border-t-2 border-foreground text-[14.5px]">
              {next && (
                <div className="grid grid-cols-[4.5rem_1fr] border-b border-border py-2.5">
                  <dt className="pt-0.5 text-[12px] font-bold tracking-[0.06em] text-muted-foreground">일정</dt>
                  <dd>
                    {formatDate(next.starts_at)} {formatTime(next.starts_at)} · {durationLabel(next.starts_at, next.ends_at)}
                    {more > 0 && <span className="text-fog"> · 외 {more}회</span>}
                  </dd>
                </div>
              )}
              {next && (
                <div className="grid grid-cols-[4.5rem_1fr] border-b border-border py-2.5">
                  <dt className="pt-0.5 text-[12px] font-bold tracking-[0.06em] text-muted-foreground">장소</dt>
                  <dd>
                    {next.area} · {next.venue_name}
                    <span className="block text-[12px] text-muted-foreground">상세 주소는 참가 확정 후 안내됩니다</span>
                  </dd>
                </div>
              )}
              {next && (
                <div className="grid grid-cols-[4.5rem_1fr] border-b border-border py-2.5">
                  <dt className="pt-0.5 text-[12px] font-bold tracking-[0.06em] text-muted-foreground">인원</dt>
                  <dd>
                    최대 {next.capacity}명 · {next.status !== "open" || nextLeft === 0 ? "마감" : <b className="text-ember">{nextLeft}자리 남음</b>}
                  </dd>
                </div>
              )}
              <div className="grid grid-cols-[4.5rem_1fr] border-b border-border py-2.5">
                <dt className="pt-0.5 text-[12px] font-bold tracking-[0.06em] text-muted-foreground">참가비</dt>
                <dd className="text-[17px] font-extrabold">{meetup.price > 0 ? formatPrice(meetup.price) : "무료"}</dd>
              </div>
            </dl>

            <a href="#booking" className="mt-5 hidden h-[52px] items-center justify-center gap-2 rounded-full bg-foreground text-[15.5px] font-extrabold text-background lg:flex">
              {cta}
              <ArrowRight aria-hidden className="size-4" strokeWidth={2} />
            </a>
            <ShareBar
              title={meetup.title}
              path={`/meetups/${meetup.id}`}
              calendarHref={next && !meetup.is_sample ? `/meetups/${meetup.id}/calendar?session=${next.id}` : undefined}
            />
          </div>
        </div>

        {/* 2. 본문 + PC 오른쪽 신청 요약 */}
        <div className="mx-auto mt-12 grid w-full max-w-6xl gap-10 px-4 sm:mt-16 sm:px-6 lg:grid-cols-[7fr_5fr] lg:gap-11">
          <article>
            <Block title="크리에이터가 들려주는 이야기" label="STORY">
              <p className="text-[16px] leading-[1.85] whitespace-pre-line text-foreground/85">{meetup.description}</p>
            </Block>

            {audience.length > 0 && (
              <Block title="이런 분께 추천해요" label="FOR YOU">
                <NumberedList items={audience} />
              </Block>
            )}

            {(outcomes.length > 0 || meetup.materials_note) && (
              <Block title="이 프로그램에서 얻는 것" label="TAKEAWAY">
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
              <Block title="그날의 순서" label="AGENDA" id="curriculum">
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

            {/* 자리와 신청 */}
            <Block title="이 자리" label="SEATS" id="booking-section">
              {meetup.is_sample && (
                <p className="mb-4 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground">
                  서비스 준비 중 보여 드리는 <strong>샘플 프로그램</strong>이에요. 실제로 열리지 않으며 신청할 수 없어요.
                </p>
              )}
              {mine.size > 0 && (
                <p className="mb-4 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="already-booked">
                  이 프로그램에 신청한 일정이 있어요. <Link href="/me/bookings" className="underline underline-offset-4">내 예약 보기</Link>
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
            </Block>

            {(meetup.requirements || meetup.what_to_bring || meetup.max_quantity_per_booking > 1) && (
              <Block title="참여 안내" label="INFO">
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

            {meetup.refund_policy_text && (
              <Block title="취소 및 환불" label="REFUND">
                <p className="text-[14px] leading-relaxed text-muted-foreground">{meetup.refund_policy_text}</p>
              </Block>
            )}
          </article>

          {/* PC: 오른쪽 고정 신청 요약 */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-[4px] border border-border bg-card p-6">
              <p className="text-[11px] font-bold tracking-[0.2em] text-fog">참가비 (1인)</p>
              <p className="mt-1.5 text-[30px] font-extrabold">{meetup.price > 0 ? formatPrice(meetup.price) : "무료"}</p>
              {next && (
                <p className="mt-1.5 text-[13.5px] text-muted-foreground">
                  가장 가까운 일정 · {formatDate(next.starts_at)} {formatTime(next.starts_at)}
                </p>
              )}
              {next && (
                <ChairRing
                  capacity={next.capacity}
                  taken={next.reserved_count}
                  closed={next.status !== "open" || nextLeft === 0}
                  decorative
                  className="mx-auto my-5 w-28"
                />
              )}
              <Button asChild size="lg" className="w-full rounded-full bg-foreground hover:bg-foreground/90">
                <a href="#booking">{cta}</a>
              </Button>
              <p className="mt-2.5 text-center text-xs text-muted-foreground">
                {next && next.status === "open" && nextLeft > 0 ? `${nextLeft}자리 남음 · ` : ""}결제는 {brand.name}에서만
              </p>
            </div>
          </aside>
        </div>

        {/* 휴대폰: 아래 고정 버튼 */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden" data-testid="mobile-cta">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <p className="shrink-0 text-xs text-muted-foreground">
              1인<b className="block text-base text-foreground">{meetup.price > 0 ? formatPrice(meetup.price) : "무료"}</b>
            </p>
            <Button asChild size="lg" variant={cannotBook ? "outline" : "default"} className={cannotBook ? "flex-1 rounded-full" : "flex-1 rounded-full bg-foreground hover:bg-foreground/90"}>
              <a href="#booking">{ctaShort}</a>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
