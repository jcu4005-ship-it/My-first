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

const hostActiveSchema = z.object({
  userId: z.uuid(),
  active: z.enum(["true", "false"]),
  reason: z.string().trim().min(5, "사유를 5자 이상 입력해 주세요.").max(500),
});

/** 호스트 활동 중지·재개 (사유 필수, 감사 기록·알림은 DB 함수가 남김) */
export async function setHostActiveAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const parsed = hostActiveSchema.safeParse({
    userId: formValue(formData, "userId"),
    active: formValue(formData, "active"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "입력을 확인해 주세요." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_host_active", {
    p_user_id: parsed.data.userId,
    p_active: parsed.data.active === "true",
    p_reason: parsed.data.reason,
  });
  if (error) return { status: "error", message: dbMessage(error) };
  revalidatePath("/admin/hosts");
  revalidatePath(`/admin/hosts/profile/${parsed.data.userId}`);
  revalidatePath("/hosts");
  return { status: "success", message: parsed.data.active === "true" ? "다시 활성화했어요." : "활동을 중지했어요." };
}

const hostSlugSchema = z.object({
  userId: z.uuid(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/, "영문 소문자·숫자·하이픈 3~42자로 입력해 주세요."),
});

/** 호스트 공개 주소(slug) 변경 — 예전 주소는 더 이상 연결되지 않으므로 신중히 */
export async function setHostSlugAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const parsed = hostSlugSchema.safeParse({ userId: formValue(formData, "userId"), slug: formValue(formData, "slug") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "입력을 확인해 주세요." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_host_slug", { p_user_id: parsed.data.userId, p_slug: parsed.data.slug });
  if (error) return { status: "error", message: dbMessage(error) };
  revalidatePath("/admin/hosts");
  revalidatePath(`/admin/hosts/profile/${parsed.data.userId}`);
  revalidatePath("/hosts");
  return { status: "success", message: `주소를 /hosts/${parsed.data.slug} 로 바꿨어요.` };
}

const couponCreateSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{2,18}[A-Z0-9]$/, "코드는 영문 대문자·숫자·하이픈 4~20자로 입력해 주세요."),
  name: z.string().trim().min(2, "이름을 2자 이상 입력해 주세요.").max(40),
  percent: z.coerce.number().int().min(1).max(10, "할인율은 최대 10%예요 (호스트 동의 한도)."),
  firstOnly: z.enum(["on", "off"]),
  max: z.string().trim().regex(/^\d*$/, "사용 한도는 숫자로 입력해 주세요."),
  endsOn: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, "날짜를 확인해 주세요."),
});

/** 쿠폰 발급 (관리자 2단계 인증, 감사 기록은 DB 함수가 남김) */
export async function createCouponAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const values = {
    code: formValue(formData, "code"),
    name: formValue(formData, "name"),
    percent: formValue(formData, "percent") || "10",
    firstOnly: formData.get("firstOnly") === "on" ? "on" : "off",
    max: formValue(formData, "max"),
    endsOn: formValue(formData, "endsOn"),
  };
  const parsed = couponCreateSchema.safeParse(values);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "입력을 확인해 주세요.", values };
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_create_coupon", {
    p_code: v.code,
    p_name: v.name,
    p_percent: v.percent,
    p_first_only: v.firstOnly === "on",
    p_max: v.max ? Number(v.max) : null,
    // 끝나는 날 자정(한국 시간)까지 사용 가능
    p_ends_at: v.endsOn ? new Date(`${v.endsOn}T23:59:59+09:00`).toISOString() : null,
  });
  if (error) return { status: "error", message: dbMessage(error), values };
  revalidatePath("/admin/coupons");
  return { status: "success", message: `쿠폰 ${v.code}을(를) 만들었어요.` };
}

const couponActiveSchema = z.object({ couponId: z.uuid(), active: z.enum(["true", "false"]) });

export async function setCouponActiveAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const parsed = couponActiveSchema.safeParse({ couponId: formValue(formData, "couponId"), active: formValue(formData, "active") });
  if (!parsed.success) return { status: "error", message: "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_coupon_active", { p_id: parsed.data.couponId, p_active: parsed.data.active === "true" });
  if (error) return { status: "error", message: dbMessage(error) };
  revalidatePath("/admin/coupons");
  return { status: "success", message: parsed.data.active === "true" ? "쿠폰을 켰어요." : "쿠폰을 껐어요." };
}

const revealSchema = z.object({ targetId: z.uuid(), reason: z.string().trim().min(5, "열람 사유를 5자 이상 입력해 주세요.").max(200) });

