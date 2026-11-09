"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { checkAdminForAction } from "@/lib/auth/guards";
import { formValue, type FormState } from "@/lib/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminReasonSchema, fieldErrors } from "@/lib/validation/auth";

const FORBIDDEN: FormState = { status: "error", message: "관리자 2단계 인증이 필요합니다. 다시 로그인해 주세요." };

const roleChangeSchema = z.object({
  userId: z.uuid(),
  op: z.enum(["host:grant", "host:revoke", "admin:grant", "admin:revoke"], "변경할 역할을 선택해 주세요."),
  reason: adminReasonSchema,
});

const statusChangeSchema = z.object({
  userId: z.uuid(),
  status: z.enum(["active", "suspended"]),
  reason: adminReasonSchema,
});

/** DB 함수가 돌려준 안내 문구만 보여 주고, 그 외 내부 오류는 일반 문구로 */
function dbMessage(error: { code?: string; message: string }): string {
  if (error.code === "42501" || error.code === "22023" || error.code === "P0002") {
    return error.message.replace(/^forbidden: /, "").replace(/^reason_required: /, "");
  }
  return "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

/** 역할 부여·회수 — 서버에서 관리자(aal2) 확인 후 DB 관리자 함수 호출(DB도 다시 확인, 감사 기록 생성) */
export async function setRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const parsed = roleChangeSchema.safeParse({
    userId: formValue(formData, "userId"),
    op: formValue(formData, "op"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { status: "error", message: errors.op ?? errors.userId, fieldErrors: errors };
  }
  const [role, change] = parsed.data.op.split(":") as ["host" | "admin", "grant" | "revoke"];

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_user_role", {
    p_user_id: parsed.data.userId,
    p_role: role,
    p_grant: change === "grant",
    p_reason: parsed.data.reason,
  });
  if (error) return { status: "error", message: dbMessage(error) };
  revalidatePath("/admin/members");
  return { status: "success", message: "역할을 변경했습니다." };
}

export async function setStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const parsed = statusChangeSchema.safeParse({
    userId: formValue(formData, "userId"),
    status: formValue(formData, "status"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_member_status", {
    p_user_id: parsed.data.userId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason,
  });
  if (error) return { status: "error", message: dbMessage(error) };
  revalidatePath("/admin/members");
  return { status: "success", message: "회원 상태를 변경했습니다." };
}

/** 호스트 신청 승인·반려 (승인 시 host 역할 부여, 감사 기록) */
const applicationReviewSchema = z.object({
  applicationId: z.uuid(),
  action: z.enum(["start_review", "request_revision", "approve", "reject"]),
  note: z.string().trim().max(1000),
});

const REVIEW_DONE = {
  start_review: "심사를 시작했어요.",
  request_revision: "수정을 요청했어요. 지원자에게 알림이 가요.",
  approve: "승인했어요. 공개 호스트 프로필이 만들어졌어요.",
  reject: "반려했어요. 지원자에게 알림이 가요.",
} as const;

/** 호스트 지원서 심사 — 서버에서 관리자(aal2) 확인 후 DB 관리자 함수 (상태 전환·메모 필수·감사 기록·알림은 DB가 처리) */
export async function reviewApplicationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const parsed = applicationReviewSchema.safeParse({
    applicationId: formValue(formData, "applicationId"),
    action: formValue(formData, "action"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return { status: "error", message: "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_review_host_application", {
    p_id: parsed.data.applicationId,
    p_action: parsed.data.action,
    p_note: parsed.data.note,
  });
  if (error) return { status: "error", message: dbMessage(error) };
  revalidatePath("/admin/hosts");
  revalidatePath(`/admin/hosts/${parsed.data.applicationId}`);
  return { status: "success", message: REVIEW_DONE[parsed.data.action] };
}

const meetupReviewSchema = z.object({
  meetupId: z.uuid(),
  action: z.enum(["publish", "reject", "suspend", "unsuspend"]),
  note: z.string().trim().max(500),
});

/** 프로그램 공개·반려·정지 (감사 기록) */
export async function reviewMeetupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const parsed = meetupReviewSchema.safeParse({
    meetupId: formValue(formData, "meetupId"),
    action: formValue(formData, "action"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return { status: "error", message: "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_review_meetup", {
    p_meetup_id: parsed.data.meetupId,
    p_action: parsed.data.action,
    p_note: parsed.data.note,
  });
  if (error) return { status: "error", message: dbMessage(error) };
  revalidatePath("/admin/meetups");
  const done = { publish: "공개했어요.", reject: "반려했어요.", suspend: "정지했어요.", unsuspend: "다시 공개했어요." };
  return { status: "success", message: done[parsed.data.action] };
}

const listingSchema = z.object({
  userId: z.uuid(),
  pillar: z.enum(["knowledge", "creators", "experts"], "대표 분류를 선택해 주세요."),
  featured: z.enum(["on", "off"]).default("off"),
  order: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 99), "추천 순서는 1~99 사이 숫자예요."),
});

/** 호스트 목록 정보: 대표 분류·운영팀 추천 (DB 관리자 함수, 감사 기록) */
export async function updateHostListingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const parsed = listingSchema.safeParse({
    userId: formValue(formData, "userId"),
    pillar: formValue(formData, "pillar"),
    featured: formData.get("featured") === "on" ? "on" : "off",
    order: formValue(formData, "order"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "입력을 확인해 주세요." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_update_host_listing", {
    p_user_id: parsed.data.userId,
    p_primary_pillar: parsed.data.pillar,
    p_is_featured: parsed.data.featured === "on",
    p_featured_order: parsed.data.featured === "on" ? parsed.data.order : null,
  });
  if (error) return { status: "error", message: dbMessage(error) };
  revalidatePath("/admin/hosts");
  revalidatePath("/hosts");
  return { status: "success", message: "저장했어요." };
}
