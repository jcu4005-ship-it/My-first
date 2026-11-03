import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";

import { getPaymentProvider } from "./provider";

export type RefundTarget = { bookingId: string; paymentKey: string; amount: number };

/** PG 환불 → DB 환불 기록. 서버에서만 호출 (호출 전 권한 확인 필수) */
export async function refundBooking(
  target: RefundTarget,
  actorId: string,
  cancelStatus: "cancelled_by_user" | "cancelled_by_host",
  reason: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const provider = getPaymentProvider();
  try {
    await provider.refund({ paymentKey: target.paymentKey, amount: target.amount, reason });
  } catch {
    return { ok: false, message: "결제사 환불 요청에 실패했어요. 잠시 후 다시 시도해 주세요." };
  }
  const admin = createSupabaseServiceClient();
  const { error } = await admin.rpc("refund_booking", {
    p_booking_id: target.bookingId,
    p_actor: actorId,
    p_cancel_status: cancelStatus,
    p_reason: reason,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