/** 지원서 휴대폰 원문 열람 — 사유 필수, 감사 기록은 DB 함수가 남김. 결과는 화면에만 잠깐 보여 줌 */
export async function revealApplicationContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const parsed = revealSchema.safeParse({ targetId: formValue(formData, "targetId"), reason: formValue(formData, "reason") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "입력을 확인해 주세요." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_application_contact", { p_id: parsed.data.targetId, p_reveal: true, p_reason: parsed.data.reason });
  if (error || typeof data !== "string") return { status: "error", message: error ? dbMessage(error) : "열람하지 못했습니다." };
  return { status: "success", message: data };
}

/** 회원 이메일 원문 열람 — 사유 필수, 감사 기록 */
export async function revealMemberEmailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const parsed = revealSchema.safeParse({ targetId: formValue(formData, "targetId"), reason: formValue(formData, "reason") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "입력을 확인해 주세요." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_reveal_member_email", { p_user_id: parsed.data.targetId, p_reason: parsed.data.reason });
  if (error || typeof data !== "string") return { status: "error", message: error ? dbMessage(error) : "열람하지 못했습니다." };
  return { status: "success", message: data };
}

/** 보관 기간이 지난 지원서 개인정보 정리 (감사 기록) */
export async function purgeStalePiiAction(): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_purge_stale_pii");
  if (error) return { status: "error", message: dbMessage(error) };
  revalidatePath("/admin");
  return { status: "success", message: `${typeof data === "number" ? data : 0}건의 개인정보를 정리했어요.` };
}

/* ---------- 비공개 베타: 서비스 설정 · 초대 코드 ---------- */

const settingsSchema = z.object({
  inviteOnly: z.enum(["true", "false"]),
  paidBookings: z.enum(["true", "false"]),
  reason: z.string().trim().min(5, "변경 사유를 5자 이상 입력해 주세요.").max(200),
});

/** 초대제·유료 신청 허용 변경 — 사유 필수, 감사 기록은 DB 함수가 남김 */
export async function updateAppSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const raw = { inviteOnly: formValue(formData, "inviteOnly"), paidBookings: formValue(formData, "paidBookings"), reason: formValue(formData, "reason") };
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_app_settings", {
    p_invite_only: parsed.data.inviteOnly === "true",
    p_paid_bookings: parsed.data.paidBookings === "true",
    p_reason: parsed.data.reason,
  });
  if (error) return { status: "error", message: dbMessage(error), values: raw };
  revalidatePath("/admin/launch");
  revalidatePath("/signup");
  return { status: "success", message: "서비스 설정을 바꿨어요." };
}

const inviteSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{3,18}[A-Z0-9]$/, "영문 대문자·숫자·하이픈 5~20자로 입력해 주세요."),
  note: z.string().trim().max(100, "메모는 100자까지예요.").optional().default(""),
  maxUses: z.coerce.number().int("숫자로 입력해 주세요.").min(1, "1회 이상이어야 해요.").max(1000, "1000회까지 가능해요."),
  expiresOn: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional().default(""),
});

/** 초대 코드 발급 */
export async function createInviteCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const raw = { code: formValue(formData, "code"), note: formValue(formData, "note"), maxUses: formValue(formData, "maxUses"), expiresOn: formValue(formData, "expiresOn") };
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  const { code, note, maxUses, expiresOn } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_create_invite_code", {
    p_code: code,
    p_note: note,
    p_max_uses: maxUses,
    // 마지막 사용일의 다음 날 0시(한국 시간)에 만료
    p_expires_at: expiresOn ? new Date(new Date(`${expiresOn}T00:00:00+09:00`).getTime() + 86400000).toISOString() : null,
  });
  if (error) return { status: "error", message: dbMessage(error), values: raw };
  revalidatePath("/admin/launch");
  return { status: "success", message: `초대 코드 ${code}를 만들었어요.` };
}

const inviteActiveSchema = z.object({ inviteId: z.uuid(), active: z.enum(["true", "false"]) });

export async function setInviteActiveAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const parsed = inviteActiveSchema.safeParse({ inviteId: formValue(formData, "inviteId"), active: formValue(formData, "active") });
  if (!parsed.success) return { status: "error", message: "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_invite_active", { p_id: parsed.data.inviteId, p_active: parsed.data.active === "true" });
  if (error) return { status: "error", message: dbMessage(error) };
  revalidatePath("/admin/launch");
  return { status: "success", message: parsed.data.active === "true" ? "코드를 다시 켰어요." : "코드를 껐어요." };
}

/* ---------- 고객센터: 문의 답변 · 상태 ---------- */

const replySchema = z.object({
  ticketId: z.uuid(),
  body: z.string().trim().min(5, "답변을 5자 이상 적어 주세요.").max(2000, "답변은 2000자까지예요."),
  close: z.enum(["on", ""]).optional().default(""),
});

/** 문의 답변 — 회원 알림·감사 기록은 DB 함수가 남김 */
export async function replySupportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const raw = { ticketId: formValue(formData, "ticketId"), body: formValue(formData, "body"), close: formValue(formData, "close") };
  const parsed = replySchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_reply_support", { p_ticket_id: parsed.data.ticketId, p_body: parsed.data.body, p_close: parsed.data.close === "on" });
  if (error) return { status: "error", message: dbMessage(error), values: raw };
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${parsed.data.ticketId}`);
  return { status: "success", message: "답변을 보냈어요. 회원에게 알림이 갔어요." };
}

const supportStatusSchema = z.object({ ticketId: z.uuid(), status: z.enum(["open", "answered", "closed"]) });

export async function setSupportStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const parsed = supportStatusSchema.safeParse({ ticketId: formValue(formData, "ticketId"), status: formValue(formData, "status") });
  if (!parsed.success) return { status: "error", message: "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_support_status", { p_ticket_id: parsed.data.ticketId, p_status: parsed.data.status });
  if (error) return { status: "error", message: dbMessage(error) };
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${parsed.data.ticketId}`);
  return { status: "success", message: "상태를 바꿨어요." };
}
