"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentMember } from "@/lib/auth/session";
import { formValue, type FormState } from "@/lib/forms";
import { rpcErrorMessage } from "@/lib/rpc-errors";
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
  const values = Object.fromEntries(["displayName", "headline", "bio", "expertise", "instagram"].map((k) => [k, formValue(formData, k)]));
  const parsed = hostApplicationSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("apply_host", {
    p_display_name: parsed.data.displayName,
    p_headline: parsed.data.headline,
    p_bio: parsed.data.bio,
    p_expertise: parsed.data.expertise,
    p_instagram: parsed.data.instagram,
  });
  if (error) return { status: "error", message: rpcErrorMessage(error), values };
  revalidatePath("/host/apply");
  return { status: "success", message: "호스트 신청을 받았어요. 운영팀 검토 후 알려 드릴게요." };
}

/** 모임 만들기 / 수정 — 저장 후 관리 화면으로 */
export async function saveMeetupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await activeMember();
  if (!member) return LOGIN_REQUIRED;
  if (!member.roles.includes("host")) return NOT_HOST;

  const keys = ["title", "categorySlug", "meetupType", "summary", "description", "price", "maxQuantity",
    "targetAudience", "requirements", "whatToBring", "agenda", "refundPolicyText"];
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
  };
  const supabase = await createSupabaseServerClient();
  const meetupId = formValue(formData, "meetupId");
  let id = meetupId;
  if (meetupId) {
    const { data, error } = await supabase.from("meetups").update(row).eq("id", meetupId).eq("host_id", member.id).select("id");
    if (error) return { status: "error", message: rpcErrorMessage(error), values };
    if (!data?.length) return { status: "error", message: "수정할 수 없는 모임입니다.", values };
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
    return { status: "error", message: error.code === "42501" ? "일정을 추가할 수 없는 모임입니다." : rpcErrorMessage(error), values };
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
