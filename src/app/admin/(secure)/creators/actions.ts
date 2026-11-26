"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { checkAdminForAction } from "@/lib/auth/guards";
import { CREATOR_NOTE_KINDS, CREATOR_STATUSES } from "@/lib/creators/constants";
import { formValue, type FormState } from "@/lib/forms";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const FORBIDDEN: FormState = { status: "error", message: "관리자 2단계 인증이 필요합니다. 다시 로그인해 주세요." };
const id = z.uuid();

/** 지원 상태 변경 (감사 기록) */
export async function setCreatorStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const parsed = z
    .object({ id, status: z.enum(CREATOR_STATUSES.map((s) => s.value) as [string, ...string[]]) })
    .safeParse({ id: formValue(formData, "id"), status: formValue(formData, "status") });
  if (!parsed.success) return { status: "error", message: "잘못된 요청입니다." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_creator_application_status", { p_id: parsed.data.id, p_status: parsed.data.status });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  revalidatePath("/admin/creators");
  revalidatePath(`/admin/creators/${parsed.data.id}`);
  return { status: "success", message: "상태를 바꿨어요." };
}

/** 전화 인터뷰 메모·녹취록 추가 */
export async function addCreatorNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const parsed = z
    .object({
      id,
      kind: z.enum(CREATOR_NOTE_KINDS.map((k) => k.value) as [string, ...string[]]),
      body: z.string().trim().min(1, "내용을 적어 주세요.").max(20000, "20000자 이내로 적어 주세요."),
    })
    .safeParse({ id: formValue(formData, "id"), kind: formValue(formData, "kind"), body: formValue(formData, "body") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "입력을 확인해 주세요." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_add_creator_application_note", { p_id: parsed.data.id, p_kind: parsed.data.kind, p_body: parsed.data.body });
  if (error) return { status: "error", message: rpcErrorMessage(error) };
  revalidatePath(`/admin/creators/${parsed.data.id}`);
  return { status: "success", message: "메모를 저장했어요." };
}

/** 연락처 원문 열람 — 사유 필수, 감사 기록 */
export async function revealCreatorContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAdminForAction())) return FORBIDDEN;
  const parsed = z
    .object({ targetId: id, reason: z.string().trim().min(5, "열람 사유를 5자 이상 입력해 주세요.").max(300) })
    .safeParse({ targetId: formValue(formData, "targetId"), reason: formValue(formData, "reason") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "입력을 확인해 주세요." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_creator_application_contact", { p_id: parsed.data.targetId, p_reveal: true, p_reason: parsed.data.reason });
  if (error || typeof data !== "string") return { status: "error", message: error ? rpcErrorMessage(error) : "열람하지 못했습니다." };
  return { status: "success", message: data };
}
