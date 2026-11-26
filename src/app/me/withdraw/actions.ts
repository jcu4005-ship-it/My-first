"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { getCurrentMember } from "@/lib/auth/session";
import { listMyBookings } from "@/lib/bookings/queries";
import { formValue, type FormState } from "@/lib/forms";
import { refundBooking } from "@/lib/payments/service";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** 회원 탈퇴: 비밀번호 재확인 → 결제한 예정 프로그램 환불(테스트) → DB 탈퇴 처리(익명화·로그인 차단) → 로그아웃 */
export async function withdrawAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await getCurrentMember();
  if (!member || !member.email) return { status: "error", message: "로그인이 필요합니다." };
  if (formValue(formData, "confirm").trim() !== "탈퇴합니다") {
    return { status: "error", fieldErrors: { confirm: "확인 문구를 정확히 입력해 주세요." } };
  }
  // 비밀번호 재확인 (세션을 저장하지 않는 별도 연결)
  const { url, key } = getSupabasePublicConfig();
  const verifier = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: pwError } = await verifier.auth.signInWithPassword({ email: member.email, password: formValue(formData, "password") });
  if (pwError) return { status: "error", fieldErrors: { password: "비밀번호가 올바르지 않습니다." } };
  await verifier.auth.signOut().catch(() => undefined);

  // 결제한 예정 프로그램은 전액 환불 후 취소
  const bookings = await listMyBookings();
  const supabase = await createSupabaseServerClient();
  for (const b of bookings.filter((x) => x.status === "confirmed" && x.payment_status === "paid" && new Date(x.starts_at).getTime() > Date.now())) {
    const r = await refundBooking(b.booking_id, member.id, "cancelled_by_user", "회원 탈퇴");
    if (!r.ok) return { status: "error", message: r.message };
  }

  const { error } = await supabase.rpc("withdraw_my_account");
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  await supabase.auth.signOut().catch(() => undefined);
  redirect("/?withdrawn=1");
}
