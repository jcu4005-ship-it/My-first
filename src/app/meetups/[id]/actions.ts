"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentMember } from "@/lib/auth/session";
import { formValue, type FormState } from "@/lib/forms";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  meetupId: z.uuid(),
  sessionId: z.uuid("일정을 선택해 주세요."),
  quantity: z.coerce.number().int().min(1).max(4),
  couponCode: z.string().trim().toUpperCase().max(20).regex(/^[A-Z0-9-]*$/, "쿠폰 코드를 확인해 주세요."),
});

/** 참가 신청 — 정원·중복·인원 제한·쿠폰 할인은 DB 함수가 최종 확인·계산 */
export async function bookAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = schema.safeParse({
    meetupId: formValue(formData, "meetupId"),
    sessionId: formValue(formData, "sessionId"),
    quantity: formValue(formData, "quantity") || "1",
    couponCode: formValue(formData, "couponCode"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  const member = await getCurrentMember();
  if (!member) redirect(`/login?next=${encodeURIComponent(`/meetups/${parsed.data.meetupId}`)}`);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("book_session", {
    p_session_id: parsed.data.sessionId,
    p_quantity: parsed.data.quantity,
    p_coupon_code: parsed.data.couponCode || null,
  });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  // 유료 프로그램은 결제 대기 → 결제 화면, 무료는 바로 확정
  const { data: payment } = await supabase.rpc("my_booking_payment", { p_booking_id: data });
  if (payment?.length && payment[0].booking_status === "pending_payment") redirect(`/checkout/${data}`);
  redirect(`/me/bookings?booked=${data}`);
}

const previewSchema = z.object({
  sessionId: z.uuid(),
  quantity: z.number().int().min(1).max(4),
  code: z.string().trim().toUpperCase().min(4, "쿠폰 코드를 입력해 주세요.").max(20).regex(/^[A-Z0-9-]+$/, "쿠폰 코드를 확인해 주세요."),
});

export type CouponPreview = { ok: true; code: string; percent: number; discount: number; total: number } | { ok: false; message: string };

/** 쿠폰 미리보기 — 금액은 DB가 계산 (신청할 때 다시 확인) */
export async function previewCouponAction(input: { sessionId: string; quantity: number; code: string }): Promise<CouponPreview> {
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "쿠폰 코드를 확인해 주세요." };
  const member = await getCurrentMember();
  if (!member) return { ok: false, message: "로그인이 필요합니다." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("preview_coupon", {
    p_session_id: parsed.data.sessionId,
    p_quantity: parsed.data.quantity,
    p_code: parsed.data.code,
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) return { ok: false, message: rpcErrorMessage(error) || "사용할 수 없는 쿠폰이에요" };
  return { ok: true, code: parsed.data.code, percent: row.percent_off, discount: row.discount, total: row.total };
}
