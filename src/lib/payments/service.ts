import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";

import { getPaymentProvider } from "./provider";

/**
 * PG 환불 → DB 환불 기록. 서버에서만 호출합니다.
 * 결제 키는 화면·사용자 연결로 전달하지 않고 여기서 서버 비밀키로만 조회합니다.
 * 권한(본인 신청 / 내 클래스)은 DB 함수 refund_booking이 actor 기준으로 다시 확인합니다.
 */
export async function refundBooking(
  bookingId: string,
  actorId: string,
  cancelStatus: "cancelled_by_user" | "cancelled_by_host",
  reason: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = createSupabaseServiceClient();
  const { data: payment, error: lookupError } = await admin
    .from("payments")
    .select("payment_key, amount, status")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (lookupError || !payment || payment.status !== "paid" || !payment.payment_key) {
    return { ok: false, message: "환불할 결제를 찾을 수 없어요." };
  }
  const provider = getPaymentProvider();
  try {
    await provider.refund({ paymentKey: payment.payment_key, amount: payment.amount, reason });
  } catch {
    return { ok: false, message: "결제사 환불 요청에 실패했어요. 잠시 후 다시 시도해 주세요." };
  }
  const { error } = await admin.rpc("refund_booking", {
    p_booking_id: bookingId,
    p_actor: actorId,
    p_cancel_status: cancelStatus,
    p_reason: reason,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
