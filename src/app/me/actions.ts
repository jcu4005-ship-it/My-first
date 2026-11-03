"use server";

import { revalidatePath } from "next/cache";

import { getCurrentMember } from "@/lib/auth/session";
import { formValue, type FormState } from "@/lib/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fieldErrors, privateUpdateSchema, profileUpdateSchema } from "@/lib/validation/auth";

const NOT_ALLOWED: FormState = { status: "error", message: "로그인이 필요하거나 수정할 수 없는 계정 상태입니다." };

/** 공개 프로필 수정 — 본인 행만, 닉네임·소개만 (DB 열 권한·RLS가 같은 규칙을 다시 확인) */
export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await getCurrentMember();
  if (!member || member.status !== "active") return NOT_ALLOWED;

  const values = { nickname: formValue(formData, "nickname"), bio: formValue(formData, "bio") };
  const parsed = profileUpdateSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ nickname: parsed.data.nickname, bio: parsed.data.bio })
    .eq("id", member.id)
    .select("id");
  if (error) {
    if (error.code === "23505") {
      return { status: "error", fieldErrors: { nickname: "이미 사용 중인 닉네임입니다." }, values };
    }
    if (error.code === "23514") {
      return { status: "error", fieldErrors: { nickname: "사용할 수 없는 닉네임입니다." }, values };
    }
    return { status: "error", message: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", values };
  }
  if (!data?.length) return NOT_ALLOWED;
  revalidatePath("/me");
  return { status: "success", message: "프로필을 저장했습니다." };
}

/** 비공개 정보 수정 — 본인만, 연락처·출생연도만 */
export async function updatePrivateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await getCurrentMember();
  if (!member || member.status !== "active") return NOT_ALLOWED;

  const values = { phone: formValue(formData, "phone"), birthYear: formValue(formData, "birthYear") };
  const parsed = privateUpdateSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profile_private")
    .update({ phone: parsed.data.phone, birth_year: parsed.data.birthYear })
    .eq("user_id", member.id)
    .select("user_id");
  if (error || !data?.length) {
    return { status: "error", message: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", values };
  }
  revalidatePath("/me");
  return { status: "success", message: "비공개 정보를 저장했습니다." };
}
