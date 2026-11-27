"use server";

import { COUPONS_ENABLED } from "@/config/platform-policy";
import { revalidatePath } from "next/cache";
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
  if (!COUPONS_ENABLED && parsed.data.couponCode) return { status: "error", message: "쿠폰은 지금 사용할 수 없어요." };
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
  if (!COUPONS_ENABLED) return { ok: false, message: "쿠폰은 지금 사용할 수 없어요." };
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

const waitlistSchema = z.object({ meetupId: z.uuid(), sessionId: z.uuid(), op: z.enum(["join", "leave"]) });

/** 대기 신청·취소 — 마감 여부·본인 확인은 DB 함수가 다시 확인 */
export async function waitlistAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await getCurrentMember();
  if (!member || member.status !== "active") return { status: "error", message: "로그인이 필요합니다." };
  const parsed = waitlistSchema.safeParse({
    meetupId: formValue(formData, "meetupId"),
    sessionId: formValue(formData, "sessionId"),
    op: formValue(formData, "op"),
  });
  if (!parsed.success) return { status: "error", message: "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(parsed.data.op === "join" ? "join_waitlist" : "leave_waitlist", { p_session_id: parsed.data.sessionId });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  revalidatePath(`/meetups/${parsed.data.meetupId}`);
  revalidatePath("/me/bookings");
  return {
    status: "success",
    message: parsed.data.op === "join" ? "대기 신청했어요. 자리가 나면 알림으로 알려 드려요." : "대기를 취소했어요.",
  };
}

const openAlertSchema = z.object({ meetupId: z.uuid(), sessionId: z.uuid(), op: z.enum(["on", "off"]) });

/** 열리면 알림 받기 / 취소 — 본인만, 아직 열리지 않은 일정만 (DB가 확인) */
export async function openAlertAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await getCurrentMember();
  if (!member || member.status !== "active") return { status: "error", message: "로그인이 필요합니다." };
  const parsed = openAlertSchema.safeParse({
    meetupId: formValue(formData, "meetupId"),
    sessionId: formValue(formData, "sessionId"),
    op: formValue(formData, "op"),
  });
  if (!parsed.success) return { status: "error", message: "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_open_alert", { p_session_id: parsed.data.sessionId, p_on: parsed.data.op === "on" });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  revalidatePath(`/meetups/${parsed.data.meetupId}`);
  revalidatePath("/drops");
  return {
    status: "success",
    message: parsed.data.op === "on" ? "알림을 켰어요. 열리기 1시간 전과 열리는 순간에 알려 드려요." : "알림을 껐어요.",
  };
}
