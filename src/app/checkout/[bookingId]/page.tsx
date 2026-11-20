import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { ActionForm } from "@/components/forms/action-form";
import { SeatCircle } from "@/components/brand/seat-circle";
import { Night } from "@/components/layout/night";
import { SiteHeader } from "@/components/site-header";
import { creatorPhoto } from "@/lib/hosting/avatar";
import { getMeetup } from "@/lib/meetups/queries";
import { requireMember } from "@/lib/auth/guards";
import { formatDate, formatPrice, formatTime, isFuture } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { cancelBookingAction } from "@/app/me/bookings/actions";

import { PayForm } from "./pay-form";

export const metadata: Metadata = { title: "결제" };
export const instant = false;

export default async function CheckoutPage({ params }: PageProps<"/checkout/[bookingId]">) {
  const { bookingId } = await params;
  await requireMember(`/checkout/${bookingId}`);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("my_booking_payment", { p_booking_id: bookingId });
  const p = data?.[0];
  if (!p) notFound();
  if (p.booking_status === "confirmed") redirect(`/me/bookings?booked=${bookingId}`);
  const expired = p.booking_status !== "pending_payment" || !isFuture(p.hold_expires_at);

  // 원: 내가 고른 자리(맡아 둔 자리 포함, 실제 예약 수)
  const meetup = await getMeetup(p.meetup_id).catch(() => null);
  const sess = meetup?.upcomingSessions.find((s) => s.starts_at === p.starts_at);
  const face = meetup?.host ? creatorPhoto(meetup.host) : null;

  return (
    <Night>
      <SiteHeader tabBar={false} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10" data-testid="checkout">
        <h1 className="text-[28px] font-display font-bold tracking-[-0.02em]">자리에 앉기</h1>
        {sess && (
          <div className="mx-auto mt-4 w-[min(62vw,240px)]">
            <SeatCircle
              capacity={sess.capacity}
              taken={sess.reserved_count}
              you={expired ? false : "mine"}
              face={face ?? meetup?.cover_image_url}
              initial={meetup?.host?.display_name.slice(0, 1)}
              label={expired ? undefined : "여기"}
            />
          </div>
        )}

        <section className="sheet mt-6 overflow-hidden rounded-[26px]">
          <div className="border-b border-border p-5">
            <p className="text-[18px] leading-snug font-extrabold tracking-[-0.02em]">{p.title}</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays aria-hidden className="size-4" strokeWidth={1.6} />
              {formatDate(p.starts_at)} {formatTime(p.starts_at)}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin aria-hidden className="size-4" strokeWidth={1.6} />
              {p.area}
            </p>
          </div>
          <dl className="flex flex-col gap-2.5 p-5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">인원</dt><dd>{p.quantity}명</dd></div>
            {p.discount_amount > 0 && (
              <>
                <div className="flex justify-between"><dt className="text-muted-foreground">참가비</dt><dd>{formatPrice(p.gross_amount)}</dd></div>
                <div className="flex justify-between text-forest" data-testid="checkout-discount">
                  <dt>쿠폰 할인{p.coupon_name ? ` (${p.coupon_name})` : ""}</dt>
                  <dd className="font-semibold">−{formatPrice(p.discount_amount)}</dd>
                </div>
              </>
            )}
            <div className="flex justify-between"><dt className="text-muted-foreground">주문번호</dt><dd className="font-mono text-[13px]">{p.order_id}</dd></div>
            <div className="mt-2 flex items-end justify-between border-t border-border pt-4">
              <dt className="font-semibold">결제 금액</dt>
              <dd className="font-num text-2xl font-semibold">{formatPrice(p.amount)}</dd>
            </div>
          </dl>
          <p className="mx-5 mb-5 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="test-payment-notice">
            <strong>테스트 결제</strong>입니다. 실제 카드 결제나 청구가 일어나지 않아요. 결제는 라운디 안에서만 이뤄져요.
          </p>
        </section>

        {expired ? (
          <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-5">
            <p className="text-sm text-destructive">결제 시간이 지났거나 결제할 수 없는 신청이에요.</p>
            <Link href={`/meetups/${p.meetup_id}`} className="mt-3 inline-block text-sm font-semibold text-gold underline-offset-4 hover:underline">
              프로그램 페이지에서 다시 신청하기
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            <PayForm bookingId={bookingId} amount={p.amount} />
            <p className="text-center text-[13px] text-muted-foreground">
              이 자리는 {formatTime(p.hold_expires_at)}까지 맡아 둘게요. 그 전에 결제하지 않으면 자리가 다시 비어요.
            </p>
            <div className="flex justify-center">
              <ActionForm action={cancelBookingAction} hidden={{ bookingId }} label="신청 취소" variant="ghost" />
            </div>
          </div>
        )}
      </main>
    </Night>
  );
}
