"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentMember } from "@/lib/auth/session";
import { formValue, type FormState } from "@/lib/forms";
import { refundBooking } from "@/lib/payments/service";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** 신청 취소: 무료·결제 대기는 DB 함수로, 결제 완료는 환불(테스트) 후 취소 */
export async function cancelBookingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formValue(formData, "bookingId"));
  if (!id.success) return { status: "error", message: "잘못된 요청입니다." };
  const member = await getCurrentMember();
  if (!member) return { status: "error", message: "로그인이 필요합니다." };
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("cancel_booking", { p_booking_id: id.data });
  if (!error) {
    revalidatePath("/me/bookings");
    return { status: "success", message: "신청을 취소했어요." };
  }
  if (error.hint !== "refund_required") return { status: "error", message: rpcErrorMessage(error) };

  // 결제 완료 신청: 본인 신청인지 사용자 권한으로 다시 확인한 뒤 환불
  const { data } = await supabase.rpc("my_booking_payment", { p_booking_id: id.data });
  const p = data?.[0];
  if (!p || p.payment_status !== "paid") return { status: "error", message: "환불할 결제를 찾을 수 없어요." };
  const result = await refundBooking(id.data, member.id, "cancelled_by_user", "참가자 취소");
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/me/bookings");
  return { status: "success", message: "신청을 취소하고 전액 환불했어요. (테스트 결제)" };
}
