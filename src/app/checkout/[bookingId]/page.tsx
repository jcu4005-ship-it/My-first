import type { Metadata } from "next";
import Link from "next/link";
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

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8" data-testid="checkout">
        <h1 className="font-display text-3xl font-bold">결제</h1>
        <p className="mt-3 rounded-xl bg-notice px-4 py-3 text-sm text-notice-foreground" data-testid="test-payment-notice">
          <strong>테스트 결제</strong>입니다. 실제 카드 결제나 청구가 일어나지 않아요.
        </p>
        <section className="mt-6 rounded-2xl border p-5">
          <p className="font-semibold">{p.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{formatDate(p.starts_at)} {formatTime(p.starts_at)} · {p.area}</p>
          <dl className="mt-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">인원</dt><dd>{p.quantity}명</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">주문번호</dt><dd className="font-mono text-xs">{p.order_id}</dd></div>
            <div className="flex justify-between border-t pt-3 text-base font-semibold"><dt>결제 금액</dt><dd>{formatPrice(p.amount)}</dd></div>
          </dl>
        </section>
        {expired ? (
          <div className="mt-6">
            <p className="text-sm text-destructive">결제 시간이 지났거나 결제할 수 없는 신청이에요.</p>
            <Link href={`/meetups/${p.meetup_id}`} className="mt-3 inline-block text-sm underline underline-offset-4">프로그램 페이지에서 다시 신청하기</Link>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              자리는 {formatTime(p.hold_expires_at)}까지 잡아 둘게요. 그 전에 결제하지 않으면 신청이 자동으로 취소돼요.
            </p>
            <PayForm bookingId={bookingId} amount={p.amount} />
            <ActionForm action={cancelBookingAction} hidden={{ bookingId }} label="신청 취소" variant="ghost" />
          </div>
        )}
      </main>
    </>
  );
}
