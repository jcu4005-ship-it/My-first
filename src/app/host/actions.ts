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
import { getMyMeetup } from "@/lib/hosting/queries";
import { hostProfileSchema, isRealDate, meetupFormSchema, sessionFormSchema } from "@/lib/validation/meetup";

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
    "targetAudience", "requirements", "whatToBring", "agenda", "refundPolicyText", "level", "learningOutcomes", "materialsNote", "priceRationale", "coverPath"];
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
    price_rationale: v.priceRationale,
    // 본인 폴더 사진만 (DB도 한 번 더 확인)
    cover_path: values.coverPath && values.coverPath.startsWith(`${member.id}/`) ? values.coverPath : null,
  };
  const supabase = await createSupabaseServerClient();
  const meetupId = formValue(formData, "meetupId");
  let id = meetupId;
  let repriced = false;
  if (meetupId) {
    const { data: before } = await supabase.from("meetups").select("status, price").eq("id", meetupId).eq("host_id", member.id).maybeSingle();
    const { data, error } = await supabase.from("meetups").update(row).eq("id", meetupId).eq("host_id", member.id).select("id, status");
    if (error) return { status: "error", message: rpcErrorMessage(error), values };
    if (!data?.length) return { status: "error", message: "수정할 수 없는 프로그램입니다.", values };
    // 공개 중 참가비 인상 → DB가 검수 대기로 되돌림
    repriced = before?.status === "published" && data[0].status === "pending_review";
  } else {
    const { data, error } = await supabase.from("meetups").insert({ ...row, host_id: member.id }).select("id").single();
    if (error || !data) return { status: "error", message: rpcErrorMessage(error), values };
    id = data.id;
  }
  revalidatePath("/host");
  if (repriced) revalidatePath(`/meetups/${id}`);
  redirect(`/host/meetups/${id}?saved=1${repriced ? "&repriced=1" : ""}`);
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

const repeatSchema = z.object({
  repeat: z.enum(["none", "weekly", "biweekly"]).catch("none"),
  count: z.coerce.number().int().min(1).max(8).catch(1),
});

/** 일정 추가 — 반복(매주·2주마다, 최대 8회)이면 같은 시간·장소·정원으로 한 번에. 이미 같은 시각에 있는 일정은 건너뜀 */
export async function addSessionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  const meetupId = formValue(formData, "meetupId");
  const values = Object.fromEntries(["date", "startTime", "endTime", "area", "venueName", "addressDetail", "capacity", "repeat", "count", "opensDate", "opensTime"].map((k) => [k, formValue(formData, k)]));
  const parsed = sessionFormSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  const v = parsed.data;
  const r = repeatSchema.parse({ repeat: values.repeat, count: values.count });
  const times = r.repeat === "none" ? 1 : r.count;
  const stepDays = r.repeat === "biweekly" ? 14 : 7;
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase.from("meetup_sessions").select("starts_at, status").eq("meetup_id", meetupId);
  const taken = new Set((existing ?? []).filter((x) => x.status !== "cancelled").map((x) => new Date(x.starts_at).getTime()));
  const rows = Array.from({ length: times }, (_, i) => {
    const shift = i * stepDays * 86400000;
    return {
      meetup_id: meetupId,
      starts_at: new Date(new Date(v.startsAt).getTime() + shift).toISOString(),
      ends_at: new Date(new Date(v.endsAt).getTime() + shift).toISOString(),
      area: v.area,
      venue_name: v.venueName,
      address_detail: v.addressDetail,
      capacity: v.capacity,
    };
  }).filter((row) => !taken.has(new Date(row.starts_at).getTime()));
  if (!rows.length) return { status: "error", message: "이미 같은 시각에 일정이 있어요.", values };
  const { data: created, error } = await supabase.from("meetup_sessions").insert(rows).select("id, starts_at");
  if (error) {
    return { status: "error", message: error.code === "42501" ? "일정을 추가할 수 없는 프로그램입니다." : rpcErrorMessage(error), values };
  }
  // 열림 시각(드롭): 반복 일정이면 각 회차의 시작 시각과 같은 간격으로. 실패하면 그 일정은 바로 열리지 않게 모집 마감으로 두고 알려 줌
  if (v.opensAt) {
    const lead = new Date(v.startsAt).getTime() - new Date(v.opensAt).getTime();
    const failed: string[] = [];
    for (const row of created ?? []) {
      const opens = new Date(new Date(row.starts_at).getTime() - lead).toISOString();
      const { error: oe } = await supabase.rpc("host_set_session_opens_at", { p_session_id: row.id, p_opens_at: opens });
      if (oe) {
        await supabase.rpc("host_set_session_status", { p_session_id: row.id, p_action: "close" });
        failed.push(rpcErrorMessage(oe));
      }
    }
    if (failed.length) {
      revalidatePath(`/host/meetups/${meetupId}`);
      return { status: "error", message: `일정은 만들었지만 열림 시각을 정하지 못해 ${failed.length}개를 '모집 마감'으로 두었어요. (${failed[0]})`, values };
    }
  }
  revalidatePath(`/host/meetups/${meetupId}`);
  const skipped = times - rows.length;
  return {
    status: "success",
    message: rows.length > 1 ? `일정 ${rows.length}개를 추가했어요.${skipped ? ` (이미 있던 ${skipped}개는 건너뜀)` : ""}` : "일정을 추가했어요.",
  };
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

const attendanceSchema = z.object({ meetupId: z.uuid(), bookingId: z.uuid(), attended: z.enum(["true", "false"]) });

