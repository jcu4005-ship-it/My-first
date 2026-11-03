"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentMember } from "@/lib/auth/session";
import { formValue, type FormState } from "@/lib/forms";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import { refundBooking } from "@/lib/payments/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/auth";
import { hostApplicationSchema, meetupFormSchema, sessionFormSchema } from "@/lib/validation/meetup";

const LOGIN_REQUIRED: FormState = { status: "error", message: "로그인이 필요합니다." };
const NOT_HOST: FormState = { status: "error", message: "승인된 호스트만 할 수 있어요." };

async function activeMember() {
  const m = await getCurrentMember();
  return m && m.status === "active" ? m : null;
}

/** 호스트 신청 */
export async function applyHostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  const values = Object.fromEntries(["displayName", "headline", "bio", "expertise", "instagram", "career", "credentials", "portfolioUrl", "teachingExperience"].map((k) => [k, formValue(formData, k)]));
  const parsed = hostApplicationSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("apply_host", {
    p_display_name: parsed.data.displayName,
    p_headline: parsed.data.headline,
    p_bio: parsed.data.bio,
    p_expertise: parsed.data.expertise,
    p_instagram: parsed.data.instagram,
    p_career: parsed.data.career,
    p_credentials: parsed.data.credentials,
    p_portfolio_url: parsed.data.portfolioUrl,
    p_teaching_experience: parsed.data.teachingExperience,
  });
  if (error) return { status: "error", message: rpcErrorMessage(error), values };
  revalidatePath("/host/apply");
  return { status: "success", message: "호스트 신청을 받았어요. 운영팀이 경력과 포트폴리오를 확인한 뒤 알려 드릴게요." };
}

/** 클래스 만들기 / 수정 — 저장 후 관리 화면으로 */
export async function saveMeetupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  if (!member.roles.includes("host")) return NOT_HOST;

  const keys = ["title", "categorySlug", "meetupType", "summary", "description", "price", "maxQuantity",
    "targetAudience", "requirements", "whatToBring", "agenda", "refundPolicyText", "level", "learningOutcomes", "materialsNote"];
  const values = Object.fromEntries(keys.map((k) => [k, formValue(formData, k)]));
  const parsed = meetupFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", message: "입력 내용을 확인해 주세요.", fieldErrors: fieldErrors(parsed.error), values };
  }
  const v = parsed.data;
  const row = {
    title: v.title,
    category_slug: v.categorySlug,
    meetup_type: v.meetupType,
    summary: v.summary,
    description: v.description,
    price: v.price,
    max_quantity_per_booking: v.maxQuantity,
    target_audience: v.targetAudience,
    requirements: v.requirements,
    what_to_bring: v.whatToBring,
    agenda: v.agenda,
    refund_policy_text: v.refundPolicyText,
    level: v.level,
    learning_outcomes: v.learningOutcomes,
    materials_note: v.materialsNote,
  };
  const supabase = await createSupabaseServerClient();
  const meetupId = formValue(formData, "meetupId");
  let id = meetupId;
  if (meetupId) {
    const { data, error } = await supabase.from("meetups").update(row).eq("id", meetupId).eq("host_id", member.id).select("id");
    if (error) return { status: "error", message: rpcErrorMessage(error), values };
    if (!data?.length) return { status: "error", message: "수정할 수 없는 클래스입니다.", values };
  } else {
    const { data, error } = await supabase.from("meetups").insert({ ...row, host_id: member.id }).select("id").single();
    if (error || !data) return { status: "error", message: rpcErrorMessage(error), values };
    id = data.id;
  }
  revalidatePath("/host");
  redirect(`/host/meetups/${id}?saved=1`);
}

const statusSchema = z.object({ meetupId: z.uuid(), action: z.enum(["submit", "withdraw", "close"]) });

export async function meetupStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  const parsed = statusSchema.safeParse({ meetupId: formValue(formData, "meetupId"), action: formValue(formData, "action") });
  if (!parsed.success) return { status: "error", message: "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("host_set_meetup_status", { p_meetup_id: parsed.data.meetupId, p_action: parsed.data.action });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  revalidatePath(`/host/meetups/${parsed.data.meetupId}`);
  const done = { submit: "검수를 요청했어요. 승인되면 공개됩니다.", withdraw: "검수 요청을 취소했어요.", close: "모집을 종료했어요." };
  return { status: "success", message: done[parsed.data.action] };
}

export async function addSessionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  const meetupId = formValue(formData, "meetupId");
  const values = Object.fromEntries(["date", "startTime", "endTime", "area", "venueName", "addressDetail", "capacity"].map((k) => [k, formValue(formData, k)]));
  const parsed = sessionFormSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("meetup_sessions").insert({
    meetup_id: meetupId,
    starts_at: v.startsAt,
    ends_at: v.endsAt,
    area: v.area,
    venue_name: v.venueName,
    address_detail: v.addressDetail,
    capacity: v.capacity,
  });
  if (error) {
    return { status: "error", message: error.code === "42501" ? "일정을 추가할 수 없는 클래스입니다." : rpcErrorMessage(error), values };
  }
  revalidatePath(`/host/meetups/${meetupId}`);
  return { status: "success", message: "일정을 추가했어요." };
}

