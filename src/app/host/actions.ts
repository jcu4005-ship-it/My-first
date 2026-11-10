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
import { HOST_AVATAR_BUCKET } from "@/lib/hosting/avatar";
import { hostProfileSchema, meetupFormSchema, sessionFormSchema } from "@/lib/validation/meetup";

const LOGIN_REQUIRED: FormState = { status: "error", message: "로그인이 필요합니다." };
const NOT_HOST: FormState = { status: "error", message: "승인된 호스트만 할 수 있어요." };

async function activeMember() {
  const m = await getCurrentMember();
  return m && m.status === "active" ? m : null;
}

/** 프로그램 만들기 / 수정 — 저장 후 관리 화면으로 */
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
    if (!data?.length) return { status: "error", message: "수정할 수 없는 프로그램입니다.", values };
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
    return { status: "error", message: error.code === "42501" ? "일정을 추가할 수 없는 프로그램입니다." : rpcErrorMessage(error), values };
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

/** 프로그램 전체 취소: 앞으로의 모든 일정 취소 후 모집 종료 */
export async function hostCancelMeetupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  const parsed = cancelSchema.safeParse({ meetupId: formValue(formData, "meetupId"), reason: formValue(formData, "reason") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { data: sessions, error } = await supabase.rpc("host_meetup_sessions", { p_meetup_id: parsed.data.meetupId });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  if (!sessions?.length) return { status: "error", message: "프로그램을 찾을 수 없어요." };
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
  return { status: "success", message: "프로그램을 취소했어요. 신청자에게 알림과 환불이 처리되었습니다." };
}

const PROFILE_KEYS = ["displayName", "occupation", "headline", "bio", "philosophy", "expertise", "career", "credentials",
  "portfolioUrl", "teachingExperience", "instagram", "avatarPath"] as const;

/** 승인된 호스트: 공개 프로필 수정 (RLS: 본인 행만, 상태·추천·주소는 수정 권한 없음) */
export async function updateHostProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  if (!member.roles.includes("host")) return NOT_HOST;
  const values = Object.fromEntries(PROFILE_KEYS.map((k) => [k, formValue(formData, k)]));
  const parsed = hostProfileSchema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "입력 내용을 확인해 주세요.", fieldErrors: fieldErrors(parsed.error), values };
  const v = parsed.data;
  if (v.avatarPath && !v.avatarPath.startsWith(`${member.id}/`)) {
    return { status: "error", message: "본인이 올린 사진만 사용할 수 있어요.", values };
  }
  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase.from("host_profiles").select("avatar_path").eq("user_id", member.id).maybeSingle();
  const { data, error } = await supabase
    .from("host_profiles")
    .update({
      display_name: v.displayName,
      occupation: v.occupation,
      headline: v.headline,
      bio: v.bio,
      philosophy: v.philosophy,
      expertise: v.expertise,
      career: v.career,
      credentials: v.credentials,
      portfolio_url: v.portfolioUrl || null,
      teaching_experience: v.teachingExperience,
      instagram_handle: v.instagram || null,
      avatar_path: v.avatarPath || null,
    })
    .eq("user_id", member.id)
    .select("slug");
  if (error) return { status: "error", message: rpcErrorMessage(error), values };
  if (!data?.length) return { status: "error", message: "수정할 수 없는 프로필이에요.", values };
  // 사진을 바꿨거나 지웠으면 예전 파일 정리 (본인 폴더만 지울 수 있음)
  const old = before?.avatar_path;
  if (old && old !== (v.avatarPath || null)) {
    await supabase.storage.from(HOST_AVATAR_BUCKET).remove([old]);
  }
  revalidatePath("/host/profile");
  revalidatePath("/hosts");
  return { status: "success", message: "프로필을 저장했어요.", values };
}

const couponConsentSchema = z.object({ meetupId: z.uuid(), accept: z.enum(["true", "false"]) });

/** 쿠폰 허용 동의·철회 — 할인(최대 10%)은 호스트 부담. 동의 기록은 DB 함수가 남김 */
export async function couponConsentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  if (!member.roles.includes("host")) return NOT_HOST;
  const parsed = couponConsentSchema.safeParse({ meetupId: formValue(formData, "meetupId"), accept: formValue(formData, "accept") });
  if (!parsed.success) return { status: "error", message: "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("host_set_coupon_consent", { p_meetup_id: parsed.data.meetupId, p_accept: parsed.data.accept === "true" });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  revalidatePath(`/host/meetups/${parsed.data.meetupId}`);
  revalidatePath(`/meetups/${parsed.data.meetupId}`);
  return { status: "success", message: parsed.data.accept === "true" ? "쿠폰 허용에 동의했어요." : "쿠폰 허용을 철회했어요. 이미 받은 신청은 그대로예요." };
}
