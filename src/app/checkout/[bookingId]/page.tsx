import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Check, MapPin } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { ActionForm } from "@/components/forms/action-form";
import { SiteHeader } from "@/components/site-header";
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

  const steps = ["초대 수락", "결제", "자리 확정"];

  return (
    <>
      <SiteHeader tabBar={false} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8" data-testid="checkout">
        {/* 진행 단계 */}
        <ol className="flex items-center gap-2 text-xs font-medium" aria-label="진행 단계">
          {steps.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full ${i === 0 ? "bg-forest text-white" : i === 1 ? "border-2 border-forest text-forest" : "bg-linen text-muted-foreground"}`}
                aria-current={i === 1 ? "step" : undefined}
              >
                {i === 0 ? <Check aria-hidden className="size-3.5" strokeWidth={2.5} /> : i + 1}
              </span>
              <span className={i === 1 ? "text-forest" : "text-muted-foreground"}>{label}</span>
              {i < steps.length - 1 && <span aria-hidden className="h-px flex-1 bg-border" />}
            </li>
          ))}
        </ol>

        <h1 className="mt-6 font-display text-2xl font-bold text-forest">결제</h1>
        <p className="mt-3 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="test-payment-notice">
          <strong>테스트 결제</strong>입니다. 실제 카드 결제나 청구가 일어나지 않아요.
        </p>

        <section className="mt-5 overflow-hidden rounded-3xl border border-border/70 bg-card">
          <div className="border-b border-border/70 p-5">
            <p className="font-semibold leading-snug">{p.title}</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays aria-hidden className="size-4 text-forest" strokeWidth={1.6} />
              {formatDate(p.starts_at)} {formatTime(p.starts_at)}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin aria-hidden className="size-4 text-forest" strokeWidth={1.6} />
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
            <div className="flex justify-between"><dt className="text-muted-foreground">주문번호</dt><dd className="font-mono text-xs">{p.order_id}</dd></div>
            <div className="mt-2 flex items-end justify-between border-t border-border/70 pt-4">
              <dt className="font-semibold">결제 금액</dt>
              <dd className="text-2xl font-bold text-forest">{formatPrice(p.amount)}</dd>
            </div>
          </dl>
        </section>

        {expired ? (
          <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
            <p className="text-sm text-destructive">결제 시간이 지났거나 결제할 수 없는 신청이에요.</p>
            <Link href={`/meetups/${p.meetup_id}`} className="mt-3 inline-block text-sm font-semibold text-forest underline-offset-4 hover:underline">
              프로그램 페이지에서 다시 신청하기
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            <PayForm bookingId={bookingId} amount={p.amount} />
            <p className="text-center text-xs text-muted-foreground">
              자리는 {formatTime(p.hold_expires_at)}까지 잡아 둘게요. 그 전에 결제하지 않으면 신청이 자동으로 취소돼요.
            </p>
            <div className="flex justify-center">
              <ActionForm action={cancelBookingAction} hidden={{ bookingId }} label="신청 취소" variant="ghost" />
            </div>
          </div>
        )}
      </main>
    </>
  );
}
