import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Check, Clock, MapPin, Package } from "lucide-react";
import { notFound } from "next/navigation";

import { Seal } from "@/components/brand/seat-table";
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
import { durationLabel, formatDate, formatPrice, formatTime, ticketDate } from "@/lib/format";
import { getFollowState } from "@/lib/hosting/follows";
import { getMeetup, listCategories } from "@/lib/meetups/queries";
import { getAppSettings } from "@/lib/settings/queries";
import { CLASS_LEVEL_LABEL } from "@/lib/validation/meetup";

import { BookingForm } from "./booking-form";
import { hostAvatarUrl, hostHref } from "@/lib/hosting/avatar";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/meetups/[id]">): Promise<Metadata> {
  const { id } = await params;
  const meetup = await getMeetup(id);
  return meetup ? { title: meetup.title, description: meetup.summary } : { title: "프로그램을 찾을 수 없습니다" };
}

function Block({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24 px-1 pt-8">
      <h2 className="mb-3 font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function CheckList({ items, testId }: { items: string[]; testId?: string }) {
  return (
    <ul className="flex flex-col gap-2.5" data-testid={testId}>
      {items.map((line, i) => (
        <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest">
            <Check aria-hidden className="size-3" strokeWidth={2.6} />
          </span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

const lines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);

export default async function MeetupDetailPage({ params }: PageProps<"/meetups/[id]">) {
  const { id } = await params;
  const [meetup, categories, member, settings] = await Promise.all([getMeetup(id), listCategories(), getCurrentMember(), getAppSettings()]);
  if (!meetup) notFound();
  const [mine, follow] = await Promise.all([
    member ? myConfirmedSessionIds(member.id, meetup.upcomingSessions.map((s) => s.id)) : Promise.resolve(new Set<string>()),
    meetup.host ? getFollowState(meetup.host.user_id, member?.id ?? null) : Promise.resolve(null),
  ]);
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
  const avatar = meetup.host ? hostAvatarUrl(meetup.host.avatar_path) : null;
  const cta = anyOpen ? `초대 수락하기 · ${formatPrice(meetup.price)}` : "모집 마감 · 일정 보기";
  const d = next ? ticketDate(next.starts_at) : null;
  const more = meetup.upcomingSessions.length - 1;

  return (
    <>
      <SiteHeader tabBar={false} />
      <RecordRecentlyViewed item={{ kind: "program", href: `/meetups/${meetup.id}`, title: meetup.title }} />
      <main className="flex-1 pb-24 lg:pb-0">
        {/* 1. 표지 + 제목 */}
        <div className="relative h-[19rem] w-full overflow-hidden bg-forest sm:h-[24rem]">
          <Photo
            src={meetup.cover_image_url}
            alt={meetup.title}
            priority
            sizes="100vw"
            fallback={<EditorialCover category={meetup.category_slug} title={meetup.title} size="hero" showTitle={false} showLabel={false} className="!bg-forest !text-white" />}
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-forest-deep/90 via-forest-deep/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-5xl px-5 pb-12 text-white sm:px-6">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link href={`/meetups?category=${meetup.category_slug}`} className="pill bg-white/92 text-foreground hover:bg-white">
                {category?.name ?? style.label}
              </Link>
              <span className="pill border border-white/50 text-white" data-testid="class-level">
                {CLASS_LEVEL_LABEL[meetup.level] ?? "누구나"}
              </span>
              {meetup.is_sample && <SampleBadge />}
            </div>
            <h1 className="mt-2.5 max-w-3xl font-display text-[1.7rem] leading-snug font-bold break-keep sm:text-5xl sm:leading-tight" data-testid="meetup-title">
              {meetup.title}
            </h1>
          </div>
        </div>

        {/* 2. 겹치는 종이 시트 */}
        <div className="birch relative -mt-6 rounded-t-[26px]">
          <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 pt-5 sm:px-6 lg:grid-cols-[1fr_320px] lg:gap-10">
            <article>
              {/* 호스트 */}
              {meetup.host && (
                <div className="flex items-center gap-3 px-1">
                  <Link href={hostHref(meetup.host)} className="group flex min-w-0 flex-1 items-center gap-3" data-testid="host-link">
                    <span className="relative flex size-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest font-display text-xl text-cream">
                      {avatar ? <Photo src={avatar} alt="" sizes="52px" fallback={null} /> : <span aria-hidden>{meetup.host.display_name.slice(0, 1)}</span>}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 font-semibold group-hover:underline group-hover:underline-offset-4">
                        <span className="truncate">{meetup.host.display_name}</span>
                        <BadgeCheck aria-label="운영팀 심사를 통과한 호스트" className="size-4 shrink-0 text-forest" strokeWidth={2} />
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
                <p className="mt-3 rounded-xl bg-linen/70 px-4 py-2.5 text-sm leading-relaxed" data-testid="host-career">
                  경력 · {meetup.host.career}
                </p>
              )}

              {/* 초대장 티켓: 날짜 · 장소 · 준비물 / 절취선 / 테이블과 신청 */}
              <div className="ticket mt-4 overflow-hidden" id="booking-section">
                {next && d && (
                  <div className="grid grid-cols-[84px_1fr]">
                    <div className="flex flex-col items-center justify-center border-r-[1.5px] border-dashed border-[#cfc6b5] py-4 text-center">
                      <span className="font-display text-[34px] leading-none font-bold">{d.day}</span>
                      <span className="mt-1 text-[11px] tracking-[0.14em] text-muted-foreground">{d.wdEn}</span>
                      <span className="mt-2 text-[12.5px] font-bold">{d.time}</span>
                    </div>
                    <div className="flex flex-col gap-2 px-4 py-3.5 text-[13.5px]">
                      <p className="flex gap-2">
                        <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-forest" strokeWidth={1.8} />
                        {formatDate(next.starts_at)} · {durationLabel(next.starts_at, next.ends_at)}
                        {more > 0 && <span className="text-muted-foreground">· 외 {more}회</span>}
                      </p>
                      <p className="flex gap-2">
                        <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-forest" strokeWidth={1.8} />
                        <span>
                          {next.area} · {next.venue_name}
                          <span className="block text-[11.5px] text-muted-foreground">상세 주소는 참가 확정 후 안내됩니다.</span>
                        </span>
                      </p>
                      {meetup.what_to_bring && (
                        <p className="flex gap-2">
                          <Package aria-hidden className="mt-0.5 size-4 shrink-0 text-forest" strokeWidth={1.8} />
                          <span>준비물 · {meetup.what_to_bring}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div className="perf" />
                <div className="px-4 pt-4 pb-5">
                  {meetup.is_sample && (
                    <p className="mb-4 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground">
                      서비스 준비 중 보여 드리는 <strong>샘플 프로그램</strong>입니다. 실제로 열리지 않으며 신청할 수 없어요.
                    </p>
                  )}
                  {mine.size > 0 && (
                    <p className="mb-4 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="already-booked">
                      이 프로그램에 신청한 일정이 있어요. <Link href="/me/bookings" className="underline underline-offset-4">내 초대장 보기</Link>
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
                    <p className="text-center text-sm text-muted-foreground">예정된 일정이 없습니다.</p>
                  )}
                </div>
              </div>

              {/* 호스트의 편지 = 프로그램 소개 */}
              <section className="ticket relative mt-8 px-5 pt-6 pb-5" aria-labelledby="letter-title">
                <Seal className="absolute -top-3.5 right-4">심사<br />통과</Seal>
                <h2 id="letter-title" className="font-display text-lg font-bold">호스트의 편지</h2>
                <p className="mt-3 font-display text-[15px] leading-[1.9] whitespace-pre-line text-[#2b3b32]">{meetup.description}</p>
                {meetup.host && <p className="sign mt-3 text-right text-sm">— {meetup.host.display_name} 드림</p>}
              </section>

              {audience.length > 0 && (
                <Block title="이런 분을 초대해요">
                  <CheckList items={audience} />
                </Block>
              )}

              {(outcomes.length > 0 || meetup.materials_note) && (
                <Block title="수업이 끝나면 이렇게 할 수 있어요">
                  {outcomes.length > 0 && <CheckList items={outcomes} testId="learning-outcomes" />}
                  {meetup.materials_note && (
                    <p className="mt-4 rounded-xl bg-linen/70 px-4 py-3 text-sm leading-relaxed">
                      <span className="mr-2 font-semibold">재료·자료</span>
                      {meetup.materials_note}
                    </p>
                  )}
                </Block>
              )}

              {meetup.agenda.length > 0 && (
                <Block title="그날의 순서" id="curriculum">
                  <ol className="flex flex-col">
                    {meetup.agenda.map((a, i) => (
                      <li key={i} className="grid grid-cols-[3.5rem_1fr] border-b border-dashed border-[#d6cdbc] py-2.5 text-[15px]">
                        <span className="text-[13px] text-muted-foreground tabular-nums">{a.time}</span>
                        <span>{a.title}</span>
                      </li>
                    ))}
                  </ol>
                </Block>
              )}

              {(meetup.requirements || meetup.max_quantity_per_booking > 1) && (
                <Block title="참여 안내">
                  <dl className="flex flex-col gap-3 text-sm">
                    {meetup.requirements && (
                      <div>
                        <dt className="font-semibold">참여 조건</dt>
                        <dd className="mt-1 leading-relaxed text-muted-foreground">{meetup.requirements}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="font-semibold">한 번에 신청할 수 있는 인원</dt>
                      <dd className="mt-1 text-muted-foreground">최대 {meetup.max_quantity_per_booking}명</dd>
                    </div>
                  </dl>
                </Block>
              )}

              {/* 참가자 후기 — 후기 기능이 생기면 이 자리에 실제 후기만 표시합니다 (지금은 숨김) */}

              {meetup.refund_policy_text && (
                <Block title="취소 및 환불">
                  <p className="text-sm leading-relaxed text-muted-foreground">{meetup.refund_policy_text}</p>
                </Block>
              )}
            </article>

            {/* PC: 오른쪽 고정 초대장 */}
            <aside className="hidden lg:block">
              <div className="ticket sticky top-24 overflow-hidden">
                <div className="p-5">
                  <p className="text-sm text-muted-foreground">참가비 (1인)</p>
                  <p className="mt-1 text-3xl font-extrabold">{formatPrice(meetup.price)}</p>
                  {next && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      가장 가까운 일정 · {formatDate(next.starts_at)} {formatTime(next.starts_at)}
                    </p>
                  )}
                </div>
                <div className="perf" />
                <div className="p-5">
                  <Button asChild size="lg" className="w-full">
                    <a href="#booking">{cta}</a>
                  </Button>
                  <p className="mt-3 text-center text-xs text-muted-foreground">일정과 남은 자리를 확인한 뒤 신청해 주세요.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* 휴대폰: 아래 고정 버튼 */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden" data-testid="mobile-cta">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <p className="shrink-0 text-xs text-muted-foreground">
              1인<b className="block text-base text-foreground">{formatPrice(meetup.price)}</b>
            </p>
            <Button asChild size="lg" className="flex-1">
              <a href="#booking">{anyOpen ? "초대 수락하기" : "일정 보기"}</a>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