const sessionStatusSchema = z.object({ sessionId: z.uuid(), meetupId: z.uuid(), action: z.enum(["close", "open", "cancel"]) });

export async function sessionStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  const parsed = sessionStatusSchema.safeParse({
    sessionId: formValue(formData, "sessionId"),
    meetupId: formValue(formData, "meetupId"),
    action: formValue(formData, "action"),
  });
  if (!parsed.success) return { status: "error", message: "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("host_set_session_status", { p_session_id: parsed.data.sessionId, p_action: parsed.data.action });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  revalidatePath(`/host/meetups/${parsed.data.meetupId}`);
  return { status: "success", message: "변경했어요." };
}

const capacitySchema = z.object({ sessionId: z.uuid(), meetupId: z.uuid(), capacity: z.coerce.number().int().min(1).max(200) });

export async function updateCapacityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  const parsed = capacitySchema.safeParse({
    sessionId: formValue(formData, "sessionId"),
    meetupId: formValue(formData, "meetupId"),
    capacity: formValue(formData, "capacity"),
  });
  if (!parsed.success) return { status: "error", message: "정원은 1~200명 사이로 입력해 주세요." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("meetup_sessions")
    .update({ capacity: parsed.data.capacity })
    .eq("id", parsed.data.sessionId)
    .select("id");
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  if (!data?.length) return { status: "error", message: "변경할 수 없는 일정입니다." };
  revalidatePath(`/host/meetups/${parsed.data.meetupId}`);
  return { status: "success", message: "정원을 변경했어요." };
}

const cancelSchema = z.object({
  meetupId: z.uuid(),
  sessionId: z.uuid().optional(),
  reason: z.string().trim().min(5, "참가자에게 보낼 취소 사유를 5자 이상 입력해 주세요.").max(300),
});

/** 일정 하나 취소: 결제 완료 신청은 전액 환불(테스트) → 나머지 신청 취소·알림 → 일정 취소 */
async function cancelOneSession(sessionId: string, actorId: string, reason: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: paid, error } = await supabase.rpc("host_session_paid_bookings", { p_session_id: sessionId });
  if (error) return rpcErrorMessage(error);
  for (const b of paid ?? []) {
    const r = await refundBooking(b.booking_id, actorId, "cancelled_by_host", reason);
    if (!r.ok) return r.message;
  }
  const { error: cancelError } = await supabase.rpc("host_cancel_session", { p_session_id: sessionId, p_reason: reason });
  return cancelError ? rpcErrorMessage(cancelError) : null;
}

export async function hostCancelSessionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  const parsed = cancelSchema.safeParse({
    meetupId: formValue(formData, "meetupId"),
    sessionId: formValue(formData, "sessionId"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success || !parsed.data.sessionId) return { status: "error", message: parsed.error?.issues[0]?.message ?? "잘못된 요청입니다." };
  const err = await cancelOneSession(parsed.data.sessionId, member.id, parsed.data.reason);
  if (err) return { status: "error", message: err };
  revalidatePath(`/host/meetups/${parsed.data.meetupId}`);
  return { status: "success", message: "일정을 취소했어요. 신청자에게 알림과 환불이 처리되었습니다." };
}

/** 클래스 전체 취소: 앞으로의 모든 일정 취소 후 모집 종료 */
export async function hostCancelMeetupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  const parsed = cancelSchema.safeParse({ meetupId: formValue(formData, "meetupId"), reason: formValue(formData, "reason") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { data: sessions, error } = await supabase.rpc("host_meetup_sessions", { p_meetup_id: parsed.data.meetupId });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  if (!sessions?.length) return { status: "error", message: "클래스를 찾을 수 없어요." };
  for (const s of sessions) {
    if (s.status === "cancelled" || s.status === "completed" || new Date(s.starts_at).getTime() <= Date.now()) continue;
    const err = await cancelOneSession(s.id, member.id, parsed.data.reason);
    if (err) return { status: "error", message: err };
  }
  const { data: m } = await supabase.from("meetups").select("status").eq("id", parsed.data.meetupId).maybeSingle();
  if (m?.status === "published") {
    await supabase.rpc("host_set_meetup_status", { p_meetup_id: parsed.data.meetupId, p_action: "close" });
  } else if (m?.status === "pending_review") {
    await supabase.rpc("host_set_meetup_status", { p_meetup_id: parsed.data.meetupId, p_action: "withdraw" });
  }
  revalidatePath(`/host/meetups/${parsed.data.meetupId}`);
  revalidatePath("/host");
  return { status: "success", message: "클래스를 취소했어요. 신청자에게 알림과 환불이 처리되었습니다." };
}
