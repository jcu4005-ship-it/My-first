"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentMember } from "@/lib/auth/session";
import { formValue, type FormState } from "@/lib/forms";
import { getPaymentProvider } from "@/lib/payments/provider";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 테스트 결제: 본인 신청·금액을 DB에서 다시 읽고 → 결제사(모의) 승인 → 서버 비밀키로 DB 확정.
 * 금액은 화면에서 받지 않습니다.
 */
export async function payTestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formValue(formData, "bookingId"));
  if (!id.success) return { status: "error", message: "잘못된 요청입니다." };
  const member = await getCurrentMember();
  if (!member) redirect(`/login?next=/checkout/${id.data}`);

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("my_booking_payment", { p_booking_id: id.data });
  const p = data?.[0];
  if (!p) return { status: "error", message: "결제할 신청을 찾을 수 없어요." };
  if (p.booking_status === "confirmed" && p.payment_status === "paid") redirect(`/me/bookings?booked=${id.data}`);
  if (p.booking_status !== "pending_payment" || p.payment_status !== "ready") {
    return { status: "error", message: "결제할 수 없는 상태예요. 다시 신청해 주세요." };
  }
  if (new Date(p.hold_expires_at).getTime() <= Date.now()) {
    return { status: "error", message: "결제 시간(10분)이 지났어요. 프로그램 페이지에서 다시 신청해 주세요." };
  }

  const provider = getPaymentProvider();
  let paymentKey: string;
  try {
    ({ paymentKey } = await provider.confirm({ orderId: p.order_id, amount: p.amount }));
  } catch {
    return { status: "error", message: "결제 승인에 실패했어요. 다시 시도해 주세요." };
  }

  const admin = createSupabaseServiceClient();
  const { data: result, error } = await admin.rpc("confirm_payment", {
    p_booking_id: id.data,
    p_provider: provider.id,
    p_payment_key: paymentKey,
    p_amount: p.amount,
  });
  if (error || result === "expired") {
    // DB 확정 실패 → 결제사 승인 취소 (돈이 묶이지 않게)
    await provider.refund({ paymentKey, amount: p.amount, reason: "결제 확정 실패" }).catch(() => undefined);
    return {
      status: "error",
      message: result === "expired" ? "결제 시간이 지나 신청이 만료되었어요. 다시 신청해 주세요." : "결제를 확정하지 못했어요. 승인은 자동 취소되었습니다.",
    };
  }
  redirect(`/me/bookings?booked=${id.data}`);
}
