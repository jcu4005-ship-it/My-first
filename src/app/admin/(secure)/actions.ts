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
