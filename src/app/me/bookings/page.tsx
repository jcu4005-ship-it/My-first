import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarPlus, MapPin, Navigation } from "lucide-react";

import { ActionForm } from "@/components/forms/action-form";
import { StatusPill } from "@/components/forms/controls";
import { SampleBadge } from "@/components/meetups/badges";
import { Blue } from "@/components/layout/blue";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { requireMember } from "@/lib/auth/guards";
import { listMyBookings, type MyBooking } from "@/lib/bookings/queries";
import { refundPercent } from "@/lib/payments/refund-policy";
import { listMyWaitlist } from "@/lib/bookings/waitlist";
import { formatDate, formatPrice, formatTime, isFuture, formatShortDateTime } from "@/lib/format";

import { cancelBookingAction } from "./actions";

export const metadata: Metadata = { title: "내 예약" };
export const instant = false;

/** 남은 날 (한국 날짜 기준): 0이면 D-DAY */
function dDay(iso: string) {
  const kst = (d: Date) => new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" })).setHours(0, 0, 0, 0);
  const days = Math.round((kst(new Date(iso)) - kst(new Date())) / 86_400_000);
  return days <= 0 ? "D-DAY" : `D-${days}`;
}

function BookingCard({ b, highlight }: { b: MyBooking; highlight: boolean }) {
  const upcoming = isFuture(b.starts_at);
  const confirmed = b.status === "confirmed";
  return (
    <li className={`rounded-[22px] border bg-card p-5 ${highlight || (confirmed && upcoming) ? "border-gold/70" : "border-border"} ${highlight ? "ring-1 ring-gold" : ""}`} data-testid="booking-card" data-status={b.status}>
      <div className="flex flex-wrap items-center gap-2">
        {confirmed && upcoming && <span className="rounded-full bg-gold px-2.5 py-0.5 font-num text-[13px] font-semibold text-gold-ink">{dDay(b.starts_at)}</span>}
        {confirmed ? (
          <StatusPill tone={upcoming ? "ok" : "muted"}>{upcoming ? "참가 확정" : "참여 완료"}</StatusPill>
        ) : b.status === "pending_payment" ? (
          <StatusPill tone="warn">결제 대기</StatusPill>
        ) : (
          <StatusPill>{b.status === "cancelled_by_user" ? "취소함" : "호스트 취소"}</StatusPill>
        )}
        {b.payment_status === "refunded" && <StatusPill tone="muted">{formatPrice(b.refunded_amount ?? 0)} 환불 완료</StatusPill>}
        {b.payment_status === "paid" && <StatusPill tone="muted">결제 완료 (테스트)</StatusPill>}
        {b.is_sample && <SampleBadge />}
      </div>
      <Link href={`/meetups/${b.meetup_id}`} className="mt-3 block text-[17px] leading-snug font-extrabold tracking-[-0.02em] hover:underline">{b.title}</Link>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays aria-hidden className="size-4 shrink-0" strokeWidth={1.6} />
        {formatDate(b.starts_at)} {formatTime(b.starts_at)}
      </p>
      <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin aria-hidden className="size-4 shrink-0" strokeWidth={1.6} />
        <span className="truncate">{b.area} · {b.venue_name}</span>
      </p>
      <p className="mt-3 flex items-center justify-between border-t border-border/70 pt-3 text-sm">
        <span className="text-muted-foreground">{b.quantity}명 · 호스트 {b.host_name}</span>
        <span className="font-num font-semibold">{formatPrice(b.total_price)}</span>
      </p>
      {b.status === "pending_payment" && (
        <Button asChild className="mt-4 w-full"><Link href={`/checkout/${b.booking_id}`}>결제하기</Link></Button>
      )}
      {confirmed && upcoming && (
        <>
          {b.address_detail && (
            <p className="sheet mt-3 rounded-xl px-3.5 py-2.5 text-sm" data-testid="booking-address"><b>상세 주소</b> · {b.address_detail} <span className="text-muted-foreground">(확정자에게만)</span></p>
          )}
          {/* 그날 바로 쓰는 버튼: 길찾기 · 내 캘린더에 추가(상세 주소 포함, 2시간 전 알림) */}
          <div className="mt-3 flex flex-wrap gap-2 text-[14px]" data-testid="booking-tools">
            {(b.address_detail || b.venue_name) && (
              <>
                <a href={`https://map.naver.com/p/search/${encodeURIComponent(b.address_detail || `${b.area} ${b.venue_name}`)}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 font-semibold hover:border-foreground" data-testid="map-naver">
                  <Navigation aria-hidden className="size-3.5" strokeWidth={2} />네이버 지도
                </a>
                <a href={`https://map.kakao.com/link/search/${encodeURIComponent(b.address_detail || `${b.area} ${b.venue_name}`)}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 font-semibold hover:border-foreground" data-testid="map-kakao">
                  <Navigation aria-hidden className="size-3.5" strokeWidth={2} />카카오맵
                </a>
              </>
            )}
            <a href={`/me/bookings/${b.booking_id}/calendar`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 font-semibold hover:border-foreground" data-testid="booking-calendar">
              <CalendarPlus aria-hidden className="size-3.5" strokeWidth={2} />캘린더에 추가
            </a>
          </div>
          <div className="mt-4">
            <ActionForm action={cancelBookingAction} hidden={{ bookingId: b.booking_id }} label="신청 취소" variant="ghost"
              confirmText={b.payment_status === "paid" ? refundConfirm(b.starts_at, b.total_price) : "신청을 취소할까요? 취소하면 자리가 다른 분께 돌아가요."} testId="cancel-booking" />
            {b.payment_status === "paid" && (
              <p className="mt-1.5 text-[13px] text-muted-foreground" data-testid="refund-quote">
                지금 취소하면 {refundPercent(b.starts_at)}% 환불 ({formatPrice(Math.floor((b.total_price * refundPercent(b.starts_at)) / 100))}) ·{" "}
                <Link href="/refund" className="underline underline-offset-4">환불 기준</Link>
              </p>
            )}
          </div>
        </>
      )}
    </li>
  );
}

function refundConfirm(startsAt: string, total: number) {
  const pct = refundPercent(startsAt);
  const amount = Math.floor((total * pct) / 100);
  return pct === 0
    ? "신청을 취소할까요? 프로그램 당일이라 환불되지 않아요. 자리는 다른 분께 돌아가요. (테스트 결제)"
    : `신청을 취소할까요? ${pct}% 환불(${amount.toLocaleString("ko-KR")}원)돼요. (테스트 결제)`;
}

export default async function MyBookingsPage({ searchParams }: PageProps<"/me/bookings">) {
  await requireMember("/me/bookings");
  const { booked } = (await searchParams) as { booked?: string };
  const [bookings, waitlist] = await Promise.all([listMyBookings(), listMyWaitlist()]);
  const upcoming = bookings.filter((b) => (b.status === "confirmed" || b.status === "pending_payment") && isFuture(b.starts_at))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = bookings.filter((b) => !upcoming.includes(b));

  return (
    <Blue>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-[30px] font-display font-bold tracking-[-0.02em] sm:text-[38px]">내 자리</h1>
        {booked && (
          <p className="mt-4 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="booked-notice">
            자리가 확정됐어요! 상세 주소와 일정을 확인해 주세요.
          </p>
        )}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-extrabold">앉을 자리 <span className="text-muted-foreground">{upcoming.length}</span></h2>
          {upcoming.length ? (
            <ul className="flex flex-col gap-3">{upcoming.map((b) => <BookingCard key={b.booking_id} b={b} highlight={b.booking_id === booked} />)}</ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground">아직 앉을 자리가 없어요.</p>
              <Button asChild className="mt-4 rounded-full"><Link href="/meetups">지금 열린 원 둘러보기</Link></Button>
            </div>
          )}
        </section>
        {waitlist.length > 0 && (
          <section className="mt-10" data-testid="my-waitlist">
            <h2 className="mb-3 text-lg font-extrabold">대기 중인 원 <span className="text-muted-foreground">{waitlist.length}</span></h2>
            <ul className="flex flex-col gap-2">
              {waitlist.map((w) => (
                <li key={w.session_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3">
                  <Link href={`/meetups/${w.meetup_id}`} className="min-w-0">
                    <span className="block truncate font-semibold hover:underline">{w.title}</span>
                    <span className="block text-[13px] text-muted-foreground">{formatShortDateTime(w.starts_at)}</span>
                  </Link>
                  <span className={w.left_seats > 0 ? "text-sm font-semibold text-forest" : "text-sm text-muted-foreground"}>
                    {w.left_seats > 0 ? `자리 ${w.left_seats}개 생김 · 지금 신청하기` : "자리가 나면 알려 드려요"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {past.length > 0 && (
          <section className="mt-10">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="text-lg font-extrabold">지난·취소한 자리</h2>
              <Link href="/me/reviews" className="text-sm font-semibold text-forest underline-offset-4 hover:underline" data-testid="write-review-link">후기 남기기</Link>
            </div>
            <ul className="flex flex-col gap-3">{past.map((b) => <BookingCard key={b.booking_id} b={b} highlight={false} />)}</ul>
          </section>
        )}
      </main>
    </Blue>
  );
}