/** 출석 체크 (참석/불참) — 프로그램이 시작된 뒤, 담당 호스트만 (DB가 다시 확인) */
export async function markAttendanceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  if (!member.roles.includes("host")) return NOT_HOST;
  const parsed = attendanceSchema.safeParse({
    meetupId: formValue(formData, "meetupId"),
    bookingId: formValue(formData, "bookingId"),
    attended: formValue(formData, "attended"),
  });
  if (!parsed.success) return { status: "error", message: "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("host_mark_attendance", { p_booking_id: parsed.data.bookingId, p_attended: parsed.data.attended === "true" });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  revalidatePath(`/host/meetups/${parsed.data.meetupId}`);
  return { status: "success", message: parsed.data.attended === "true" ? "참석으로 체크했어요." : "불참으로 체크했어요." };
}

const noticeSchema = z.object({
  meetupId: z.uuid(),
  sessionId: z.uuid(),
  body: z.string().trim().min(5, "공지는 5자 이상 적어 주세요.").max(300, "공지는 300자 이내로 적어 주세요."),
});

/** 참가자에게 공지 — 확정 참가자 모두에게 알림으로 전달 */
export async function sendSessionNoticeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  if (!member.roles.includes("host")) return NOT_HOST;
  const parsed = noticeSchema.safeParse({
    meetupId: formValue(formData, "meetupId"),
    sessionId: formValue(formData, "sessionId"),
    body: formValue(formData, "body"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues.find((i) => i.path[0] === "body")?.message ?? "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("host_send_session_notice", { p_session_id: parsed.data.sessionId, p_body: parsed.data.body });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  revalidatePath(`/host/meetups/${parsed.data.meetupId}`);
  return { status: "success", message: `참가자 ${data ?? 0}명에게 공지를 보냈어요.` };
}

const replySchema = z.object({
  reviewId: z.uuid(),
  reply: z.string().trim().min(2, "답글은 2자 이상 적어 주세요.").max(500, "답글은 500자 이내로 적어 주세요."),
});

/** 후기에 답글 (수정 가능) */
export async function replyReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  if (!member.roles.includes("host")) return NOT_HOST;
  const parsed = replySchema.safeParse({ reviewId: formValue(formData, "reviewId"), reply: formValue(formData, "reply") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues.find((i) => i.path[0] === "reply")?.message ?? "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("host_reply_review", { p_review_id: parsed.data.reviewId, p_reply: parsed.data.reply });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  revalidatePath("/host/reviews");
  revalidatePath("/meetups", "layout");
  revalidatePath("/hosts", "layout");
  return { status: "success", message: "답글을 남겼어요. 후기를 쓴 분께 알림이 가요." };
}

/** 프로그램 복제 — 글·참가비·순서를 그대로 가져와 "임시 저장" 새 프로그램으로 (일정·사진·쿠폰 동의는 복사하지 않음) */
export async function duplicateMeetupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  if (!member.roles.includes("host")) return NOT_HOST;
  const id = z.uuid().safeParse(formValue(formData, "meetupId"));
  if (!id.success) return { status: "error", message: "잘못된 요청입니다." };
  const src = await getMyMeetup(member.id, id.data);
  if (!src) return { status: "error", message: "복제할 수 없는 프로그램입니다." };
  const title = `${src.title} (복사본)`.slice(0, 60);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("meetups")
    .insert({
      host_id: member.id,
      title,
      category_slug: src.category_slug,
      meetup_type: src.meetup_type,
      summary: src.summary,
      description: src.description,
      price: src.price,
      max_quantity_per_booking: src.max_quantity_per_booking,
      target_audience: src.target_audience,
      requirements: src.requirements,
      what_to_bring: src.what_to_bring,
      agenda: src.agenda,
      refund_policy_text: src.refund_policy_text,
      level: src.level,
      learning_outcomes: src.learning_outcomes,
      materials_note: src.materials_note,
      price_rationale: src.price_rationale,
    })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: rpcErrorMessage(error) };
  revalidatePath("/host");
  redirect(`/host/meetups/${data.id}?saved=1&copied=1`);
}

const opensAtSchema = z.object({
  sessionId: z.uuid(),
  meetupId: z.uuid(),
  opensDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).refine((v) => v === "" || isRealDate(v)),
  opensTime: z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/),
});

/** 일정의 열림 시각 정하기·지우기 (둘 다 비우면 지움 = 바로 신청 가능). 규칙은 DB 함수가 최종 확인 */
export async function setOpensAtAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  const parsed = opensAtSchema.safeParse({
    sessionId: formValue(formData, "sessionId"),
    meetupId: formValue(formData, "meetupId"),
    opensDate: formValue(formData, "opensDate"),
    opensTime: formValue(formData, "opensTime"),
  });
  if (!parsed.success) return { status: "error", message: "오픈 일자와 시각을 확인해 주세요." };
  const { sessionId, meetupId, opensDate, opensTime } = parsed.data;
  if (Boolean(opensDate) !== Boolean(opensTime)) return { status: "error", message: "오픈 일자와 시각을 함께 입력하거나, 둘 다 비워 주세요." };
  const opensAt = opensDate && opensTime ? new Date(`${opensDate}T${opensTime}:00+09:00`).toISOString() : null;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("host_set_session_opens_at", { p_session_id: sessionId, p_opens_at: opensAt });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  revalidatePath(`/host/meetups/${meetupId}`);
  revalidatePath(`/meetups/${meetupId}`);
  revalidatePath("/drops");
  return { status: "success", message: opensAt ? "열림 시각을 정했어요." : "열림 시각을 지웠어요. 지금부터 바로 신청할 수 있어요." };
}
