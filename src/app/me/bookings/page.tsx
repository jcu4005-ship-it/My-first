import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";
import { StatusPill } from "@/components/forms/controls";
import { SampleBadge } from "@/components/meetups/badges";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { requireMember } from "@/lib/auth/guards";
import { listMyBookings, type MyBooking } from "@/lib/bookings/queries";
import { formatDate, formatPrice, formatTime, isFuture } from "@/lib/format";

import { cancelBookingAction } from "./actions";

export const metadata: Metadata = { title: "신청 내역" };
export const instant = false;

function BookingCard({ b, highlight }: { b: MyBooking; highlight: boolean }) {
  const upcoming = isFuture(b.starts_at);
  const confirmed = b.status === "confirmed";
  return (
    <li className={`rounded-2xl border p-5 ${highlight ? "border-foreground ring-1 ring-foreground" : ""}`} data-testid="booking-card" data-status={b.status}>
      <div className="flex flex-wrap items-center gap-2">
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
      <Link href={`/meetups/${b.meetup_id}`} className="mt-3 block font-semibold hover:underline">{b.title}</Link>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatDate(b.starts_at)} {formatTime(b.starts_at)} · {b.area} · {b.venue_name}
      </p>
      <p className="mt-1 text-sm">{b.quantity}명 · {formatPrice(b.total_price)} · 호스트 {b.host_name}</p>
      {b.status === "pending_payment" && (
        <Button asChild size="sm" className="mt-4"><Link href={`/checkout/${b.booking_id}`}>결제하기</Link></Button>
      )}
      {confirmed && upcoming && (
        <>
          {b.address_detail && (
            <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-sm" data-testid="booking-address">상세 주소: {b.address_detail}</p>
          )}
          <div className="mt-4">
            <ActionForm action={cancelBookingAction} hidden={{ bookingId: b.booking_id }} label="신청 취소" variant="ghost"
              confirmText={b.payment_status === "paid" ? "신청을 취소할까요? 결제 금액은 전액 환불됩니다. (테스트 결제)" : "신청을 취소할까요? 취소하면 자리가 다른 분께 돌아가요."} testId="cancel-booking" />
          </div>
        </>
      )}
    </li>
  );
}

export default async function MyBookingsPage({ searchParams }: PageProps<"/me/bookings">) {
  await requireMember("/me/bookings");
  const { booked } = (await searchParams) as { booked?: string };
  const bookings = await listMyBookings();
  const upcoming = bookings.filter((b) => (b.status === "confirmed" || b.status === "pending_payment") && isFuture(b.starts_at))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = bookings.filter((b) => !upcoming.includes(b));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="font-display text-3xl font-bold">신청 내역</h1>
        {booked && (
          <p className="mt-4 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="booked-notice">
            신청이 확정되었어요! 상세 주소와 일정을 확인해 주세요.
          </p>
        )}
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">다가오는 클래스</h2>
          {upcoming.length ? (
            <ul className="flex flex-col gap-3">{upcoming.map((b) => <BookingCard key={b.booking_id} b={b} highlight={b.booking_id === booked} />)}</ul>
          ) : (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <p className="text-muted-foreground">예정된 클래스가 없어요.</p>
              <Button asChild className="mt-4"><Link href="/meetups">클래스 둘러보기</Link></Button>
            </div>
          )}
        </section>
        {past.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-lg font-semibold">지난·취소한 신청</h2>
            <ul className="flex flex-col gap-3">{past.map((b) => <BookingCard key={b.booking_id} b={b} highlight={false} />)}</ul>
          </section>
        )}
      </main>
    </>
  );
}
